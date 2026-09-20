import type pg from "pg";

export const NEAR_LOT_SIDES = ["entry", "exit"] as const;
export type NearLotSide = (typeof NEAR_LOT_SIDES)[number];

export type NearLot = {
  id: string;
  side: NearLotSide;
  at: Date;
  tokens: number;
  value: number;
};

export type NearLotInput = {
  side: NearLotSide;
  at: Date;
  tokens: number;
  value: number;
};

export type NearPosition = {
  tokens: number;
  value: number;
  entries: number;
  exits: number;
};

const DDL = `
CREATE TABLE IF NOT EXISTS near_lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  side text NOT NULL CHECK (side IN ('entry', 'exit')),
  at timestamptz NOT NULL,
  tokens double precision NOT NULL CHECK (tokens > 0),
  value double precision NOT NULL CHECK (value > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS near_lots_at_idx ON near_lots (at DESC);
`;

export async function ensureNearLotTable(pool: pg.Pool): Promise<void> {
  await pool.query(DDL);
}

export function parseNearLot(raw: unknown): NearLotInput | { error: string } {
  if (!raw || typeof raw !== "object") {
    return { error: "lot is required" };
  }
  const row = raw as { side?: unknown; at?: unknown; tokens?: unknown; value?: unknown };
  if (row.side !== "entry" && row.side !== "exit") {
    return { error: "side must be entry or exit" };
  }
  const at = row.at instanceof Date ? row.at : new Date(String(row.at ?? ""));
  if (Number.isNaN(at.getTime())) {
    return { error: "at must be a date" };
  }
  const tokens = Number(row.tokens);
  const value = Number(row.value);
  if (!Number.isFinite(tokens) || tokens <= 0) {
    return { error: "tokens must be a positive number" };
  }
  if (!Number.isFinite(value) || value <= 0) {
    return { error: "value must be a positive number" };
  }
  return { side: row.side, at, tokens, value };
}

export function summarizeNearLots(lots: NearLot[]): NearPosition {
  let tokens = 0;
  let value = 0;
  let entries = 0;
  let exits = 0;
  for (const lot of lots) {
    if (lot.side === "entry") {
      tokens += lot.tokens;
      value += lot.value;
      entries += 1;
    } else {
      tokens -= lot.tokens;
      value -= lot.value;
      exits += 1;
    }
  }
  return { tokens, value, entries, exits };
}

export async function listNearLots(pool: pg.Pool): Promise<NearLot[]> {
  await ensureNearLotTable(pool);
  const result = await pool.query<{
    id: string;
    side: NearLotSide;
    at: Date;
    tokens: string | number;
    value: string | number;
  }>("SELECT id, side, at, tokens, value FROM near_lots ORDER BY at DESC, created_at DESC");
  return result.rows.map((row) => ({
    id: row.id,
    side: row.side,
    at: new Date(row.at),
    tokens: Number(row.tokens),
    value: Number(row.value),
  }));
}

export async function insertNearLot(pool: pg.Pool, input: NearLotInput): Promise<NearLot> {
  await ensureNearLotTable(pool);
  const result = await pool.query<{
    id: string;
    side: NearLotSide;
    at: Date;
    tokens: string | number;
    value: string | number;
  }>(
    `INSERT INTO near_lots (side, at, tokens, value)
     VALUES ($1, $2, $3, $4)
     RETURNING id, side, at, tokens, value`,
    [input.side, input.at, input.tokens, input.value],
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error("near lot insert returned no row");
  }
  return {
    id: row.id,
    side: row.side,
    at: new Date(row.at),
    tokens: Number(row.tokens),
    value: Number(row.value),
  };
}

export async function deleteNearLot(pool: pg.Pool, id: string): Promise<boolean> {
  await ensureNearLotTable(pool);
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return false;
  }
  const result = await pool.query("DELETE FROM near_lots WHERE id = $1", [id]);
  return (result.rowCount ?? 0) > 0;
}
