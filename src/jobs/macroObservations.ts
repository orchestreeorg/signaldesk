import type pg from "pg";

export const MACRO_HISTORY_DAYS = 90;

export const MACRO_SOURCES = [
  "coingecko",
  "cmc",
  "ovx",
  "gpr",
  "gold",
  "sp500",
  "news_mix",
] as const;

export type MacroSource = (typeof MACRO_SOURCES)[number];

export type MacroObservationInput = {
  source: MacroSource;
  asOf: Date | string;
  value: number;
  aux?: Record<string, unknown>;
};

export type MacroObservation = {
  source: MacroSource;
  asOf: Date;
  value: number;
  aux: Record<string, unknown>;
};

const DDL = `
CREATE TABLE IF NOT EXISTS macro_observations (
  source text NOT NULL,
  as_of timestamptz NOT NULL,
  value double precision NOT NULL,
  aux jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (source, as_of)
);
CREATE INDEX IF NOT EXISTS macro_observations_as_of_idx
  ON macro_observations (as_of DESC);
`;

export function utcDay(value: Date | string): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export async function ensureMacroObservationTable(pool: pg.Pool): Promise<void> {
  await pool.query(DDL);
}

export async function persistMacroObservations(
  pool: pg.Pool,
  observations: MacroObservationInput[],
): Promise<number> {
  await ensureMacroObservationTable(pool);
  const unique = new Map<string, MacroObservation>();
  for (const observation of observations) {
    const asOf = utcDay(observation.asOf);
    if (!asOf || !Number.isFinite(observation.value)) {
      continue;
    }
    unique.set(`${observation.source}:${asOf.toISOString()}`, {
      source: observation.source,
      asOf,
      value: observation.value,
      aux: observation.aux ?? {},
    });
  }
  const rows = [...unique.values()];
  if (rows.length === 0) {
    return 0;
  }
  const values: unknown[] = [];
  const placeholders = rows.map((row, index) => {
    const offset = index * 4;
    values.push(row.source, row.asOf, row.value, JSON.stringify(row.aux));
    return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}::jsonb)`;
  });
  const result = await pool.query(
    `INSERT INTO macro_observations (source, as_of, value, aux)
     VALUES ${placeholders.join(", ")}
     ON CONFLICT (source, as_of) DO UPDATE
       SET value = EXCLUDED.value,
           aux = EXCLUDED.aux`,
    values,
  );
  return result.rowCount ?? rows.length;
}

export async function loadMacroHistory(
  pool: pg.Pool,
  now: Date,
  days = MACRO_HISTORY_DAYS,
): Promise<MacroObservation[]> {
  await ensureMacroObservationTable(pool);
  const from = new Date(now.getTime() - days * 24 * 60 * 60_000);
  const result = await pool.query<{
    source: string;
    as_of: Date;
    value: number;
    aux: Record<string, unknown> | null;
  }>(
    `SELECT source, as_of, value, aux
       FROM macro_observations
      WHERE as_of >= $1
      ORDER BY source, as_of DESC`,
    [from],
  );
  return result.rows
    .filter((row): row is typeof row & { source: MacroSource } =>
      (MACRO_SOURCES as readonly string[]).includes(row.source),
    )
    .map((row) => ({
      source: row.source,
      asOf: row.as_of,
      value: Number(row.value),
      aux: row.aux ?? {},
    }))
    .filter((row) => Number.isFinite(row.value));
}
