import type pg from "pg";
import { SEED_NEWS_SOURCES, DEFAULT_DESK_SETTINGS } from "./defaults.js";
import type { DeskSettings, NewsSourceRow } from "./types.js";

const DDL = `
CREATE TABLE IF NOT EXISTS news_sources (
  id text PRIMARY KEY,
  name text NOT NULL,
  url text NOT NULL,
  rank integer NOT NULL CHECK (rank >= 0 AND rank <= 100),
  kind text NOT NULL CHECK (kind IN ('rss', 'atom', 'html')),
  enabled boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS desk_settings (
  id integer PRIMARY KEY,
  headline_enabled boolean NOT NULL DEFAULT true,
  tone_mode text NOT NULL DEFAULT 'balanced' CHECK (tone_mode IN ('loose', 'balanced', 'strict')),
  headline_send text NOT NULL DEFAULT 'all' CHECK (headline_send IN ('all', 'skip_neutral', 'directional_only')),
  bullish_terms text[] NOT NULL DEFAULT '{}',
  bearish_terms text[] NOT NULL DEFAULT '{}',
  flash_enabled boolean NOT NULL DEFAULT true,
  fade_enabled boolean NOT NULL DEFAULT true,
  high_novelty double precision NOT NULL DEFAULT 0.8,
  high_credibility double precision NOT NULL DEFAULT 0.7,
  fade_credibility double precision NOT NULL DEFAULT 0.5,
  loud_narrative double precision NOT NULL DEFAULT 0.4,
  flash_daily_cap integer NOT NULL DEFAULT 4,
  news_batch_limit integer NOT NULL DEFAULT 12,
  updated_at timestamptz NOT NULL DEFAULT now()
);
`;

export async function ensureDeskTables(pool: pg.Pool): Promise<void> {
  await pool.query(DDL);
  const existing = await pool.query("SELECT id FROM news_sources");
  if (existing.rowCount === 0) {
    for (const source of SEED_NEWS_SOURCES) {
      await pool.query(
        `INSERT INTO news_sources (id, name, url, rank, kind, enabled)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO NOTHING`,
        [source.id, source.name, source.url, source.rank, source.kind, source.enabled],
      );
    }
  }
  await pool.query(
    `INSERT INTO desk_settings (
       id, headline_enabled, tone_mode, headline_send, bullish_terms, bearish_terms,
       flash_enabled, fade_enabled, high_novelty, high_credibility, fade_credibility,
       loud_narrative, flash_daily_cap, news_batch_limit
     ) VALUES (
       1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
     ) ON CONFLICT (id) DO NOTHING`,
    [
      DEFAULT_DESK_SETTINGS.headlineEnabled,
      DEFAULT_DESK_SETTINGS.toneMode,
      DEFAULT_DESK_SETTINGS.headlineSend,
      DEFAULT_DESK_SETTINGS.bullishTerms,
      DEFAULT_DESK_SETTINGS.bearishTerms,
      DEFAULT_DESK_SETTINGS.flashEnabled,
      DEFAULT_DESK_SETTINGS.fadeEnabled,
      DEFAULT_DESK_SETTINGS.highNovelty,
      DEFAULT_DESK_SETTINGS.highCredibility,
      DEFAULT_DESK_SETTINGS.fadeCredibility,
      DEFAULT_DESK_SETTINGS.loudNarrative,
      DEFAULT_DESK_SETTINGS.flashDailyCap,
      DEFAULT_DESK_SETTINGS.newsBatchLimit,
    ],
  );
}

