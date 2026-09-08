import type pg from "pg";
import type { Asset } from "../../domain/index.js";

const DDL = `
CREATE TABLE IF NOT EXISTS price_marks (
  ts timestamptz NOT NULL,
  asset text NOT NULL,
  mid double precision NOT NULL,
  PRIMARY KEY (ts, asset)
);
`;

export async function ensureMarksTable(pool: pg.Pool): Promise<void> {
  await pool.query(DDL);
}

export async function saveMark(
  pool: pg.Pool,
  input: { ts: Date; asset: Asset; mid: number },
): Promise<void> {
  await pool.query(
    `INSERT INTO price_marks (ts, asset, mid) VALUES ($1, $2, $3)
     ON CONFLICT (ts, asset) DO UPDATE SET mid = EXCLUDED.mid`,
    [input.ts, input.asset, input.mid],
  );
}
