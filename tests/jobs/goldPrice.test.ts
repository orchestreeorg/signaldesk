import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_YAHOO_GOLD_URL,
  GOLD_PRICE_TTL_MS,
  loadGoldPrice,
  parseYahooGold,
  parseYahooGoldObservations,
  resetGoldPriceCache,
} from "../../src/jobs/goldPrice.js";

afterEach(() => {
  resetGoldPriceCache();
});

function yahooGold(partial?: { price?: number; previous?: number; time?: number; closes?: Array<number | null> }) {
  return {
    chart: {
      result: [
        {
          timestamp: [1, 2, 3],
          meta: {
            regularMarketPrice: partial?.price ?? 4435.2,
            chartPreviousClose: partial?.previous ?? 4393.9,
            regularMarketTime: partial?.time ?? 1_788_967_656,
          },
          indicators: {
            quote: [{ close: partial?.closes ?? [4300, 4393.9, 4435.2] }],
          },
        },
      ],
    },
  };
}

describe("parseYahooGold", () => {
  it("uses live price vs previous close", () => {
    expect(parseYahooGold(yahooGold())).toMatchObject({
      source: "yahoo",
      symbol: "GC=F",
      value: 4435.2,
      changePct: 0.94,
      asOf: new Date(1_788_967_656 * 1000).toISOString(),
    });
  });

  it("falls back to daily closes when meta prices are missing", () => {
    const parsed = parseYahooGold({
      chart: {
        result: [
          {
            timestamp: [100, 200],
            meta: {},
            indicators: { quote: [{ close: [4000, 4100] }] },
          },
        ],
      },
    });
    expect(parsed).toMatchObject({
      value: 4100,
      changePct: 2.5,
      asOf: "1970-01-01T00:03:20.000Z",
    });
  });

  it("returns null when every close is missing", () => {
    expect(parseYahooGold({ chart: { result: [{ timestamp: [1], meta: {}, indicators: { quote: [{ close: [null] }] } }] } })).toBeNull();
    expect(parseYahooGold({})).toBeNull();
  });

  it("exposes daily closes and requests at least one month", () => {
    expect(parseYahooGoldObservations(yahooGold())).toHaveLength(3);
    expect(new URL(DEFAULT_YAHOO_GOLD_URL).searchParams.get("range")).toBe("1mo");
  });
});

describe("loadGoldPrice", () => {
  it("does not refetch inside the TTL", async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      return new Response(JSON.stringify(yahooGold()), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    const t0 = Date.parse("2026-09-09T12:00:00.000Z");
    const first = await loadGoldPrice({ fetchImpl, now: new Date(t0) });
    const second = await loadGoldPrice({ fetchImpl, now: new Date(t0 + GOLD_PRICE_TTL_MS - 1) });
    expect(first?.value).toBe(4435.2);
    expect(second).toEqual(first);
    expect(calls).toBe(1);
  });

  it("returns null on HTTP errors without throwing", async () => {
    const fetchImpl: typeof fetch = async () => new Response("nope", { status: 429 });
    await expect(loadGoldPrice({ fetchImpl, now: new Date("2026-09-09T12:00:00.000Z") })).resolves.toBeNull();
  });
});
