import "dotenv/config";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Worker } from "bullmq";
import { createLlmFromConfig, MemoryNoveltyIndex } from "../classify/index.js";
import {
  createNewsCollector,
  persistRawItems,
  pollNews,
  sourceById,
} from "../collectors/news/index.js";
import { enabledSources, loadDeskSettings, loadNewsSources } from "../desk/index.js";
import { noopCollector } from "../collectors/noop.js";
import { listCollectors, registerCollector, runCollectors } from "../collectors/registry.js";
import { createTapeCollector, startLiveTape } from "../collectors/tape/index.js";
import { ensureMarksTable, saveMark } from "../collectors/tape/marks.js";
import { loadConfig } from "../config.js";
import { insertAlert } from "../db/alerts.js";
import { createDb, createPool } from "../db/client.js";
import { upsertEvent } from "../db/events.js";
import { buildDigest } from "../jobs/digest.js";
import { quietSnapshot, runNewsDesk } from "../jobs/newsDesk.js";
import { fillOutcomes } from "../jobs/outcomes.js";
import { registerSchedules } from "../jobs/schedule.js";
import { formatWait, nextDigestAt, nextNewsAt, nextTapeAt, ops, startOpsBus } from "../ops/index.js";
import { Policy } from "../policy/index.js";
import {
  closeQueues,
  createQueueConnection,
  createQueues,
  QUEUE_NAMES,
  workerConnectionOpts,
} from "../queue.js";
import {
  ChatStore,
  createApiTransport,
  createLogTransport,
  sendDigest,
  sendHeadlines,
} from "../telegram/index.js";

