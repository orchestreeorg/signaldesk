import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_YAHOO_SP500_URL,
  FRED_SP500_TTL_MS,
  loadFredSp500,
  parseYahooSp500,
  parseYahooSp500Observations,
  resetFredSp500Cache,
} from "../../src/jobs/fredSp500.js";

afterEach(() => {
  resetFredSp500Cache();
});

function yahooSp500(partial?: { price?: number; previous?: number; time?: number; closes?: Array<number | null> }) {
  return {
    chart: {
      result: [
        {
          timestamp: [1, 2, 3],
          meta: {
            regularMarketPrice: partial?.price ?? 6500.25,
            chartPreviousClose: partial?.previous ?? 6450,
            regularMarketTime: partial?.time ?? 1_788_967_656,
          },
          indicators: {
            quote: [{ close: partial?.closes ?? [6400, 6450, 6500.25] }],
          },
        },
      ],
    },
  };
}

describe("parseYahooSp500", () => {
  it("uses live price vs previous close", () => {
    expect(parseYahooSp500(yahooSp500())).toMatchObject({
      source: "yahoo",
      symbol: "^GSPC",
      value: 6500.25,
      changePct: 0.78,
      asOf: new Date(1_788_967_656 * 1000).toISOString(),
    });
  });

  it("falls back to daily closes when meta prices are missing", () => {
    const parsed = parseYahooSp500({
      chart: {
        result: [
          {
            timestamp: [100, 200],
            meta: {},
            indicators: { quote: [{ close: [6400, 6500] }] },
          },
        ],
      },
    });
    expect(parsed).toMatchObject({
      value: 6500,
      changePct: 1.56,
      asOf: "1970-01-01T00:03:20.000Z",
    });
  });

  it("returns null when every close is missing", () => {
    expect(
      parseYahooSp500({ chart: { result: [{ timestamp: [1], meta: {}, indicators: { quote: [{ close: [null] }] } }] } }),
    ).toBeNull();
    expect(parseYahooSp500({})).toBeNull();
  });

  it("exposes daily closes and requests at least one month", () => {
    expect(parseYahooSp500Observations(yahooSp500())).toHaveLength(3);
    expect(new URL(DEFAULT_YAHOO_SP500_URL).searchParams.get("range")).toBe("1mo");
    expect(new URL(DEFAULT_YAHOO_SP500_URL).pathname).toContain("%5EGSPC");
  });
});

describe("loadFredSp500", () => {
  it("does not refetch inside the TTL", async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      return new Response(JSON.stringify(yahooSp500()), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    const t0 = Date.parse("2026-09-09T12:00:00.000Z");
    const first = await loadFredSp500({ fetchImpl, now: new Date(t0) });
    const second = await loadFredSp500({ fetchImpl, now: new Date(t0 + FRED_SP500_TTL_MS - 1) });
    expect(first?.value).toBe(6500.25);
    expect(second).toEqual(first);
    expect(calls).toBe(1);
  });

  it("returns null on HTTP errors without throwing and does not need a FRED key", async () => {
    const fetchImpl: typeof fetch = async () => new Response("nope", { status: 429 });
    await expect(loadFredSp500({ fetchImpl, now: new Date("2026-09-09T12:00:00.000Z") })).resolves.toBeNull();
  });
});
