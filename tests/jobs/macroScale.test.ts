import { describe, expect, it } from "vitest";
import type { MacroObservation, MacroSource } from "../../src/jobs/macroObservations.js";
import {
  buildMacroIndex,
  scaleDirectional,
  scaleFearGreed,
  scaleGold,
  scaleGpr,
  scaleOvx,
  weeklyReturn,
} from "../../src/jobs/macroScale.js";

function observation(source: MacroSource, value: number, day = "2026-09-10"): MacroObservation {
  return {
    source,
    value,
    asOf: new Date(`${day}T00:00:00.000Z`),
    aux: {},
  };
}

describe("macro 1–10 scales", () => {
  it("maps directional sentiment and contrarian fear/greed", () => {
    expect(scaleDirectional(0.6).score).toBe(8);
    expect(scaleFearGreed(20).score).toBe(7.5);
    expect(scaleFearGreed(80).score).toBe(2.5);
  });

  it("inverts OVX and GPR stress", () => {
    expect(scaleOvx(0)).toMatchObject({ score: 10, inverted: true });
    expect(scaleOvx(80)).toMatchObject({ score: 1, inverted: true });
    expect(scaleGpr(100)).toMatchObject({ score: 5, inverted: true });
    expect(scaleGpr(250).score).toBe(1);
  });

  it("inverts a gold rally under macro stress", () => {
    const result = scaleGold(0.02, { ovxScore: 3, gprScore: 5, sp500Score: 7 });
    expect(result.inverted).toBe(true);
    expect(result.score).toBeLessThan(5);
  });
});

describe("weekly macro index", () => {
  it("uses the sixth daily point as a five-session baseline", () => {
    const rows = [110, 108, 106, 104, 102, 100].map((value, index) =>
      observation("sp500", value, `2026-09-${String(10 - index).padStart(2, "0")}`),
    );
    expect(weeklyReturn(rows)).toBeCloseTo(0.1);
  });

  it("excludes a missing SPX history and renormalizes available weights", () => {
    const index = buildMacroIndex([observation("coingecko", 0.6)]);
    expect(index?.score).toBe(8);
    expect(index?.legs.find((leg) => leg.id === "sp500")).toMatchObject({
      included: false,
      score: null,
    });
  });

  it("marks widely disagreeing legs as conflicted and caps the label", () => {
    const index = buildMacroIndex([
      observation("coingecko", 1),
      observation("ovx", 80),
    ]);
    expect(index).toMatchObject({ conflicted: true, label: "Neutral" });
    expect(index?.score).not.toBe(5);
  });
});
