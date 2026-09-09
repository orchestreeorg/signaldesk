import { afterEach, describe, expect, it } from "vitest";
import {
  CMC_FEAR_GREED_TTL_MS,
  loadCmcFearGreed,
  parseCmcFearGreed,
  resetCmcFearGreedCache,
} from "../../src/jobs/cmcFearGreed.js";

afterEach(() => {
  resetCmcFearGreedCache();
});

describe("parseCmcFearGreed", () => {
  it("maps CMC latest JSON into a 0-100 linear split", () => {
    const parsed = parseCmcFearGreed({
      data: { value: 74, value_classification: "Greed", update_time: "2026-09-09T12:38:10.028Z" },
    });
    expect(parsed).toEqual({
      source: "coinmarketcap",
      value: 74,
      classification: "Greed",
      greed: 74,
      fear: 26,
      asOf: "2026-09-09T12:38:10.028Z",
    });
  });

  it("returns null when the index is missing", () => {
    expect(parseCmcFearGreed({ data: {} })).toBeNull();
    expect(parseCmcFearGreed({ data: { value: 74 } })).toBeNull();
  });
});

describe("loadCmcFearGreed", () => {
  it("does not refetch inside the TTL", async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      return new Response(
        JSON.stringify({ data: { value: 40, value_classification: "Neutral", update_time: "2026-09-09T12:00:00.000Z" } }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };
    const t0 = Date.parse("2026-09-09T12:00:00.000Z");
    const first = await loadCmcFearGreed({ fetchImpl, now: new Date(t0) });
    const second = await loadCmcFearGreed({ fetchImpl, now: new Date(t0 + CMC_FEAR_GREED_TTL_MS - 1) });
    expect(first?.classification).toBe("Neutral");
    expect(second).toEqual(first);
    expect(calls).toBe(1);
  });

  it("returns null on HTTP errors without throwing", async () => {
    const fetchImpl: typeof fetch = async () => new Response("nope", { status: 429 });
    await expect(loadCmcFearGreed({ fetchImpl, now: new Date("2026-09-09T12:00:00.000Z") })).resolves.toBeNull();
  });
});
