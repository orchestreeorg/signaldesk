import { NEWS_SOURCE_KINDS, type NewsSourceKind } from "../collectors/news/sources.js";
import { HEADLINE_SEND_MODES, TONE_MODES, type DeskSettings, type NewsSourceRow } from "./types.js";

export type DeskBundle = {
  settings: DeskSettings;
  sources: NewsSourceRow[];
};

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asNumber(value: unknown, fallback: number, min: number, max: number): number | string {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < min || n > max) {
    return `expected a number between ${min} and ${max}`;
  }
  return n;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function asToneMode(value: unknown): DeskSettings["toneMode"] | string {
  if (typeof value === "string" && (TONE_MODES as readonly string[]).includes(value)) {
    return value as DeskSettings["toneMode"];
  }
  return "tone_mode must be loose, balanced, or strict";
}

function asSendMode(value: unknown): DeskSettings["headlineSend"] | string {
  if (typeof value === "string" && (HEADLINE_SEND_MODES as readonly string[]).includes(value)) {
    return value as DeskSettings["headlineSend"];
  }
  return "headline_send must be all, skip_neutral, or directional_only";
}

export function parseSettings(raw: Record<string, unknown>, fallback: DeskSettings): DeskSettings | { error: string } {
  const toneMode = asToneMode(raw.toneMode ?? raw.tone_mode ?? fallback.toneMode);
  if (typeof toneMode === "string" && !(TONE_MODES as readonly string[]).includes(toneMode)) {
    return { error: toneMode };
  }
  const headlineSend = asSendMode(raw.headlineSend ?? raw.headline_send ?? fallback.headlineSend);
  if (typeof headlineSend === "string" && !(HEADLINE_SEND_MODES as readonly string[]).includes(headlineSend)) {
    return { error: headlineSend };
  }
  const highNovelty = asNumber(raw.highNovelty ?? raw.high_novelty ?? fallback.highNovelty, fallback.highNovelty, 0, 1);
  const highCredibility = asNumber(
    raw.highCredibility ?? raw.high_credibility ?? fallback.highCredibility,
    fallback.highCredibility,
    0,
    1,
  );
  const fadeCredibility = asNumber(
    raw.fadeCredibility ?? raw.fade_credibility ?? fallback.fadeCredibility,
    fallback.fadeCredibility,
    0,
    1,
  );
  const loudNarrative = asNumber(
    raw.loudNarrative ?? raw.loud_narrative ?? fallback.loudNarrative,
    fallback.loudNarrative,
    0,
    1,
  );
  const flashDailyCap = asNumber(
    raw.flashDailyCap ?? raw.flash_daily_cap ?? fallback.flashDailyCap,
    fallback.flashDailyCap,
    0,
    100,
  );
  const newsBatchLimit = asNumber(
    raw.newsBatchLimit ?? raw.news_batch_limit ?? fallback.newsBatchLimit,
    fallback.newsBatchLimit,
    1,
    100,
  );
  for (const [label, value] of [
    ["high_novelty", highNovelty],
    ["high_credibility", highCredibility],
    ["fade_credibility", fadeCredibility],
    ["loud_narrative", loudNarrative],
    ["flash_daily_cap", flashDailyCap],
    ["news_batch_limit", newsBatchLimit],
  ] as const) {
    if (typeof value === "string") {
      return { error: `${label}: ${value}` };
    }
  }
  return {
    headlineEnabled: asBoolean(raw.headlineEnabled ?? raw.headline_enabled, fallback.headlineEnabled),
    toneMode: toneMode as DeskSettings["toneMode"],
    headlineSend: headlineSend as DeskSettings["headlineSend"],
    bullishTerms: Array.isArray(raw.bullishTerms ?? raw.bullish_terms)
      ? asStringArray(raw.bullishTerms ?? raw.bullish_terms)
      : fallback.bullishTerms,
    bearishTerms: Array.isArray(raw.bearishTerms ?? raw.bearish_terms)
      ? asStringArray(raw.bearishTerms ?? raw.bearish_terms)
      : fallback.bearishTerms,
    flashEnabled: asBoolean(raw.flashEnabled ?? raw.flash_enabled, fallback.flashEnabled),
    fadeEnabled: asBoolean(raw.fadeEnabled ?? raw.fade_enabled, fallback.fadeEnabled),
    highNovelty: highNovelty as number,
    highCredibility: highCredibility as number,
    fadeCredibility: fadeCredibility as number,
    loudNarrative: loudNarrative as number,
    flashDailyCap: Math.round(flashDailyCap as number),
    newsBatchLimit: Math.round(newsBatchLimit as number),
  };
}

export function parseSources(raw: unknown): NewsSourceRow[] | { error: string } {
  if (!Array.isArray(raw)) {
    return { error: "sources must be an array" };
  }
  const sources: NewsSourceRow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") {
      return { error: "each source must be an object" };
    }
    const row = item as Record<string, unknown>;
    const id = String(row.id ?? "").trim();
    const name = String(row.name ?? "").trim();
    const url = String(row.url ?? "").trim();
    const rank = Number(row.rank);
    const kind = String(row.kind ?? "").trim() as NewsSourceKind;
    if (!id) {
      return { error: "source id is required" };
    }
    if (!name) {
      return { error: "source name is required" };
    }
    if (!url) {
      return { error: "source URL is required" };
    }
    if (!Number.isFinite(rank) || rank < 0 || rank > 100) {
      return { error: "source rank must be between 0 and 100" };
    }
    if (!(NEWS_SOURCE_KINDS as readonly string[]).includes(kind)) {
      return { error: "source kind must be rss, atom, or html" };
    }
    sources.push({
      id,
      name,
      url,
      rank,
      kind,
      enabled: row.enabled !== false,
    });
  }
  return sources;
}

export function parseDeskBundle(raw: unknown, fallback: DeskSettings): DeskBundle | { error: string } {
  if (!raw || typeof raw !== "object") {
    return { error: "body must be an object" };
  }
  const body = raw as Record<string, unknown>;
  const settings = parseSettings((body.settings as Record<string, unknown>) ?? body, fallback);
  if ("error" in settings) {
    return settings;
  }
  const sources = parseSources(body.sources);
  if ("error" in sources) {
    return sources;
  }
  return { settings, sources };
}
