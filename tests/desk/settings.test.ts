import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pollNews } from "../../src/collectors/news/poll.js";
import { DEFAULT_DESK_SETTINGS } from "../../src/desk/defaults.js";
import { applyDeskPut, enabledSources, loadDeskSettings, loadNewsSources, saveDeskSettings, saveNewsSources } from "../../src/desk/settings.js";
import { createPool } from "../../src/db/client.js";
import { fuse } from "../../src/fusion/index.js";
import { sendHeadlines } from "../../src/telegram/send.js";
import type { Event, FeatureSnapshot } from "../../src/domain/index.js";

const databaseUrl = process.env.DATABASE_URL;

describe.skipIf(!databaseUrl)("desk settings persistence", { timeout: 20_000 }, () => {
  const pool = createPool(databaseUrl ?? "");
  let originalSources: Awaited<ReturnType<typeof loadNewsSources>> = [];

  beforeAll(async () => {
    await loadDeskSettings(pool);
    originalSources = await loadNewsSources(pool);
  });

  afterAll(async () => {
    await saveDeskSettings(pool, DEFAULT_DESK_SETTINGS);
    if (originalSources.length > 0) {
      await saveNewsSources(pool, originalSources);
    }
    await pool.end();
  });

  it("save then load changes the next sendHeadlines and fuse call", async () => {
    const sent: string[] = [];
    const transport = { async send(_id: string, html: string) { sent.push(html); } };
    const item = {
      sourceId: "edgar",
      title: "SCHEDULE 13D/A - Fund 1 Investments, LLC (Filed by)",
      url: "https://www.sec.gov/Archives/edgar/desk-test",
    };

    await saveDeskSettings(pool, DEFAULT_DESK_SETTINGS);
    const balanced = await loadDeskSettings(pool);
    await sendHeadlines(transport, { chatId: "1", items: [item], dryRun: false, settings: balanced });
    expect(sent).toHaveLength(1);

    await saveDeskSettings(pool, { ...DEFAULT_DESK_SETTINGS, toneMode: "strict", headlineSend: "skip_neutral" });
    const strict = await loadDeskSettings(pool);
    sent.length = 0;
    const second = await sendHeadlines(transport, { chatId: "1", items: [item], dryRun: false, settings: strict });
    expect(second[0]?.sent).toBe(false);
    if (second[0] && !second[0].sent) {
      expect(second[0].reason).toBe("filtered");
    }
    expect(sent).toEqual([]);

    const event: Event = {
      id: "ev_desk",
      class: "ETF_INFLOW",
      assets: ["BTC"],
      source: "coindesk",
      url: "https://example.com/desk-fuse",
      fingerprint: "fp-desk",
      novelty: 1,
      credibility: 0.56,
      polarity: 0.8,
      occurredAt: new Date("2026-09-08T12:00:00.000Z"),
    };
    const snapshot: FeatureSnapshot = {
      ts: new Date("2026-09-08T12:00:00.000Z"),
      asset: "BTC",
      exchangeNetflowZ: null,
      stablecoinDeltaZ: null,
      funding: null,
      oiChangePct: null,
      cvd: 6,
      volRegime: "mid",
    };
    expect(fuse({ event, snapshot })).toEqual([]);
    await saveDeskSettings(pool, { ...DEFAULT_DESK_SETTINGS, highCredibility: 0.5 });
    const looseFlash = await loadDeskSettings(pool);
    expect(
      fuse({
        event,
        snapshot,
        thresholds: {
          highNovelty: looseFlash.highNovelty,
          highCredibility: looseFlash.highCredibility,
          fadeCredibility: looseFlash.fadeCredibility,
          loudNarrative: looseFlash.loudNarrative,
        },
      })[0]?.kind,
    ).toBe("FLASH");
  });

  it("poll uses enabled sources only", async () => {
    const catalog = await loadNewsSources(pool);
    const onlyCoinDesk = catalog.map((source) => ({ ...source, enabled: source.id === "coindesk" }));
    await saveNewsSources(pool, onlyCoinDesk);
    const hits: string[] = [];
    await pollNews({
      sources: enabledSources(await loadNewsSources(pool)),
      fetchXml: async (source) => {
        hits.push(source.id);
        return "<rss><channel></channel></rss>";
      },
    });
    expect(hits).toEqual(["coindesk"]);
    await saveNewsSources(pool, catalog);
  });

  it("upserts desk_settings when the row is missing", async () => {
    await pool.query("DELETE FROM desk_settings WHERE id = 1");
    const saved = await saveDeskSettings(pool, { ...DEFAULT_DESK_SETTINGS, headlineSend: "skip_neutral", toneMode: "strict" });
    expect(saved.headlineSend).toBe("skip_neutral");
    expect(saved.toneMode).toBe("strict");
    const loaded = await loadDeskSettings(pool);
    expect(loaded.headlineSend).toBe("skip_neutral");
    expect(loaded.toneMode).toBe("strict");
  });

  it("persists headline_send when source writes fail", async () => {
    const before = await loadNewsSources(pool);
    const result = await applyDeskPut(pool, {
      settings: { ...DEFAULT_DESK_SETTINGS, headlineSend: "skip_neutral", toneMode: "strict" },
      sources: [
        { id: "dup", name: "A", url: "https://example.com/a", rank: 70, kind: "rss", enabled: true },
        { id: "dup", name: "B", url: "https://example.com/b", rank: 71, kind: "rss", enabled: true },
      ],
    });
    expect(result.settings.headlineSend).toBe("skip_neutral");
    expect(result.sourcesError).toBeTruthy();
    expect(result.sources.map((source) => source.id).sort()).toEqual(before.map((source) => source.id).sort());

    const skipped = await applyDeskPut(pool, {
      settings: { ...DEFAULT_DESK_SETTINGS, headlineSend: "skip_neutral", toneMode: "strict" },
      sourcesError: "source kind must be rss, atom, html, or esplora",
    });
    expect(skipped.settings.headlineSend).toBe("skip_neutral");
    expect(skipped.sourcesError).toMatch(/source kind/);

    const sent: string[] = [];
    const rows = await sendHeadlines(
      { async send(_id: string, html: string) { sent.push(html); } },
      {
        chatId: "1",
        dryRun: false,
        settings: result.settings,
        items: [
          { sourceId: "edgar", title: "SCHEDULE 13D/A - Fund 1 Investments, LLC (Filed by)", url: "https://www.sec.gov/x" },
          { sourceId: "coindesk", title: "Spot ETF posts record inflow", url: "https://www.coindesk.com/etf" },
        ],
      },
    );
    expect(rows[0]?.sent).toBe(false);
    if (rows[0] && !rows[0].sent) {
      expect(rows[0].reason).toBe("filtered");
    }
    expect(rows[1]?.sent).toBe(true);
    expect(sent).toHaveLength(1);
  });
});
