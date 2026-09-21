import type pg from "pg";

export type NearAth = {
  value: number;
  at: Date;
};

export type NearAthView = {
  value: number;
  at: Date;
  current: number;
  status: "ath" | "under";
  under: number;
  underPct: number;
};

const DDL = `
CREATE TABLE IF NOT EXISTS near_portfolio_ath (
  id integer PRIMARY KEY CHECK (id = 1),
  value double precision NOT NULL,
  at timestamptz NOT NULL
);
`;

export async function ensureNearAthTable(pool: pg.Pool): Promise<void> {
  await pool.query(DDL);
}

/** Current mark vs stored peak. A new high or first print is ATH. */
export function resolveNearAth(current: number, stored: NearAth | null, now = new Date()): { view: NearAthView; stored: NearAth } {
  const mark = Number.isFinite(current) && current > 0 ? current : 0;
  if (!stored || !Number.isFinite(stored.value) || mark >= stored.value) {
    const next = { value: mark, at: now };
    return {
      view: { value: next.value, at: next.at, current: mark, status: "ath", under: 0, underPct: 0 },
      stored: next,
    };
  }
  const under = stored.value - mark;
  const underPct = stored.value === 0 ? 0 : (under / stored.value) * 100;
  return {
    view: {
      value: stored.value,
      at: stored.at,
      current: mark,
      status: "under",
      under,
      underPct,
    },
    stored,
  };
}

export async function loadNearAth(pool: pg.Pool): Promise<NearAth | null> {
  await ensureNearAthTable(pool);
  const result = await pool.query<{ value: string | number; at: Date }>(
    "SELECT value, at FROM near_portfolio_ath WHERE id = 1",
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }
  return { value: Number(row.value), at: new Date(row.at) };
}

export async function saveNearAth(pool: pg.Pool, ath: NearAth): Promise<void> {
  await ensureNearAthTable(pool);
  await pool.query(
    `INSERT INTO near_portfolio_ath (id, value, at)
     VALUES (1, $1, $2)
     ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value, at = EXCLUDED.at`,
    [ath.value, ath.at],
  );
}

/** Raise the stored peak when the live mark prints a new high. */
export async function recordNearAth(pool: pg.Pool, current: number, now = new Date()): Promise<NearAthView> {
  const previous = await loadNearAth(pool);
  const next = resolveNearAth(current, previous, now);
  if (!previous || next.stored.value > previous.value) {
    await saveNearAth(pool, next.stored);
  }
  return next.view;
}
