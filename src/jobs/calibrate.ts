import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ALERT_KINDS,
  EVENT_CLASSES,
  HORIZONS,
  VOL_REGIMES,
  type AlertKind,
  type EventClass,
  type Horizon,
  type VolRegime,
} from "../domain/index.js";
import { normalize, type PriorLookup, type Probs } from "../fusion/priors.js";
import type { Database } from "../db/client.js";
import { alerts, events, featureSnapshots, outcomes } from "../db/schema.js";

export const MOVE_THRESHOLD = 0.02;
export const MIN_CELL_N = 20;
export const UNIFORM: Probs = { pUp: 1 / 3, pDown: 1 / 3, pIn: 1 / 3 };

export type StudySample = {
  class: EventClass;
  volRegime: VolRegime;
  horizon: Horizon;
  realizedReturn: number;
};

export type PriorRow = {
  class: EventClass;
  volRegime: VolRegime;
  horizon: Horizon;
  n: number;
  pUp: number;
  pDown: number;
  pIn: number;
  source: "empirical" | "global";
};

export type ForecastSample = {
  kind: AlertKind;
  horizon: Horizon;
  pUp: number;
  pDown: number;
  pIn: number;
  realizedReturn: number;
};

export type BrierRow = {
  kind: AlertKind;
  n: number;
  brier: number | null;
};

const here = dirname(fileURLToPath(import.meta.url));
const viewsPath = join(here, "../db/views.sql");

export function bucket(realizedReturn: number): "up" | "down" | "in" {
  if (realizedReturn > MOVE_THRESHOLD) {
    return "up";
  }
  if (realizedReturn < -MOVE_THRESHOLD) {
    return "down";
  }
  return "in";
}

export function empirical(returns: number[]): Probs & { n: number } {
  if (returns.length === 0) {
    return { n: 0, ...UNIFORM };
  }
  let up = 0;
  let down = 0;
  let inside = 0;
  for (const value of returns) {
    const side = bucket(value);
    if (side === "up") {
      up += 1;
    } else if (side === "down") {
      down += 1;
    } else {
      inside += 1;
    }
  }
  return {
    n: returns.length,
    ...normalize({
      pUp: up / returns.length,
      pDown: down / returns.length,
      pIn: inside / returns.length,
    }),
  };
}

export function studyPriors(samples: StudySample[]): PriorRow[] {
  const global = empirical(samples.map((row) => row.realizedReturn));
  const cells = new Map<string, number[]>();
  for (const row of samples) {
    const id = `${row.class}|${row.volRegime}|${row.horizon}`;
    const list = cells.get(id) ?? [];
    list.push(row.realizedReturn);
    cells.set(id, list);
  }

  const out: PriorRow[] = [];
  for (const eventClass of EVENT_CLASSES) {
    for (const volRegime of VOL_REGIMES) {
      for (const horizon of HORIZONS) {
        const returns = cells.get(`${eventClass}|${volRegime}|${horizon}`) ?? [];
        const useCell = returns.length >= MIN_CELL_N;
        const probs = useCell ? empirical(returns) : global.n > 0 ? global : UNIFORM;
        out.push({
          class: eventClass,
          volRegime,
          horizon,
          n: returns.length,
          ...normalize(probs),
          source: useCell ? "empirical" : "global",
        });
      }
    }
  }
  return out;
}

export function priorLookupFromStudy(rows: PriorRow[]): PriorLookup {
  const index = new Map(
    rows.map((row) => [`${row.class}|${row.volRegime}|${row.horizon}`, row] as const),
  );
  return (key) => {
    const row = index.get(`${key.class}|${key.volRegime}|${key.horizon}`);
    if (!row) {
      return undefined;
    }
    return { pUp: row.pUp, pDown: row.pDown, pIn: row.pIn };
  };
}

export function brierScore(row: ForecastSample): number {
  const side = bucket(row.realizedReturn);
  const yUp = side === "up" ? 1 : 0;
  const yDown = side === "down" ? 1 : 0;
  const yIn = side === "in" ? 1 : 0;
  return (row.pUp - yUp) ** 2 + (row.pDown - yDown) ** 2 + (row.pIn - yIn) ** 2;
}

