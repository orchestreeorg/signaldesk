import "dotenv/config";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Worker } from "bullmq";
import { createLlmFromConfig, MemoryNoveltyIndex } from "../classify/index.js";
import {
  createNewsCollector,
  NEWS_BATCH_LIMIT,
  persistRawItems,
  pollNews,
} from "../collectors/news/index.js";
import { noopCollector } from "../collectors/noop.js";
import { listCollectors, registerCollector, runCollectors } from "../collectors/registry.js";
import { createTapeCollector, startLiveTape } from "../collectors/tape/index.js";
import { ensureMarksTable, saveMark } from "../collectors/tape/marks.js";
import { loadConfig } from "../config.js";
import { insertAlert } from "../db/alerts.js";
import { createDb, createPool } from "../db/client.js";
import { upsertEvent } from "../db/events.js";
import { quietSnapshot, runNewsDesk } from "../jobs/newsDesk.js";
import { fillOutcomes } from "../jobs/outcomes.js";
import { dummyAlert, registerSchedules } from "../jobs/schedule.js";
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
  sendAlert,
} from "../telegram/index.js";

export async function startWorker(): Promise<{
  collectors: string[];
  queues: readonly string[];
  schedulers: string[];
  stop: () => Promise<void>;
}> {
  const config = loadConfig();
  const tapeEnabled = config.TAPE_LIVE && !process.env.VITEST;
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

  const processors = [
    new Worker("tape", async () => {
      if (liveTape) {
        await liveTape.runtime.pollOi();
        return;
      }
      await runNamed("tape");
    }, jobOpts),
    new Worker("news", async () => {
      if (!config.NEWS_LIVE) {
        await runNamed("news");
        return;
      }
      const pool = createPool(config.DATABASE_URL);
      try {
        const items = await persistRawItems(pool, await pollNews(), { limit: NEWS_BATCH_LIMIT });
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
    }, jobOpts),
    new Worker("outcomes", async () => {
      const pool = createPool(config.DATABASE_URL);
      try {
        await fillOutcomes(createDb(pool), (sql, params) => pool.query(sql, params));
      } finally {
        await pool.end();
      }
    }, jobOpts),
    new Worker("digest", async () => {
      const chatId = config.TELEGRAM_CHAT_ID;
      if (!chatId) {
        console.log("digest: no TELEGRAM_CHAT_ID, skip");
        return;
      }
      await sendAlert(store, transport, {
        chatId,
        alert: dummyAlert("DIGEST"),
        dryRun: config.TELEGRAM_DRY_RUN,
      });
    }, jobOpts),
  ];
  for (const worker of processors) {
    worker.on("error", (error: Error) => {
      console.error(`worker: ${error.message}`);
    });
  }

  const collectors = listCollectors().map((collector) => collector.name);
  console.log(`worker: collectors=${collectors.join(",")}`);
  console.log(`worker: queues=${QUEUE_NAMES.join(",")}`);
  console.log(`worker: digest=${schedulers.join(",")} at 00:00/08:00/16:00 UTC`);
  console.log(`worker: news_live=${config.NEWS_LIVE ? "1" : "0"}`);
  console.log(`worker: tape_live=${tapeEnabled ? "1" : "0"}`);

  return {
    collectors,
    queues: QUEUE_NAMES,
    schedulers,
    async stop() {
      liveTape?.stop();
      await tapePool?.end();
      await Promise.all(processors.map((worker) => worker.close()));
      await closeQueues(queues, queueConnection);
      workerConnection.disconnect();
    },
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
