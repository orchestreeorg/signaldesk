import type pg from "pg";
import { describe, expect, it } from "vitest";
import {
  parseNearLot,
  summarizeNearLots,
  insertNearLot,
  type NearLot,
} from "../../src/jobs/nearLots.js";

describe("near lots", () => {
  it("accepts an entry with time, tokens, and value", () => {
    expect(
      parseNearLot({
        side: "entry",
        at: "2026-09-20T18:00:00.000Z",
        tokens: 1200,
        value: 2400,
      }),
    ).toMatchObject({
      side: "entry",
      tokens: 1200,
      value: 2400,
    });
  });

  it("rejects missing side or non-positive size", () => {
    expect(parseNearLot({ at: "2026-09-20T18:00:00.000Z", tokens: 1, value: 1 })).toEqual({
      error: "side must be entry or exit",
    });
    expect(parseNearLot({ side: "exit", at: "2026-09-20T18:00:00.000Z", tokens: 0, value: 10 })).toEqual({
      error: "tokens must be a positive number",
    });
  });

  it("nets tokens and remaining book across entries and exits", () => {
    const lots: NearLot[] = [
      { id: "1", side: "entry", at: new Date("2026-09-21T12:00:00.000Z"), tokens: 100, value: 200 },
      { id: "2", side: "entry", at: new Date("2026-09-21T13:00:00.000Z"), tokens: 50, value: 80 },
      { id: "3", side: "exit", at: new Date("2026-09-21T14:00:00.000Z"), tokens: 40, value: 90 },
    ];
    const next = summarizeNearLots(lots);
    expect(next.tokens).toBe(110);
    expect(next.entries).toBe(2);
    expect(next.exits).toBe(1);
    expect(next.value).toBeCloseTo(280 * (110 / 150), 8);
  });

  it("reduces book by the sold share even when exit USD is not the proceeds", () => {
    const lots: NearLot[] = [
      { id: "1", side: "entry", at: new Date("2026-09-21T12:00:00.000Z"), tokens: 100, value: 1000 },
      { id: "2", side: "exit", at: new Date("2026-09-21T13:00:00.000Z"), tokens: 40, value: 1 },
    ];
    expect(summarizeNearLots(lots)).toMatchObject({ tokens: 60, entries: 1, exits: 1 });
    expect(summarizeNearLots(lots).value).toBeCloseTo(600, 8);
  });

  it("inserts a lot after ensuring the table", async () => {
    const calls: Array<{ sql: string; values?: unknown[] }> = [];
    const pool = {
      query: async (sql: string, values?: unknown[]) => {
        calls.push({ sql, values });
        if (sql.includes("RETURNING")) {
          return {
            rows: [{ id: "lot-1", side: "entry", at: new Date("2026-09-20T18:00:00.000Z"), tokens: 10, value: 20 }],
          };
        }
        return { rowCount: 0, rows: [] };
      },
    } as unknown as pg.Pool;
    const lot = await insertNearLot(pool, {
      side: "entry",
      at: new Date("2026-09-20T18:00:00.000Z"),
      tokens: 10,
      value: 20,
    });
    expect(calls[0]?.sql).toMatch(/CREATE TABLE IF NOT EXISTS near_lots/);
    expect(lot).toMatchObject({ id: "lot-1", side: "entry", tokens: 10, value: 20 });
  });
});