export function brierByKind(rows: ForecastSample[]): BrierRow[] {
  return ALERT_KINDS.map((kind) => {
    const subset = rows.filter((row) => row.kind === kind);
    if (subset.length === 0) {
      return { kind, n: 0, brier: null };
    }
    const total = subset.reduce((sum, row) => sum + brierScore(row), 0);
    return { kind, n: subset.length, brier: total / subset.length };
  });
}

export function formatBrierTable(rows: BrierRow[]): string {
  const header = "kind         n  brier";
  const body = rows.map((row) => {
    const score = row.brier === null ? "n/a" : row.brier.toFixed(4);
    return `${row.kind.padEnd(12)}${String(row.n).padStart(2)}  ${score}`;
  });
  return [header, ...body].join("\n");
}

export async function ensurePriorView(
  query: (sql: string) => Promise<unknown>,
): Promise<void> {
  const sql = await readFile(viewsPath, "utf8");
  await query(sql);
}

export async function loadPriorsFromView(
  query: (sql: string) => Promise<{ rows: Array<Record<string, unknown>> }>,
): Promise<PriorRow[]> {
  const result = await query(
    `SELECT class, vol_regime, horizon, n, p_up, p_down, p_in, source FROM event_study_priors`,
  );
  return result.rows.map((row) => ({
    class: row.class as EventClass,
    volRegime: row.vol_regime as VolRegime,
    horizon: row.horizon as Horizon,
    n: Number(row.n),
    pUp: Number(row.p_up),
    pDown: Number(row.p_down),
    pIn: Number(row.p_in),
    source: row.source === "empirical" ? "empirical" : "global",
  }));
}

function nearestRegime(
  snapshots: Array<{ ts: Date; asset: string; volRegime: string }>,
  asset: string,
  at: Date,
): VolRegime {
  let best: { ts: Date; volRegime: string } | undefined;
  for (const snap of snapshots) {
    if (snap.asset !== asset || snap.ts.getTime() > at.getTime()) {
      continue;
    }
    if (!best || snap.ts.getTime() > best.ts.getTime()) {
      best = snap;
    }
  }
  return (best?.volRegime as VolRegime | undefined) ?? "mid";
}

export async function loadStudySamples(db: Database): Promise<StudySample[]> {
  const [eventRows, alertRows, outcomeRows, snapRows] = await Promise.all([
    db.select().from(events),
    db.select().from(alerts),
    db.select().from(outcomes),
    db.select().from(featureSnapshots),
  ]);
  const eventsById = new Map(eventRows.map((row) => [row.id, row]));
  const out: StudySample[] = [];
  for (const outcome of outcomeRows) {
    if (outcome.realizedReturn === null || outcome.resolvedAt === null) {
      continue;
    }
    const alert = alertRows.find((row) => row.id === outcome.alertId);
    if (!alert?.eventId) {
      continue;
    }
    const event = eventsById.get(alert.eventId);
    if (!event) {
      continue;
    }
    const t0 = alert.sentAt ?? alert.createdAt;
    out.push({
      class: event.class as EventClass,
      volRegime: nearestRegime(snapRows, alert.asset, t0),
      horizon: outcome.horizon as Horizon,
      realizedReturn: outcome.realizedReturn,
    });
  }
  return out;
}

export async function loadForecasts(db: Database): Promise<ForecastSample[]> {
  const [alertRows, outcomeRows] = await Promise.all([
    db.select().from(alerts),
    db.select().from(outcomes),
  ]);
  const out: ForecastSample[] = [];
  for (const alert of alertRows) {
    const outcome = outcomeRows.find(
      (row) => row.alertId === alert.id && row.horizon === alert.horizon,
    );
    if (outcome?.realizedReturn === null || outcome?.resolvedAt === null || !outcome) {
      continue;
    }
    out.push({
      kind: alert.kind as AlertKind,
      horizon: alert.horizon as Horizon,
      pUp: alert.pUp,
      pDown: alert.pDown,
      pIn: alert.pIn,
      realizedReturn: outcome.realizedReturn,
    });
  }
  return out;
}

export async function calibrate(
  db: Database,
  query: (sql: string) => Promise<{ rows: Array<Record<string, unknown>> }>,
  log: (line: string) => void = console.log,
): Promise<{ priors: PriorRow[]; brier: BrierRow[] }> {
  await ensurePriorView(query);
  const priors = await loadPriorsFromView(query);
  const brier = brierByKind(await loadForecasts(db));
  log(formatBrierTable(brier));
  return { priors, brier };
}
