import { afterEach, describe, expect, it } from "vitest";
import {
  NEAR_NOTE_SYSTEM_PROMPT,
  buildNearNoteUser,
  fingerprintNearNote,
  loadNearNote,
  resetNearNoteCache,
} from "../../src/jobs/nearNote.js";
import type { NearHeadline } from "../../src/jobs/nearNews.js";
import type { NearLot, NearPosition } from "../../src/jobs/nearLots.js";
import type { NearQuote } from "../../src/jobs/nearPrice.js";

const now = new Date("2026-09-20T21:00:00.000Z");

const quote: NearQuote = {
  source: "coingecko",
  symbol: "NEAR",
  value: 4.2,
  changePct: 18.27,
  asOf: "2026-09-20T21:00:00.000Z",
};

const position: NearPosition = {
  tokens: 13865,
  value: 57551,
  entries: 2,
  exits: 0,
};

const lots: NearLot[] = [
  {
    id: "lot-1",
    side: "entry",
    at: new Date("2026-09-20T21:33:00.000Z"),
    tokens: 12075,
    value: 50351,
  },
];

const headlines: NearHeadline[] = [
  {
    title: "NEAR Protocol Hits $242M TVL All-Time High",
    url: "https://example.com/tvl",
    href: "https://example.com/tvl",
    sourceId: "near-gnews",
    sourceName: "Google News",
    publishedAt: "2026-09-20T20:00:00.000Z",
    tone: "BULLISH",
  },
];

afterEach(() => {
  resetNearNoteCache();
});

describe("NEAR hourly note", () => {
  it("uses the clerk prompt and does not ask for a trade", () => {
    expect(NEAR_NOTE_SYSTEM_PROMPT).toContain("You are a NEAR desk clerk, not an advisor.");
    expect(NEAR_NOTE_SYSTEM_PROMPT).toContain("No buy, sell, add, trim, target, or “you should.”");
    expect(NEAR_NOTE_SYSTEM_PROMPT).not.toMatch(/recommend (buying|selling)|you should buy|price target/i);
  });

  it("builds a grounded user payload", () => {
    const user = buildNearNoteUser({ now, quote, position, lots, headlines });
    expect(user).toContain("as_of: 18:00 ART");
    expect(user).toContain("quote: 4.2 USD  18.27%  source=coingecko");
    expect(user).toContain("holdings: 13865 NEAR");
    expect(user).toContain("mark_usd: 58233");
    expect(user).toContain("book_net_usd: 57551");
    expect(user).toContain("entry 12075 · 50351");
    expect(user).toContain("BULLISH Google News  NEAR Protocol Hits $242M TVL All-Time High");
    expect(user).not.toMatch(/previous_hour/);
  });

  it("skips the LLM when the API key is empty", async () => {
    const result = await loadNearNote({
      now,
      quote,
      position,
      lots,
      headlines,
      apiKey: "",
      complete: async () => {
        throw new Error("should not call");
      },
    });
    expect(result).toMatchObject({ note: null, status: "skipped", reason: "no-key" });
  });

  it("skips the LLM when the fingerprint is unchanged", async () => {
    let calls = 0;
    const complete = async () => {
      calls += 1;
      return "MARK — $4.20\nBOOK — last entry below mark\nTAPE — Google News TVL\nWATCH — lose 4.20";
    };
    const first = await loadNearNote({ now, quote, position, lots, headlines, apiKey: "k", complete });
    const second = await loadNearNote({ now, quote, position, lots, headlines, apiKey: "k", complete });
    expect(first.status).toBe("attached");
    expect(second).toMatchObject({ note: null, status: "skipped", reason: "unchanged" });
    expect(calls).toBe(1);
    expect(fingerprintNearNote({ quote, tokens: position.tokens, lots, headlines })).toContain("lot-1");
  });

  it("still has no note when the LLM fails", async () => {
    const result = await loadNearNote({
      now,
      quote,
      position,
      lots,
      headlines,
      apiKey: "k",
      complete: async () => {
        throw new Error("LLM 500");
      },
    });
    expect(result).toMatchObject({ note: null, status: "failed", reason: "error" });
  });
});
