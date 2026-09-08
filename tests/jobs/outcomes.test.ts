import { describe, expect, it } from "vitest";
import type { Horizon } from "../../src/domain/index.js";
import {
  HORIZON_MS,
  resolveOutcomes,
  type PendingAlert,
  type PriceMark,
} from "../../src/jobs/outcomes.js";

const t0 = new Date("2026-09-01T00:00:00.000Z");
const alert: PendingAlert = { id: "alert-1", asset: "BTC", t0 };

function at(horizon: Horizon): Date {
  return new Date(t0.getTime() + HORIZON_MS[horizon]);
}

function marks(rows: Array<[Horizon | "t0", number]>): PriceMark[] {
  return rows.map(([when, mid]) => ({
    ts: when === "t0" ? t0 : at(when),
    asset: "BTC" as const,
    mid,
  }));
}

function rowOf(rows: ReturnType<typeof resolveOutcomes>, horizon: Horizon) {
  return rows.find((row) => row.horizon === horizon);
}

describe("outcomes job", () => {
  it("writes four realized returns when marks exist at each horizon", () => {
    const rows = resolveOutcomes({
      alerts: [alert],
      marks: marks([
        ["t0", 100],
        ["1h", 101],
        ["4h", 102],
        ["24h", 98],
        ["7d", 110],
      ]),
      now: at("7d"),
    });
    expect(rows).toHaveLength(4);
    expect(rowOf(rows, "1h")?.realizedReturn).toBeCloseTo(0.01);
    expect(rowOf(rows, "4h")?.realizedReturn).toBeCloseTo(0.02);
    expect(rowOf(rows, "24h")?.realizedReturn).toBeCloseTo(-0.02);
    expect(rowOf(rows, "7d")?.realizedReturn).toBeCloseTo(0.1);
    expect(rows.every((row) => row.resolvedAt !== null)).toBe(true);
  });

  it("leaves missing marks null so the job can retry", () => {
    const first = resolveOutcomes({
      alerts: [alert],
      marks: marks([
        ["t0", 100],
        ["1h", 101],
        ["4h", 102],
      ]),
      now: at("7d"),
    });
    expect(rowOf(first, "1h")?.realizedReturn).toBeCloseTo(0.01);
    expect(rowOf(first, "24h")?.realizedReturn).toBeNull();
    expect(rowOf(first, "7d")?.resolvedAt).toBeNull();

    const second = resolveOutcomes({
      alerts: [alert],
      marks: marks([
        ["t0", 100],
        ["1h", 101],
        ["4h", 102],
        ["24h", 97],
        ["7d", 105],
      ]),
      existing: first,
      now: at("7d"),
    });
    expect(rowOf(second, "1h")?.realizedReturn).toBeCloseTo(0.01);
    expect(rowOf(second, "24h")?.realizedReturn).toBeCloseTo(-0.03);
    expect(rowOf(second, "7d")?.realizedReturn).toBeCloseTo(0.05);
  });

  it("is idempotent once a horizon is resolved", () => {
    const first = resolveOutcomes({
      alerts: [alert],
      marks: marks([
        ["t0", 100],
        ["1h", 101],
        ["4h", 102],
        ["24h", 98],
        ["7d", 110],
      ]),
      now: at("7d"),
    });
    const second = resolveOutcomes({
      alerts: [alert],
      marks: marks([
        ["t0", 100],
        ["1h", 999],
        ["4h", 999],
        ["24h", 999],
        ["7d", 999],
      ]),
      existing: first,
      now: at("7d"),
    });
    expect(second).toEqual(first);
  });

  it("does not resolve a horizon that has not elapsed", () => {
    const rows = resolveOutcomes({
      alerts: [alert],
      marks: marks([
        ["t0", 100],
        ["1h", 101],
        ["4h", 102],
      ]),
      now: new Date(t0.getTime() + HORIZON_MS["1h"] + 1),
    });
    expect(rowOf(rows, "1h")?.realizedReturn).toBeCloseTo(0.01);
    expect(rowOf(rows, "4h")?.realizedReturn).toBeNull();
    expect(rowOf(rows, "24h")?.resolvedAt).toBeNull();
    expect(rowOf(rows, "7d")?.resolvedAt).toBeNull();
  });
});
