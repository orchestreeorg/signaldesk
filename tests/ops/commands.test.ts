import { afterAll, describe, expect, it } from "vitest";
import { createPool } from "../../src/db/client.js";
import {
  claimOpsCommands,
  enqueueOpsCommand,
  isQueuedControlAction,
  OPS_COMMAND_MAX_AGE_MS,
} from "../../src/ops/commands.js";

const databaseUrl = process.env.DATABASE_URL;

describe("ops commands", () => {
  it("queues Telegram test actions and rejects start", () => {
    expect(isQueuedControlAction("run-digest")).toBe(true);
    expect(isQueuedControlAction("run-macro")).toBe(true);
    expect(isQueuedControlAction("run-near")).toBe(true);
    expect(isQueuedControlAction("start")).toBe(false);
  });
});

describe.skipIf(!databaseUrl)("ops_commands table", () => {
  const pool = createPool(databaseUrl ?? "");

  afterAll(async () => {
    await pool.end();
  });

  it("claims a fresh send-now row once", async () => {
    const now = new Date("2026-09-21T12:40:00.000Z");
    await enqueueOpsCommand(pool, "run-near", now);
    const first = await claimOpsCommands(pool, now);
    expect(first.some((row) => row.action === "run-near")).toBe(true);
    const second = await claimOpsCommands(pool, now);
    expect(second.some((row) => row.action === "run-near")).toBe(false);
  });

  it("ignores stale unclaimed commands", async () => {
    const now = new Date("2026-09-21T12:50:00.000Z");
    await enqueueOpsCommand(pool, "run-digest", new Date(now.getTime() - OPS_COMMAND_MAX_AGE_MS - 1_000));
    const claimed = await claimOpsCommands(pool, now);
    expect(claimed.some((row) => row.action === "run-digest")).toBe(false);
  });
});
