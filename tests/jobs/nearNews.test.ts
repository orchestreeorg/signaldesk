import { afterEach, describe, expect, it } from "vitest";
import {
  headlinesFromFeed,
  isNearStory,
  loadNearNews,
  mergeNearHeadlines,
  resetNearNewsCache,
  type NearNewsSource,
} from "../../src/jobs/nearNews.js";

afterEach(() => {
  resetNearNewsCache();
});

const dedicated: NearNewsSource = {
  id: "near-gov",
  name: "NEAR Forum",
  url: "https://gov.near.org/latest.rss",
  dedicated: true,
};

const filtered: NearNewsSource = {
  id: "coindesk",
  name: "CoinDesk",
  url: "https://www.coindesk.com/arc/outboundfeeds/rss/",
  dedicated: false,
};

const feed = `<?xml version="1.0"?>
<rss><channel>
  <item>
    <title>NEAR Protocol hits a TVL high</title>
    <link>https://example.com/near-tvl</link>
    <pubDate>Sun, 20 Sep 2026 12:00:00 GMT</pubDate>
  </item>
  <item>
    <title>Bitcoin ETF posts record inflow</title>
    <link>https://example.com/btc-etf</link>
    <pubDate>Sun, 20 Sep 2026 11:00:00 GMT</pubDate>
  </item>
</channel></rss>`;

describe("NEAR news filter", () => {
  it("matches the ticker, not the English word near", () => {
    expect(isNearStory("NEAR Protocol hits TVL high")).toBe(true);
    expect(isNearStory("NEAR adds 32% as tokenization leads")).toBe(true);
    expect(isNearStory("Markets near a turning point")).toBe(false);
  });

  it("keeps every dedicated-feed item and filters general RSS", () => {
    const gov = headlinesFromFeed(dedicated, feed);
    const desk = headlinesFromFeed(filtered, feed);
    expect(gov.map((row) => row.title)).toEqual([
      "NEAR Protocol hits a TVL high",
      "Bitcoin ETF posts record inflow",
    ]);
    expect(desk.map((row) => row.title)).toEqual(["NEAR Protocol hits a TVL high"]);
    expect(desk[0]?.href).toContain("https://");
  });

  it("dedupes and sorts newest first", () => {
    const merged = mergeNearHeadlines([
      {
        title: "older",
        url: "https://example.com/c",
        href: "https://example.com/c",
        sourceId: "near-gov",
        sourceName: "NEAR Forum",
        publishedAt: "2026-09-20T10:00:00.000Z",
        tone: "NEUTRAL",
      },
      {
        title: "newer",
        url: "https://example.com/b",
        href: "https://example.com/b",
        sourceId: "near-gnews",
        sourceName: "Google News",
        publishedAt: "2026-09-20T12:00:00.000Z",
        tone: "BULLISH",
      },
      {
        title: "dup",
        url: "https://example.com/c",
        href: "https://example.com/c",
        sourceId: "coindesk",
        sourceName: "CoinDesk",
        publishedAt: "2026-09-20T11:00:00.000Z",
        tone: "NEUTRAL",
      },
    ]);
    expect(merged.map((row) => row.title)).toEqual(["newer", "dup"]);
  });

  it("does not refetch inside the TTL", async () => {
    let calls = 0;
    const fetchXml = async () => {
      calls += 1;
      return feed;
    };
    await loadNearNews({ now: new Date("2026-09-20T12:00:00.000Z"), fetchXml });
    await loadNearNews({ now: new Date("2026-09-20T12:05:00.000Z"), fetchXml });
    expect(calls).toBe(4);
  });
});
