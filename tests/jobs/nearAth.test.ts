import type pg from "pg";
import { describe, expect, it } from "vitest";
import { recordNearAth, resolveNearAth } from "../../src/jobs/nearAth.js";

const now = new Date("2026-09-21T22:00:00.000Z");

describe("NEAR portfolio ATH", () => {
  it("prints ATH on the first mark and on a new high", () => {
    expect(resolveNearAth(58_233, null, now).view).toMatchObject({
      status: "ath",
      value: 58_233,
      current: 58_233,
      under: 0,
    });
    expect(
      resolveNearAth(61_000, { value: 58_233, at: new Date("2026-09-20T21:00:00.000Z") }, now).view,
    ).toMatchObject({
      status: "ath",
      value: 61_000,
      under: 0,
    });
  });

  it("reports how far the mark sits under the stored ATH", () => {
    const view = resolveNearAth(57_736, { value: 61_200, at: new Date("2026-09-20T21:00:00.000Z") }, now).view;
    expect(view.status).toBe("under");
    expect(view.value).toBe(61_200);
    expect(view.under).toBeCloseTo(3_464, 5);
    expect(view.underPct).toBeCloseTo((3_464 / 61_200) * 100, 5);
  });

  it("writes only when the live mark raises the peak", async () => {
    const calls: Array<{ sql: string; values?: unknown[] }> = [];
    let stored: { value: number; at: Date } | undefined;
    const pool = {
      query: async (sql: string, values?: unknown[]) => {
        calls.push({ sql, values });
        if (sql.includes("SELECT")) {
          return { rows: stored ? [stored] : [] };
        }
        if (sql.includes("INSERT")) {
          stored = { value: Number(values?.[0]), at: values?.[1] as Date };
        }
        return { rowCount: 1, rows: [] };
      },
    } as unknown as pg.Pool;
    const first = await recordNearAth(pool, 50_000, now);
    expect(first.status).toBe("ath");
    expect(stored?.value).toBe(50_000);
    const writes = calls.filter((row) => row.sql.includes("INSERT")).length;
    const under = await recordNearAth(pool, 48_000, now);
    expect(under.status).toBe("under");
    expect(under.under).toBe(2_000);
    expect(calls.filter((row) => row.sql.includes("INSERT"))).toHaveLength(writes);
    const raised = await recordNearAth(pool, 51_000, now);
    expect(raised.status).toBe("ath");
    expect(stored?.value).toBe(51_000);
    expect(calls.filter((row) => row.sql.includes("INSERT")).length).toBe(writes + 1);
  });
});
