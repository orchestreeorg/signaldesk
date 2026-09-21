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

export type NearBook = {
  tokens: number;
  value: number;
};

function lotTime(lot: Pick<NearLot, "at">): number {
  const ts = lot.at instanceof Date ? lot.at.getTime() : Date.parse(String(lot.at));
  return Number.isFinite(ts) ? ts : 0;
}

/** Entry adds cost. Exit removes the sold share of current book, not the typed sale proceeds. */
export function applyLotToBook(book: NearBook, lot: Pick<NearLot, "side" | "tokens" | "value">): NearBook {
  if (lot.side === "entry") {
    return { tokens: book.tokens + lot.tokens, value: book.value + lot.value };
  }
  const held = book.tokens;
  if (held > 0) {
    const sold = Math.min(lot.tokens, held);
    return {
      tokens: book.tokens - lot.tokens,
      value: book.value - book.value * (sold / held),
    };
  }
  return { tokens: book.tokens - lot.tokens, value: book.value - lot.value };
}

export function summarizeNearLots(lots: NearLot[]): NearPosition {
  const chronological = [...lots].sort((a, b) => {
    const delta = lotTime(a) - lotTime(b);
    if (delta !== 0) {
      return delta;
    }
    return a.id.localeCompare(b.id);
  });
  let book: NearBook = { tokens: 0, value: 0 };
  let entries = 0;
  let exits = 0;
  for (const lot of chronological) {
    book = applyLotToBook(book, lot);
    if (lot.side === "entry") {
      entries += 1;
    } else {
      exits += 1;
    }
  }
  return { tokens: book.tokens, value: book.value, entries, exits };
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
