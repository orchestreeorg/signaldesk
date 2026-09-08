import type pg from "pg";
import { collapseRawItems, isSameStory } from "./collapse.js";
import type { RawItem } from "./types.js";

const DDL = `
CREATE TABLE IF NOT EXISTS raw_items (
  url text PRIMARY KEY,
  source_id text NOT NULL,
  source_rank integer NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  simhash text NOT NULL,
  published_at timestamptz NOT NULL
);
`;

export async function ensureRawItemTable(pool: pg.Pool): Promise<void> {
  await pool.query(DDL);
}

export async function persistRawItems(pool: pg.Pool, items: RawItem[]): Promise<RawItem[]> {
  await ensureRawItemTable(pool);
  const existing = await pool.query<{
    url: string;
    source_id: string;
    source_rank: number;
    title: string;
    body: string;
    simhash: string;
    published_at: Date;
  }>("SELECT url, source_id, source_rank, title, body, simhash, published_at FROM raw_items");
  const stored: RawItem[] = existing.rows.map((row) => ({
    url: row.url,
    sourceId: row.source_id,
    sourceRank: row.source_rank,
    title: row.title,
    body: row.body,
    simhash: row.simhash,
    publishedAt: row.published_at,
  }));
  const accepted: RawItem[] = [];
  for (const item of collapseRawItems(items)) {
    if (stored.some((row) => isSameStory(row, item))) {
      continue;
    }
    await pool.query(
      `INSERT INTO raw_items (url, source_id, source_rank, title, body, simhash, published_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (url) DO NOTHING`,
      [item.url, item.sourceId, item.sourceRank, item.title, item.body, item.simhash, item.publishedAt],
    );
    stored.push(item);
    accepted.push(item);
  }
  return accepted;
}
