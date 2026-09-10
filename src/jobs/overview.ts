import type pg from "pg";
import { ensureRawItemTable } from "../collectors/news/store.js";
import { loadDeskSettings } from "../desk/settings.js";
import { DEFAULT_DESK_SETTINGS } from "../desk/defaults.js";
import type { DeskSettings } from "../desk/types.js";
import type { Asset, EventClass, Horizon } from "../domain/index.js";
import { headlineTone, type HeadlineTone } from "../telegram/tone.js";
import {
  countCalls,
  digestWindowStart,
  formatMixScore,
  formatRealized,
  pickLastCall,
  scoreNewsMix,
  type DigestAlertRow,
  type DigestCallCounts,
  type DigestLastCall,
  type DigestMix,
} from "./digest.js";
import { loadCoingeckoSentiment, type OverviewSentiment } from "./coingeckoSentiment.js";
import { loadCmcFearGreed, type OverviewFearGreed } from "./cmcFearGreed.js";
import { getFredOvxObservations, loadFredOvx, type OverviewOvx } from "./fredOvx.js";
import { getGprDailyObservations, loadGprDaily, type OverviewGpr } from "./gprDaily.js";
import { getGoldPriceObservations, loadGoldPrice, type OverviewGold } from "./goldPrice.js";
import { getFredSp500Observations, loadFredSp500, type OverviewSp500 } from "./fredSp500.js";
import {
  loadMacroHistory,
  persistMacroObservations,
  type MacroObservationInput,
} from "./macroObservations.js";
import { buildMacroIndex, type OverviewMacroIndex } from "./macroScale.js";

export const OVERVIEW_HEADLINE_LIMIT = 40;
export const OVERVIEW_MEMPOOL_LIMIT = 8;
export const MEMPOOL_SOURCE_ID = "mempool";

export type OverviewToneTab = "ALL" | HeadlineTone;

export type OverviewItemRow = {
  title: string;
  url: string;
  sourceId: string;
  publishedAt: Date;
};

export type OverviewHeadline = {
  title: string;
  url: string;
  href: string | null;
  sourceId: string;
  publishedAt: string;
  tone: HeadlineTone;
};

export type OverviewLargeBtc = OverviewHeadline & {
  btc: number | null;
};

export type OverviewLastCall = {
  kind: "FLASH" | "FADE";
  asset: Asset;
  why: string;
  realized: number | null;
  realizedText: string;
  horizon: Horizon | null;
};

export type OverviewClassCount = {
  class: EventClass | string;
  n: number;
};

export type OverviewMarks = {
  BTC?: number;
  ETH?: number;
};

export type OverviewReport = {
  now: Date;
  mix: DigestMix;
  mixLabel: string;
  calls: DigestCallCounts;
  lastCall: OverviewLastCall | null;
  largeBtc: OverviewLargeBtc[];
  headlines: OverviewHeadline[];
  classified: OverviewClassCount[] | null;
  marks: OverviewMarks | null;
  sentiment: OverviewSentiment | null;
  fearGreed: OverviewFearGreed | null;
  ovx: OverviewOvx | null;
  gpr: OverviewGpr | null;
  gold: OverviewGold | null;
  sp500: OverviewSp500 | null;
  macroIndex: OverviewMacroIndex | null;
};

