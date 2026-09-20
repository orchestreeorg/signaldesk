import { afterEach, describe, expect, it } from "vitest";
import {
  NEAR_PRICE_TTL_MS,
  loadNearPrice,
  lotValueFromQuote,
  parseCoingeckoNearPrice,
  parseYahooNearPrice,
  resetNearPriceCache,
} from "../../src/jobs/nearPrice.js";

afterEach(() => {
  resetNearPriceCache();
});

describe("NEAR live price", () => {
  it("parses CoinGecko simple price", () => {
    const quote = parseCoingeckoNearPrice(
      { near: { usd: 2.45123, usd_24h_change: 3.21 } },
      new Date("2026-09-20T21:00:00.000Z"),
    );
    expect(quote).toMatchObject({
      source: "coingecko",
      symbol: "NEAR",
      value: 2.45123,
      changePct: 3.21,
    });
  });

  it("parses Yahoo NEAR-USD and falls back when CoinGecko fails", async () => {
    expect(
      parseYahooNearPrice({
        chart: {
          result: [
            {
              meta: {
                regularMarketPrice: 2.4,
                chartPreviousClose: 2,
                regularMarketTime: 1_788_967_656,
              },
            },
          ],
        },
      }),
    ).toMatchObject({ source: "yahoo", value: 2.4, changePct: 20 });

    let calls = 0;
    const fetchImpl: typeof fetch = async (url) => {
      calls += 1;
      if (String(url).includes("coingecko")) {
        return new Response("nope", { status: 429 });
      }
      return new Response(
        JSON.stringify({
          chart: { result: [{ meta: { regularMarketPrice: 2.5, chartPreviousClose: 2.4, regularMarketTime: 100 } }] },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };
    const quote = await loadNearPrice({ fetchImpl, now: new Date("2026-09-20T21:00:00.000Z") });
    expect(quote).toMatchObject({ source: "yahoo", value: 2.5 });
    expect(calls).toBe(2);
  });

  it("does not refetch inside the TTL", async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      return new Response(JSON.stringify({ near: { usd: 2.1, usd_24h_change: 1 } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    const t0 = Date.parse("2026-09-20T21:00:00.000Z");
    const first = await loadNearPrice({ fetchImpl, now: new Date(t0) });
    const second = await loadNearPrice({ fetchImpl, now: new Date(t0 + NEAR_PRICE_TTL_MS - 1) });
    expect(first?.value).toBe(2.1);
    expect(second).toEqual(first);
    expect(calls).toBe(1);
  });

  it("sizes a lot from the live quote", () => {
    expect(lotValueFromQuote(100, { source: "coingecko", symbol: "NEAR", value: 2.5, changePct: 0, asOf: "" })).toBe(250);
    expect(lotValueFromQuote(0, { source: "coingecko", symbol: "NEAR", value: 2.5, changePct: 0, asOf: "" })).toBeNull();
  });
});