export async function startWorker(): Promise<{
  collectors: string[];
  queues: readonly string[];
  schedulers: string[];
  stop: () => Promise<void>;
}> {
  const config = loadConfig();
  const tapeEnabled = config.TAPE_LIVE && !process.env.VITEST;
  let paused = false;
  const tapePool = tapeEnabled ? createPool(config.DATABASE_URL) : undefined;
  if (tapePool) {
    await ensureMarksTable(tapePool);
  }
  const liveTape = tapeEnabled
    ? startLiveTape({
        persistMark: (mark) => saveMark(tapePool!, mark),
      })
    : undefined;

  registerCollector(noopCollector);
  registerCollector(createTapeCollector({ live: tapeEnabled, runtime: liveTape?.runtime }));
  registerCollector(createNewsCollector());
  const queueConnection = createQueueConnection(config.REDIS_URL);
  const workerConnection = createQueueConnection(config.REDIS_URL);
  const opsConnection = createQueueConnection(config.REDIS_URL);
  const bus = startOpsBus(opsConnection);
  const queues = createQueues(queueConnection);
  const schedulers = await registerSchedules(queues);
  const jobOpts = workerConnectionOpts(workerConnection);
  await runCollectors({ now: new Date() });

  const store = new ChatStore();
  if (config.TELEGRAM_CHAT_ID) {
    store.bind(config.TELEGRAM_CHAT_ID);
  }
  const transport =
    config.TELEGRAM_DRY_RUN || !config.TELEGRAM_BOT_TOKEN
      ? createLogTransport()
      : createApiTransport(config.TELEGRAM_BOT_TOKEN);

  const runNamed = async (name: string) => {
    const collector = listCollectors().find((item) => item.name === name);
    await collector?.run({ now: new Date() });
  };

  const policy = new Policy({
    store,
    transport,
    chatId: config.TELEGRAM_CHAT_ID || "0",
    dryRun: config.TELEGRAM_DRY_RUN,
    persist: async (decision, fingerprint) => {
      const pool = createPool(config.DATABASE_URL);
      try {
        const result = await insertAlert(createDb(pool), {
          kind: decision.kind,
          fingerprint,
          eventId: decision.eventId,
          asset: decision.asset,
          horizon: decision.horizon,
          pUp: decision.pUp,
          pDown: decision.pDown,
          pIn: decision.pIn,
          why: decision.why,
          kill: decision.kill,
        });
        return result.inserted;
      } finally {
        await pool.end();
      }
    },
  });
  const novelty = new MemoryNoveltyIndex();
  const llm = createLlmFromConfig(config);

  const beat = () =>
    bus.heartbeat({
      pid: process.pid,
      paused,
      newsLive: config.NEWS_LIVE,
      tapeLive: tapeEnabled,
      dryRun: config.TELEGRAM_DRY_RUN,
    });

  const processors = [
    new Worker("tape", async () => {
      if (paused) {
        ops("tape", "paused", "Tape job skipped: worker is paused", { level: "wait" });
        return;
      }
      if (liveTape) {
        await liveTape.runtime.pollOi();
        ops("tape", "wait", `Tape idle. Next OI ${formatWait(nextTapeAt())}`, { level: "wait" });
        return;
      }
      ops("tape", "stub", "TAPE_LIVE=0; running stub tape collector", { level: "wait" });
      await runNamed("tape");
    }, jobOpts),
    new Worker("news", async () => {
      if (paused) {
        ops("news", "paused", "News job skipped: worker is paused", { level: "wait" });
        return;
      }
      if (!config.NEWS_LIVE) {
        ops("news", "stub", "NEWS_LIVE=0; not polling RSS/Farside", { level: "wait" });
        await runNamed("news");
        return;
      }
      const pool = createPool(config.DATABASE_URL);
      try {
        const settings = await loadDeskSettings(pool);
        const catalog = await loadNewsSources(pool);
        policy.applySettings(settings);
        const fetched = await pollNews({
          sources: enabledSources(catalog),
          largeTxBtc: config.BTC_LARGE_TX_BTC,
          mempoolApiBase: config.MEMPOOL_API_BASE,
        });
        const items = await persistRawItems(pool, fetched, { limit: settings.newsBatchLimit });
        ops("news", "persist", `Persisting ${items.length} new item(s) (cap ${settings.newsBatchLimit}; ${fetched.length} fetched)`, {
          data: { persisted: items.length, fetched: fetched.length, cap: settings.newsBatchLimit },
        });
        if (fetched.length > items.length) {
          ops("news", "persist.cap", `${fetched.length - items.length} older new item(s) left for the next poll`, {
            level: "wait",
            data: { leftover: fetched.length - items.length },
          });
        }
        if (items.length > 0 && config.TELEGRAM_CHAT_ID && settings.headlineEnabled) {
          const byId = new Map(catalog.map((source) => [source.id, source]));
          const headlines = await sendHeadlines(transport, {
            chatId: config.TELEGRAM_CHAT_ID,
            items,
            dryRun: config.TELEGRAM_DRY_RUN,
            settings,
            sourceNameOf: (id) => byId.get(id)?.name ?? sourceById(id)?.name ?? id,
          });
          const sent = headlines.filter((row) => row.sent || row.reason === "dry-run");
          ops("news", "headline", `Headline ping ${sent.length} new title(s)`, {
            data: {
              count: sent.length,
              filtered: headlines.length - sent.length,
              dryRun: config.TELEGRAM_DRY_RUN,
              toneMode: settings.toneMode,
              headlineSend: settings.headlineSend,
              titles: items.map((item) => item.title),
            },
          });
        }
        await runNewsDesk(items, {
          llm,
          policy,
          novelty,
          persistEvent: (input) => upsertEvent(createDb(pool), input),
          snapshotFor: (asset, now) =>
            liveTape ? liveTape.runtime.snapshotFor(asset, now) : quietSnapshot(asset, now),
        });
      } finally {
        await pool.end();
      }
      ops("news", "wait", `News idle. Next poll ${formatWait(nextNewsAt())}`, { level: "wait" });
    }, jobOpts),
    new Worker("outcomes", async () => {
      if (paused) {
        return;
      }
      const pool = createPool(config.DATABASE_URL);
      try {
        ops("outcomes", "run", "Filling due outcomes");
        await fillOutcomes(createDb(pool), (sql, params) => pool.query(sql, params));
      } finally {
        await pool.end();
      }
    }, jobOpts),
    new Worker("digest", async () => {
      if (paused) {
        ops("digest", "paused", "DIGEST skipped: worker is paused", { level: "wait" });
        return;
      }
      const chatId = config.TELEGRAM_CHAT_ID;
      if (!chatId) {
        ops("digest", "skip", "No TELEGRAM_CHAT_ID; DIGEST not sent", { level: "skip" });
        return;
      }
      const pool = createPool(config.DATABASE_URL);
      try {
        const settings = await loadDeskSettings(pool);
        try {
          await fillOutcomes(createDb(pool), (sql, params) => pool.query(sql, params));
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          ops("digest", "outcomes.skip", `Outcomes not filled: ${message}`, {
            level: "skip",
            data: { reason: message },
          });
        }
        const now = new Date();
        const snapshot = liveTape ? await liveTape.runtime.snapshotFor("BTC", now) : null;
        const report = await buildDigest(pool, now, settings, snapshot);
        const send = await sendDigest(store, transport, {
          chatId,
          report,
          dryRun: config.TELEGRAM_DRY_RUN,
        });
        ops("digest", "emit", send.sent ? "DIGEST sent" : `DIGEST ${send.reason}`, {
          level: send.sent || send.reason === "dry-run" ? "ok" : "skip",
          data: {
            flash: report.calls.FLASH,
            fade: report.calls.FADE,
            confirm: report.calls.CONFIRM,
            invalidate: report.calls.INVALIDATE,
            mix: report.mix.score,
            bull: report.mix.bull,
            bear: report.mix.bear,
            neutral: report.mix.neutral,
            dryRun: config.TELEGRAM_DRY_RUN,
          },
        });
      } finally {
        await pool.end();
      }
      ops("digest", "wait", `Next DIGEST ${formatWait(nextDigestAt())}`, { level: "wait" });
    }, jobOpts),
  ];
  for (const worker of processors) {
    worker.on("error", (error: Error) => {
      ops("worker", "error", error.message, { level: "error" });
    });
  }

  bus.subscribeControl((command) => {
    ops("worker", "control", `Received ${command.action}`, { data: { action: command.action } });
    if (command.action === "pause") {
      paused = true;
    }
    if (command.action === "resume") {
      paused = false;
    }
    if (command.action === "run-news") {
      void queues.news.add("news-now", { kind: "news" });
    }
    if (command.action === "run-tape") {
      void queues.tape.add("tape-now", { kind: "tape" });
    }
    if (command.action === "run-digest") {
      void queues.digest.add("digest-now", { kind: "digest" });
    }
    if (command.action === "stop") {
      void runtimeStop().finally(() => process.exit(0));
    }
    void beat();
  });

  const collectors = listCollectors().map((collector) => collector.name);
  ops("worker", "boot", `collectors=${collectors.join(",")}`, { data: { collectors } });
  ops("worker", "boot", `queues=${QUEUE_NAMES.join(",")}`);
  ops("worker", "boot", `schedulers=${schedulers.join(",")} (DIGEST 00:00/08:00/16:00 UTC)`);
  ops("worker", "boot", `news_live=${config.NEWS_LIVE ? "1" : "0"} tape_live=${tapeEnabled ? "1" : "0"} telegram_dry_run=${config.TELEGRAM_DRY_RUN ? "1" : "0"}`);
  ops("news", "wait", `Waiting for first news cron. ${formatWait(nextNewsAt())}`, { level: "wait" });
  ops("tape", "wait", `Waiting for first tape cron. ${formatWait(nextTapeAt())}`, { level: "wait" });
  ops("digest", "wait", `Waiting for DIGEST. ${formatWait(nextDigestAt())}`, { level: "wait" });
  await beat();
  const heartbeatTimer = setInterval(() => {
    void beat();
  }, 5_000);

  async function runtimeStop() {
    clearInterval(heartbeatTimer);
    ops("worker", "stop", "Worker shutting down");
    liveTape?.stop();
    await tapePool?.end();
    await Promise.all(processors.map((worker) => worker.close()));
    bus.close();
    await closeQueues(queues, queueConnection);
    workerConnection.disconnect();
    opsConnection.disconnect();
  }

  return {
    collectors,
    queues: QUEUE_NAMES,
    schedulers,
    stop: runtimeStop,
  };
}

const entry = process.argv[1];
const isMain =
  entry !== undefined && import.meta.url === pathToFileURL(resolve(entry)).href;
if (isMain) {
  startWorker()
    .then((runtime) => {
      const shutdown = () => {
        void runtime.stop().finally(() => process.exit(0));
      };
      process.on("SIGINT", shutdown);
      process.on("SIGTERM", shutdown);
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(message);
      process.exit(1);
    });
}
