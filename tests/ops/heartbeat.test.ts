import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { createPool } from "../../src/db/client.js";
import {
  composeHeartbeat,
  fresherHeartbeat,
  parseHeartbeat,
  readOpsHeartbeat,
  saveOpsHeartbeat,
  WORKER_ONLINE_MS,
  workerOnline,
  type HeartbeatPartial,
} from "../../src/ops/heartbeat.js";

const here = dirname(fileURLToPath(import.meta.url));
const databaseUrl = process.env.DATABASE_URL;

const partial: HeartbeatPartial = {
  pid: 9,
  paused: false,
  newsLive: true,
  tapeLive: false,
  dryRun: false,
};

function stamp(ts: string) {
  return { ...composeHeartbeat(partial, new Date(ts)), ts };
}

describe("worker heartbeat", () => {
  it("treats a beat inside the window as online and a stale beat as offline", () => {
    const now = Date.parse("2026-09-21T12:10:00.000Z");
    const fresh = stamp(new Date(now - 10_000).toISOString());
    const stale = stamp(new Date(now - WORKER_ONLINE_MS - 1).toISOString());
    expect(workerOnline(fresh, now)).toBe(true);
    expect(workerOnline(stale, now)).toBe(false);
    expect(workerOnline(null, now)).toBe(false);
    expect(workerOnline(parseHeartbeat("{"), now)).toBe(false);
  });

  it("keeps the newer of two beats", () => {
    const older = stamp("2026-09-21T12:00:00.000Z");
    const newer = stamp("2026-09-21T12:00:30.000Z");
    expect(fresherHeartbeat(older, newer)?.ts).toBe(newer.ts);
    expect(fresherHeartbeat(newer, null)?.ts).toBe(newer.ts);
    expect(fresherHeartbeat(null, older)?.ts).toBe(older.ts);
  });

  it("wires the dash status API to Postgres first", () => {
    const status = readFileSync(join(here, "../../dashboard/lib/status.ts"), "utf8");
    const route = readFileSync(join(here, "../../dashboard/app/api/status/route.ts"), "utf8");
    const worker = readFileSync(join(here, "../../src/processes/worker.ts"), "utf8");
    expect(status).toMatch(/readOpsHeartbeat/);
    expect(status).toMatch(/fresherHeartbeat/);
    expect(route).toMatch(/loadWorkerStatus/);
    expect(worker).toMatch(/saveOpsHeartbeat/);
  });
});

describe.skipIf(!databaseUrl)("ops_heartbeat table", () => {
  const pool = createPool(databaseUrl ?? "");

  afterAll(async () => {
    await pool.end();
  });

  it("round-trips a beat the dash can read", async () => {
    const body = composeHeartbeat(partial, new Date("2026-09-21T12:10:00.000Z"));
    await saveOpsHeartbeat(pool, body);
    const loaded = await readOpsHeartbeat(pool);
    expect(loaded?.pid).toBe(9);
    expect(loaded?.ts).toBe(body.ts);
    expect(workerOnline(loaded, Date.parse("2026-09-21T12:10:20.000Z"))).toBe(true);
  });
});
