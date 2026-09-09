import { afterEach, describe, expect, it } from "vitest";
import {
  COINGECKO_SENTIMENT_TTL_MS,
  loadCoingeckoSentiment,
  parseCoingeckoSentiment,
  resetCoingeckoSentimentCache,
} from "../../src/jobs/coingeckoSentiment.js";

afterEach(() => {
  resetCoingeckoSentimentCache();
});

describe("parseCoingeckoSentiment", () => {
  it("normalizes BTC crowd votes into a mix-style score", () => {
    const parsed = parseCoingeckoSentiment(
      { sentiment_votes_up_percentage: 84, sentiment_votes_down_percentage: 16 },
      new Date("2026-09-09T12:00:00.000Z"),
    );
    expect(parsed).toMatchObject({
      source: "coingecko",
      asset: "BTC",
      up: 84,
      down: 16,
      score: 0.68,
      label: "+0.68",
    });
  });

  it("returns null when votes are missing", () => {
    expect(parseCoingeckoSentiment({ id: "bitcoin" })).toBeNull();
    expect(parseCoingeckoSentiment({ sentiment_votes_up_percentage: 50, sentiment_votes_down_percentage: -1 })).toBeNull();
  });
});

describe("loadCoingeckoSentiment", () => {
  it("does not refetch inside the TTL", async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      return new Response(JSON.stringify({ sentiment_votes_up_percentage: 70, sentiment_votes_down_percentage: 30 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    const t0 = Date.parse("2026-09-09T12:00:00.000Z");
    const first = await loadCoingeckoSentiment({
      fetchImpl,
      now: new Date(t0),
    });
    const second = await loadCoingeckoSentiment({
      fetchImpl,
      now: new Date(t0 + COINGECKO_SENTIMENT_TTL_MS - 1),
    });
    expect(first?.label).toBe("+0.40");
    expect(second).toEqual(first);
    expect(calls).toBe(1);
  });

  it("returns null on HTTP errors without throwing", async () => {
    const fetchImpl: typeof fetch = async () => new Response("nope", { status: 429 });
    await expect(loadCoingeckoSentiment({ fetchImpl, now: new Date("2026-09-09T12:00:00.000Z") })).resolves.toBeNull();
  });
});