export function safeHref(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export function pickLargeBtc(
  items: OverviewItemRow[],
  limit = OVERVIEW_MEMPOOL_LIMIT,
): OverviewItemRow[] {
  return items
    .filter((item) => item.sourceId === MEMPOOL_SOURCE_ID)
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
    .slice(0, limit);
}

export function capHeadlines(items: OverviewItemRow[], limit = OVERVIEW_HEADLINE_LIMIT): OverviewItemRow[] {
  return items
    .filter((item) => item.sourceId !== MEMPOOL_SOURCE_ID)
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
    .slice(0, limit);
}

export function parseBtcFromTitle(title: string): number | null {
  const match = title.match(/([\d,]+(?:\.\d+)?)\s*BTC\b/i);
  if (!match) {
    return null;
  }
  const n = Number((match[1] ?? "").replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function toHeadline(item: OverviewItemRow, settings: DeskSettings): OverviewHeadline {
  return {
    title: item.title,
    url: item.url,
    href: safeHref(item.url),
    sourceId: item.sourceId,
    publishedAt: item.publishedAt.toISOString(),
    tone: headlineTone(item.title, settings),
  };
}

export function toLargeBtc(item: OverviewItemRow, settings: DeskSettings): OverviewLargeBtc {
  return { ...toHeadline(item, settings), btc: parseBtcFromTitle(item.title) };
}

export function filterHeadlinesByTone(
  headlines: OverviewHeadline[],
  tab: OverviewToneTab,
): OverviewHeadline[] {
  if (tab === "ALL") {
    return headlines;
  }
  return headlines.filter((row) => row.tone === tab);
}

export function lastCallView(last: DigestLastCall | null): OverviewLastCall | null {
  if (!last) {
    return null;
  }
  return {
    kind: last.kind,
    asset: last.asset,
    why: last.why,
    realized: last.realized,
    realizedText: last.realized === null ? last.realizedLabel : formatRealized(last.realized),
    horizon: last.horizon,
  };
}

export function buildOverviewReport(input: {
  now: Date;
  alerts: DigestAlertRow[];
  items: OverviewItemRow[];
  settings?: DeskSettings;
  classified?: OverviewClassCount[] | null;
  marks?: OverviewMarks | null;
  sentiment?: OverviewSentiment | null;
  fearGreed?: OverviewFearGreed | null;
  ovx?: OverviewOvx | null;
  gpr?: OverviewGpr | null;
  gold?: OverviewGold | null;
  sp500?: OverviewSp500 | null;
  macroIndex?: OverviewMacroIndex | null;
}): OverviewReport {
  const settings = input.settings ?? DEFAULT_DESK_SETTINGS;
  const mix = scoreNewsMix(
    input.items.map((item) => ({ title: item.title, publishedAt: item.publishedAt })),
    settings,
  );
  return {
    now: input.now,
    mix,
    mixLabel: formatMixScore(mix.score),
    calls: countCalls(input.alerts),
    lastCall: lastCallView(pickLastCall(input.alerts)),
    largeBtc: pickLargeBtc(input.items).map((item) => toLargeBtc(item, settings)),
    headlines: capHeadlines(input.items, 500).map((item) => toHeadline(item, settings)),
    classified: input.classified && input.classified.length > 0 ? input.classified : null,
    marks: input.marks && (input.marks.BTC !== undefined || input.marks.ETH !== undefined) ? input.marks : null,
    sentiment: input.sentiment ?? null,
    fearGreed: input.fearGreed ?? null,
    ovx: input.ovx ?? null,
    gpr: input.gpr ?? null,
    gold: input.gold ?? null,
    sp500: input.sp500 ?? null,
    macroIndex: input.macroIndex ?? null,
  };
}

async function loadOverviewAlerts(pool: pg.Pool, from: Date): Promise<DigestAlertRow[]> {
  try {
    const result = await pool.query<{
      id: string;
      kind: string;
      asset: string;
      why: string[];
      at: Date;
      realized_24h: number | null;
      realized_4h: number | null;
    }>(
      `SELECT a.id, a.kind, a.asset, a.why, COALESCE(a.sent_at, a.created_at) AS at,
              MAX(CASE WHEN o.horizon = '24h' THEN o.realized_return END) AS realized_24h,
              MAX(CASE WHEN o.horizon = '4h' THEN o.realized_return END) AS realized_4h
         FROM alerts a
         LEFT JOIN outcomes o ON o.alert_id = a.id
        WHERE COALESCE(a.sent_at, a.created_at) >= $1
          AND a.kind IN ('FLASH', 'FADE', 'CONFIRM', 'INVALIDATE')
        GROUP BY a.id, a.kind, a.asset, a.why, COALESCE(a.sent_at, a.created_at)
        ORDER BY at DESC`,
      [from],
    );
    return result.rows.map((row) => ({
      id: row.id,
      kind: row.kind as DigestAlertRow["kind"],
      asset: row.asset as Asset,
      why: row.why ?? [],
      at: row.at,
      realized24h: row.realized_24h,
      realized4h: row.realized_4h,
    }));
  } catch {
    return [];
  }
}

async function loadOverviewItems(pool: pg.Pool, from: Date): Promise<OverviewItemRow[]> {
  await ensureRawItemTable(pool);
  const result = await pool.query<{
    title: string;
    url: string;
    source_id: string;
    published_at: Date;
  }>(
    `SELECT title, url, source_id, published_at
       FROM raw_items
      WHERE published_at >= $1
      ORDER BY published_at DESC`,
    [from],
  );
  return result.rows.map((row) => ({
    title: row.title,
    url: row.url,
    sourceId: row.source_id,
    publishedAt: row.published_at,
  }));
}

async function loadClassified(pool: pg.Pool, from: Date): Promise<OverviewClassCount[] | null> {
  try {
    const result = await pool.query<{ class: string; n: string | number }>(
      `SELECT class, COUNT(*)::int AS n
         FROM events
        WHERE COALESCE(occurred_at, created_at) >= $1
        GROUP BY class
        ORDER BY n DESC, class ASC`,
      [from],
    );
    if (result.rows.length === 0) {
      return null;
    }
    return result.rows.map((row) => ({ class: row.class, n: Number(row.n) }));
  } catch {
    return null;
  }
}

async function loadMarks(pool: pg.Pool): Promise<OverviewMarks | null> {
  try {
    const result = await pool.query<{ asset: string; mid: number }>(
      `SELECT DISTINCT ON (asset) asset, mid
         FROM price_marks
        WHERE asset IN ('BTC', 'ETH')
        ORDER BY asset, ts DESC`,
    );
    if (result.rows.length === 0) {
      return null;
    }
    const marks: OverviewMarks = {};
    for (const row of result.rows) {
      if (row.asset === "BTC" || row.asset === "ETH") {
        marks[row.asset] = row.mid;
      }
    }
    return Object.keys(marks).length > 0 ? marks : null;
  } catch {
    return null;
  }
}

export async function buildOverview(
  pool: pg.Pool,
  now: Date,
  settings?: DeskSettings,
): Promise<OverviewReport> {
  const from = digestWindowStart(now);
  const resolved = settings ?? (await loadDeskSettings(pool).catch(() => DEFAULT_DESK_SETTINGS));
  const [alerts, items, classified, marks, sentiment, fearGreed, ovx, gpr, gold, sp500] = await Promise.all([
    loadOverviewAlerts(pool, from),
    loadOverviewItems(pool, from),
    loadClassified(pool, from),
    loadMarks(pool),
    loadCoingeckoSentiment({ now }),
    loadCmcFearGreed({ now }),
    loadFredOvx({ now }),
    loadGprDaily({ now }),
    loadGoldPrice({ now }),
    loadFredSp500({ now }),
  ]);
  const report = buildOverviewReport({
    now,
    alerts,
    items,
    settings: resolved,
    classified,
    marks,
    sentiment,
    fearGreed,
    ovx,
    gpr,
    gold,
    sp500,
  });
  const observations: MacroObservationInput[] = [
    ...getFredOvxObservations(),
    ...getGprDailyObservations(),
    ...getGoldPriceObservations(),
    ...getFredSp500Observations(),
  ];
  if (sentiment) {
    observations.push({
      source: "coingecko",
      asOf: sentiment.asOf,
      value: sentiment.score,
      aux: { up: sentiment.up, down: sentiment.down },
    });
  }
  if (fearGreed) {
    observations.push({
      source: "cmc",
      asOf: fearGreed.asOf,
      value: fearGreed.value,
      aux: { classification: fearGreed.classification, greed: fearGreed.greed, fear: fearGreed.fear },
    });
  }
  if (ovx) {
    observations.push({
      source: "ovx",
      asOf: ovx.asOf,
      value: ovx.value,
      aux: { classification: ovx.classification, stress: ovx.stress, calm: ovx.calm },
    });
  }
  if (gpr) {
    observations.push({
      source: "gpr",
      asOf: gpr.asOf,
      value: gpr.value,
      aux: { classification: gpr.classification, stress: gpr.stress, calm: gpr.calm },
    });
  }
  if (gold) {
    observations.push({
      source: "gold",
      asOf: gold.asOf,
      value: gold.value,
      aux: { symbol: gold.symbol, changePct: gold.changePct },
    });
  }
  if (sp500) {
    observations.push({
      source: "sp500",
      asOf: sp500.asOf,
      value: sp500.value,
      aux: { seriesId: sp500.seriesId, changePct: sp500.changePct },
    });
  }
  if (report.mix.score !== null) {
    observations.push({
      source: "news_mix",
      asOf: now,
      value: report.mix.score,
      aux: { bull: report.mix.bull, bear: report.mix.bear, neutral: report.mix.neutral },
    });
  }
  try {
    await persistMacroObservations(pool, observations);
    const history = await loadMacroHistory(pool, now);
    return { ...report, macroIndex: buildMacroIndex(history) };
  } catch {
    return report;
  }
}

export function serializeOverview(report: OverviewReport) {
  return {
    now: report.now.toISOString(),
    mix: report.mix,
    mixLabel: report.mixLabel,
    calls: report.calls,
    lastCall: report.lastCall,
    largeBtc: report.largeBtc,
    headlines: report.headlines,
    classified: report.classified,
    marks: report.marks,
    sentiment: report.sentiment,
    fearGreed: report.fearGreed,
    ovx: report.ovx,
    gpr: report.gpr,
    gold: report.gold,
    sp500: report.sp500,
    macroIndex: report.macroIndex,
  };
}