function mapSettings(row: {
  headline_enabled: boolean;
  tone_mode: DeskSettings["toneMode"];
  headline_send: DeskSettings["headlineSend"];
  bullish_terms: string[];
  bearish_terms: string[];
  flash_enabled: boolean;
  fade_enabled: boolean;
  high_novelty: number;
  high_credibility: number;
  fade_credibility: number;
  loud_narrative: number;
  flash_daily_cap: number;
  news_batch_limit: number;
}): DeskSettings {
  return {
    headlineEnabled: row.headline_enabled,
    toneMode: row.tone_mode,
    headlineSend: row.headline_send,
    bullishTerms: row.bullish_terms ?? [],
    bearishTerms: row.bearish_terms ?? [],
    flashEnabled: row.flash_enabled,
    fadeEnabled: row.fade_enabled,
    highNovelty: Number(row.high_novelty),
    highCredibility: Number(row.high_credibility),
    fadeCredibility: Number(row.fade_credibility),
    loudNarrative: Number(row.loud_narrative),
    flashDailyCap: Number(row.flash_daily_cap),
    newsBatchLimit: Number(row.news_batch_limit),
  };
}

export async function loadDeskSettings(pool: pg.Pool): Promise<DeskSettings> {
  await ensureDeskTables(pool);
  const result = await pool.query<{
    headline_enabled: boolean;
    tone_mode: DeskSettings["toneMode"];
    headline_send: DeskSettings["headlineSend"];
    bullish_terms: string[];
    bearish_terms: string[];
    flash_enabled: boolean;
    fade_enabled: boolean;
    high_novelty: number;
    high_credibility: number;
    fade_credibility: number;
    loud_narrative: number;
    flash_daily_cap: number;
    news_batch_limit: number;
  }>("SELECT * FROM desk_settings WHERE id = 1");
  const row = result.rows[0];
  return row ? mapSettings(row) : { ...DEFAULT_DESK_SETTINGS };
}

export async function saveDeskSettings(pool: pg.Pool, settings: DeskSettings): Promise<DeskSettings> {
  await ensureDeskTables(pool);
  await pool.query(
    `UPDATE desk_settings SET
       headline_enabled = $1,
       tone_mode = $2,
       headline_send = $3,
       bullish_terms = $4,
       bearish_terms = $5,
       flash_enabled = $6,
       fade_enabled = $7,
       high_novelty = $8,
       high_credibility = $9,
       fade_credibility = $10,
       loud_narrative = $11,
       flash_daily_cap = $12,
       news_batch_limit = $13,
       updated_at = now()
     WHERE id = 1`,
    [
      settings.headlineEnabled,
      settings.toneMode,
      settings.headlineSend,
      settings.bullishTerms,
      settings.bearishTerms,
      settings.flashEnabled,
      settings.fadeEnabled,
      settings.highNovelty,
      settings.highCredibility,
      settings.fadeCredibility,
      settings.loudNarrative,
      settings.flashDailyCap,
      settings.newsBatchLimit,
    ],
  );
  return loadDeskSettings(pool);
}

export async function loadNewsSources(pool: pg.Pool): Promise<NewsSourceRow[]> {
  await ensureDeskTables(pool);
  const result = await pool.query<{
    id: string;
    name: string;
    url: string;
    rank: number;
    kind: NewsSourceRow["kind"];
    enabled: boolean;
  }>("SELECT id, name, url, rank, kind, enabled FROM news_sources ORDER BY rank DESC, id");
  if (result.rows.length === 0) {
    return SEED_NEWS_SOURCES.map((source) => ({ ...source }));
  }
  return result.rows;
}

export async function saveNewsSources(pool: pg.Pool, sources: NewsSourceRow[]): Promise<NewsSourceRow[]> {
  await ensureDeskTables(pool);
  await pool.query("DELETE FROM news_sources");
  for (const source of sources) {
    await pool.query(
      `INSERT INTO news_sources (id, name, url, rank, kind, enabled)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [source.id, source.name, source.url, source.rank, source.kind, source.enabled],
    );
  }
  return loadNewsSources(pool);
}

export function enabledSources(sources: NewsSourceRow[]): NewsSourceRow[] {
  const live = sources.filter((source) => source.enabled);
  return live.length > 0 ? live : SEED_NEWS_SOURCES.filter((source) => source.enabled);
}
