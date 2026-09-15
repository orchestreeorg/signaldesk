import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_YAHOO_OVX_URL,
  FRED_OVX_TTL_MS,
  classifyOvx,
  loadFredOvx,
  ovxBar,
  parseYahooOvx,
  parseYahooOvxObservations,
  resetFredOvxCache,
} from "../../src/jobs/fredOvx.js";

afterEach(() => {
  resetFredOvxCache();
});

function yahooOvx(partial?: { price?: number; time?: number; closes?: Array<number | null> }) {
  return {
    chart: {
      result: [
        {
          timestamp: [1, 2, 3],
          meta: {
            regularMarketPrice: partial?.price ?? 32.14,
            regularMarketTime: partial?.time ?? 1_788_967_656,
          },
          indicators: {
            quote: [{ close: partial?.closes ?? [28.5, 30, 32.14] }],
          },
        },
      ],
    },
  };
}

describe("parseYahooOvx", () => {
  it("uses live OVX and classifies stress", () => {
    const parsed = parseYahooOvx(yahooOvx());
    expect(parsed).toMatchObject({
      source: "yahoo",
      symbol: "^OVX",
      value: 32.14,
      classification: "Normal",
      asOf: new Date(1_788_967_656 * 1000).toISOString(),
    });
    expect(parsed?.stress).toBeCloseTo((32.14 / 80) * 100);
    expect(parsed?.calm).toBeCloseTo(100 - (32.14 / 80) * 100);
  });

  it("falls back to daily closes when meta price is missing", () => {
    const parsed = parseYahooOvx({
      chart: {
        result: [
          {
            timestamp: [100, 200],
            meta: {},
            indicators: { quote: [{ close: [30, 48] }] },
          },
        ],
      },
    });
    expect(parsed).toMatchObject({
      value: 48,
      classification: "Elevated",
      asOf: "1970-01-01T00:03:20.000Z",
    });
  });

  it("returns null when every close is missing", () => {
    expect(
      parseYahooOvx({ chart: { result: [{ timestamp: [1], meta: {}, indicators: { quote: [{ close: [null] }] } }] } }),
    ).toBeNull();
    expect(parseYahooOvx({})).toBeNull();
  });

  it("exposes daily closes and requests at least one month", () => {
    expect(parseYahooOvxObservations(yahooOvx())).toHaveLength(3);
    expect(new URL(DEFAULT_YAHOO_OVX_URL).searchParams.get("range")).toBe("1mo");
    expect(new URL(DEFAULT_YAHOO_OVX_URL).pathname).toContain("%5EOVX");
  });
});

describe("classifyOvx", () => {
  it("buckets oil implied vol", () => {
    expect(classifyOvx(18)).toBe("Calm");
    expect(classifyOvx(32)).toBe("Normal");
    expect(classifyOvx(48)).toBe("Elevated");
    expect(classifyOvx(70)).toBe("High");
  });
});

describe("ovxBar", () => {
  it("caps stress at 80 OVX", () => {
    expect(ovxBar(80)).toEqual({ stress: 100, calm: 0 });
    expect(ovxBar(40)).toEqual({ stress: 50, calm: 50 });
  });
});

describe("loadFredOvx", () => {
  it("does not refetch inside the TTL", async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      return new Response(JSON.stringify(yahooOvx({ price: 28.5 })), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    const t0 = Date.parse("2026-09-09T12:00:00.000Z");
    const first = await loadFredOvx({ fetchImpl, now: new Date(t0) });
    const second = await loadFredOvx({ fetchImpl, now: new Date(t0 + FRED_OVX_TTL_MS - 1) });
    expect(first?.value).toBe(28.5);
    expect(second).toEqual(first);
    expect(calls).toBe(1);
  });

  it("returns null on HTTP errors without throwing and does not need a FRED key", async () => {
    const fetchImpl: typeof fetch = async () => new Response("nope", { status: 429 });
    await expect(loadFredOvx({ fetchImpl, now: new Date("2026-09-09T12:00:00.000Z") })).resolves.toBeNull();
  });
});
