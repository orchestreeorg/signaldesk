import { and, eq } from "drizzle-orm";
import type { Asset, Horizon, Outcome } from "../domain/index.js";
import { HORIZONS } from "../domain/index.js";
import type { Database } from "../db/client.js";
import { alerts, outcomes } from "../db/schema.js";

export const HORIZON_MS: Record<Horizon, number> = {
  "1h": 60 * 60 * 1000,
  "4h": 4 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
};

export type PriceMark = {
  ts: Date;
  asset: Asset;
  mid: number;
};

export type PendingAlert = {
  id: string;
  asset: Asset;
  t0: Date;
};

export type ResolveOutcomesInput = {
  alerts: PendingAlert[];
  marks: PriceMark[];
  existing?: Outcome[];
  now: Date;
};

export function midAsOf(
  marks: PriceMark[],
  asset: Asset,
  at: Date,
  after?: Date,
): number | null {
  let best: PriceMark | undefined;
  const floor = after?.getTime() ?? Number.NEGATIVE_INFINITY;
  for (const mark of marks) {
    const ts = mark.ts.getTime();
    if (mark.asset !== asset || ts > at.getTime() || ts <= floor) {
      continue;
    }
    if (!best || ts > best.ts.getTime()) {
      best = mark;
    }
  }
  return best?.mid ?? null;
}

function previousDue(t0: Date, horizon: Horizon): Date {
  if (horizon === "1h") {
    return t0;
  }
  if (horizon === "4h") {
    return new Date(t0.getTime() + HORIZON_MS["1h"]);
  }
  if (horizon === "24h") {
    return new Date(t0.getTime() + HORIZON_MS["4h"]);
  }
  return new Date(t0.getTime() + HORIZON_MS["24h"]);
}

export function computeReturn(startMid: number, endMid: number): number | null {
  if (startMid <= 0) {
    return null;
  }
  return (endMid - startMid) / startMid;
}

function key(alertId: string, horizon: Horizon): string {
  return `${alertId}:${horizon}`;
}

export function resolveOutcomes(input: ResolveOutcomesInput): Outcome[] {
  const prior = new Map(
    (input.existing ?? []).map((row) => [key(row.alertId, row.horizon), row]),
  );
  const out: Outcome[] = [];

  for (const alert of input.alerts) {
    const startMid = midAsOf(input.marks, alert.asset, alert.t0);
    for (const horizon of HORIZONS) {
      const existing = prior.get(key(alert.id, horizon));
      if (existing?.resolvedAt) {
        out.push(existing);
        continue;
      }

      const dueAt = new Date(alert.t0.getTime() + HORIZON_MS[horizon]);
      if (input.now.getTime() < dueAt.getTime() || startMid === null) {
        out.push({
          alertId: alert.id,
          horizon,
          realizedReturn: null,
          resolvedAt: null,
        });
        continue;
      }

      const endMid = midAsOf(input.marks, alert.asset, dueAt, previousDue(alert.t0, horizon));
      const realizedReturn = endMid === null ? null : computeReturn(startMid, endMid);
      out.push({
        alertId: alert.id,
        horizon,
        realizedReturn,
        resolvedAt: realizedReturn === null ? null : dueAt,
      });
    }
  }
  return out;
}

export async function persistOutcomes(db: Database, rows: Outcome[]): Promise<void> {
  for (const row of rows) {
    const current = await db
      .select()
      .from(outcomes)
      .where(and(eq(outcomes.alertId, row.alertId), eq(outcomes.horizon, row.horizon)))
      .limit(1);
    const found = current[0];
    if (found?.realizedReturn !== null && found?.resolvedAt) {
      continue;
    }
    if (found) {
      await db
        .update(outcomes)
        .set({
          realizedReturn: row.realizedReturn,
          resolvedAt: row.resolvedAt,
        })
        .where(and(eq(outcomes.alertId, row.alertId), eq(outcomes.horizon, row.horizon)));
      continue;
    }
    await db.insert(outcomes).values(row);
  }
}

export async function loadPendingAlerts(db: Database): Promise<PendingAlert[]> {
  const rows = await db.select().from(alerts);
  return rows
    .map((row) => {
      const t0 = row.sentAt ?? row.createdAt;
      if (!t0) {
        return null;
      }
      return { id: row.id, asset: row.asset as Asset, t0 };
    })
    .filter((row): row is PendingAlert => row !== null);
}

export async function loadExistingOutcomes(db: Database): Promise<Outcome[]> {
  const rows = await db.select().from(outcomes);
  return rows.map((row) => ({
    alertId: row.alertId,
    horizon: row.horizon as Horizon,
    realizedReturn: row.realizedReturn,
    resolvedAt: row.resolvedAt,
  }));
}

export async function loadMarks(
  query: (sql: string, params: unknown[]) => Promise<{ rows: Array<{ ts: Date; asset: string; mid: number }> }>,
  from: Date,
  to: Date,
): Promise<PriceMark[]> {
  const result = await query(
    `SELECT ts, asset, mid FROM price_marks WHERE ts >= $1 AND ts <= $2 ORDER BY ts ASC`,
    [from, to],
  );
  return result.rows.map((row) => ({
    ts: row.ts,
    asset: row.asset as Asset,
    mid: row.mid,
  }));
}

export async function fillOutcomes(
  db: Database,
  query: (sql: string, params: unknown[]) => Promise<{ rows: Array<{ ts: Date; asset: string; mid: number }> }>,
  now = new Date(),
): Promise<Outcome[]> {
  const pending = await loadPendingAlerts(db);
  if (pending.length === 0) {
    return [];
  }
  const from = new Date(Math.min(...pending.map((alert) => alert.t0.getTime())));
  const to = new Date(Math.max(...pending.map((alert) => alert.t0.getTime() + HORIZON_MS["7d"])));
  const rows = resolveOutcomes({
    alerts: pending,
    marks: await loadMarks(query, from, to),
    existing: await loadExistingOutcomes(db),
    now,
  });
  await persistOutcomes(db, rows);
  return rows;
}
