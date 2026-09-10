import type pg from "pg";
import { describe, expect, it } from "vitest";
import {
  persistMacroObservations,
  utcDay,
} from "../../src/jobs/macroObservations.js";

describe("macro observation persistence", () => {
  it("normalizes observations to one UTC day", () => {
    expect(utcDay("2026-09-10T23:58:00-03:00")?.toISOString()).toBe("2026-09-11T00:00:00.000Z");
    expect(utcDay("not-a-date")).toBeNull();
  });

  it("deduplicates a source/day and uses an idempotent upsert", async () => {
    const calls: Array<{ sql: string; values?: unknown[] }> = [];
    const pool = {
      query: async (sql: string, values?: unknown[]) => {
        calls.push({ sql, values });
        return { rowCount: 1, rows: [] };
      },
    } as unknown as pg.Pool;
    await persistMacroObservations(pool, [
      { source: "ovx", asOf: "2026-09-10T01:00:00Z", value: 30 },
      { source: "ovx", asOf: "2026-09-10T20:00:00Z", value: 31 },
    ]);
    expect(calls).toHaveLength(2);
    expect(calls[1]?.sql).toMatch(/ON CONFLICT \(source, as_of\) DO UPDATE/);
    expect(calls[1]?.values).toHaveLength(4);
    expect(calls[1]?.values?.[2]).toBe(31);
  });
});
