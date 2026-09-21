import type pg from "pg";
import { formatWait, nextDigestAt, nextMacroAt, nextNearAt, nextNewsAt, nextTapeAt } from "./clock.js";
import type { OpsHeartbeat } from "./types.js";

/** Chip is online if the last beat is newer than this. Wider than the 5s tick so a slow job does not flap. */
export const WORKER_ONLINE_MS = 45_000;

const DDL = `
CREATE TABLE IF NOT EXISTS ops_heartbeat (
  id integer PRIMARY KEY CHECK (id = 1),
  payload jsonb NOT NULL,
  ts timestamptz NOT NULL
);
`;

export type HeartbeatPartial = Omit<
  OpsHeartbeat,
  "ts" | "waiting" | "nextNewsAt" | "nextTapeAt" | "nextDigestAt" | "nextMacroAt" | "nextNearAt"
>;

export function composeHeartbeat(partial: HeartbeatPartial, now = new Date()): OpsHeartbeat {
  const nextNews = nextNewsAt(now);
  const nextTape = nextTapeAt(now);
  const nextDigest = nextDigestAt(now);
  const nextMacro = nextMacroAt(now);
  const nextNear = nextNearAt(now);
  return {
    ...partial,
    ts: now.toISOString(),
    nextNewsAt: nextNews.toISOString(),
    nextTapeAt: nextTape.toISOString(),
    nextDigestAt: nextDigest.toISOString(),
    nextMacroAt: nextMacro.toISOString(),
    nextNearAt: nextNear.toISOString(),
    waiting: {
      news: formatWait(nextNews, now),
      tape: formatWait(nextTape, now),
      digest: formatWait(nextDigest, now),
      macro: formatWait(nextMacro, now),
      near: formatWait(nextNear, now),
    },
  };
}

export function workerOnline(heartbeat: OpsHeartbeat | null, now = Date.now()): boolean {
  if (!heartbeat?.ts) {
    return false;
  }
  const ts = new Date(heartbeat.ts).getTime();
  if (!Number.isFinite(ts)) {
    return false;
  }
  return now - ts < WORKER_ONLINE_MS;
}

export function fresherHeartbeat(a: OpsHeartbeat | null, b: OpsHeartbeat | null): OpsHeartbeat | null {
  if (!a) {
    return b;
  }
  if (!b) {
    return a;
  }
  const aTs = new Date(a.ts).getTime();
  const bTs = new Date(b.ts).getTime();
  if (!Number.isFinite(aTs)) {
    return Number.isFinite(bTs) ? b : a;
  }
  if (!Number.isFinite(bTs) || aTs >= bTs) {
    return a;
  }
  return b;
}

export function parseHeartbeat(raw: unknown): OpsHeartbeat | null {
  let value: unknown = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object") {
    return null;
  }
  const ts = (value as { ts?: unknown }).ts;
  if (typeof ts !== "string" || !Number.isFinite(new Date(ts).getTime())) {
    return null;
  }
  return value as OpsHeartbeat;
}

export async function ensureOpsHeartbeatTable(pool: pg.Pool): Promise<void> {
  await pool.query(DDL);
}

export async function saveOpsHeartbeat(pool: pg.Pool, body: OpsHeartbeat): Promise<void> {
  await ensureOpsHeartbeatTable(pool);
  await pool.query(
    `INSERT INTO ops_heartbeat (id, payload, ts)
     VALUES (1, $1::jsonb, $2::timestamptz)
     ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, ts = EXCLUDED.ts`,
    [JSON.stringify(body), body.ts],
  );
}

export async function readOpsHeartbeat(pool: pg.Pool): Promise<OpsHeartbeat | null> {
  try {
    const result = await pool.query<{ payload: unknown }>("SELECT payload FROM ops_heartbeat WHERE id = 1");
    return parseHeartbeat(result.rows[0]?.payload);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (/ops_heartbeat/i.test(message) && /does not exist|undefined table/i.test(message)) {
      return null;
    }
    throw error;
  }
}
