import { describe, expect, it } from "vitest";
import { holdingsCandles, holdingsScale, NEAR_HOLDINGS_GOAL_USD } from "../../src/jobs/nearChart.js";
import type { NearLot } from "../../src/jobs/nearLots.js";

describe("NEAR holdings candles", () => {
  it("turns chronological lots into USD-held open/close candles", () => {
    const lots: NearLot[] = [
      { id: "b", side: "exit", at: new Date("2026-09-21T14:00:00.000Z"), tokens: 40, value: 90 },
      { id: "a", side: "entry", at: new Date("2026-09-21T12:00:00.000Z"), tokens: 100, value: 200 },
      { id: "c", side: "entry", at: new Date("2026-09-21T13:00:00.000Z"), tokens: 50, value: 80 },
    ];
    expect(holdingsCandles(lots)).toEqual([
      {
        id: "a",
        side: "entry",
        at: "2026-09-21T12:00:00.000Z",
        open: 0,
        high: 200,
        low: 0,
        close: 200,
        tokens: 100,
        lotValue: 200,
      },
      {
        id: "c",
        side: "entry",
        at: "2026-09-21T13:00:00.000Z",
        open: 200,
        high: 280,
        low: 200,
        close: 280,
        tokens: 50,
        lotValue: 80,
      },
      {
        id: "b",
        side: "exit",
        at: "2026-09-21T14:00:00.000Z",
        open: 280,
        high: 280,
        low: 190,
        close: 190,
        tokens: 40,
        lotValue: 90,
      },
    ]);
  });

  it("keeps only the last N lots", () => {
    const lots: NearLot[] = Array.from({ length: 5 }, (_, i) => ({
      id: String(i),
      side: "entry" as const,
      at: new Date(`2026-09-21T12:0${i}:00.000Z`),
      tokens: 1,
      value: 10,
    }));
    expect(holdingsCandles(lots, 2).map((row) => row.id)).toEqual(["3", "4"]);
    expect(holdingsCandles(lots, 2)[0]?.open).toBe(30);
  });

  it("roofs the scale at the 300k USD goal", () => {
    expect(holdingsScale([{ low: 0, high: 190 }])).toEqual({ min: 0, max: NEAR_HOLDINGS_GOAL_USD });
    expect(holdingsScale([{ low: -50, high: 10_000 }])).toEqual({ min: -50, max: NEAR_HOLDINGS_GOAL_USD });
  });
});
