import { afterEach, describe, expect, it } from "vitest";
import {
  NEAR_INTEL_MAX_TOKENS,
  NEAR_NOTE_SYSTEM_PROMPT,
  buildNearNoteUser,
  loadNearNote,
  parseNearRelatives,
  resetNearNoteCache,
  sanitizeNearNote,
} from "../../src/jobs/nearNote.js";
import type { NearHeadline } from "../../src/jobs/nearNews.js";
import type { NearPosition } from "../../src/jobs/nearLots.js";
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

describe("NEAR 6h intel note", () => {
  it("uses the market-intel prompt and asks for a single action", () => {
    expect(NEAR_NOTE_SYSTEM_PROMPT).toContain("You are the market intelligence analyst responsible for a significant");
    expect(NEAR_NOTE_SYSTEM_PROMPT).toContain("investment in NEAR Protocol ($NEAR).");
    expect(NEAR_NOTE_SYSTEM_PROMPT).toContain("NEAR INTENTS");
    expect(NEAR_NOTE_SYSTEM_PROMPT).toContain("CONTRARIAN CHECK");
    expect(NEAR_NOTE_SYSTEM_PROMPT).toContain("HOLD / LET WINNERS RUN");
    expect(NEAR_NOTE_SYSTEM_PROMPT).toContain("NO MATERIAL CHANGE IN THESIS.");
    expect(NEAR_NOTE_SYSTEM_PROMPT).toContain("Never invent unavailable data.");
    expect(NEAR_INTEL_MAX_TOKENS).toBe(3500);
  });

  it("builds a grounded user payload with coverage gaps marked", () => {
    const user = buildNearNoteUser({
      now,
      quote,
      position,
      headlines,
      athUsd: 58_233,
      relatives: parseNearRelatives({
        near: { usd: 4.2, usd_24h_change: 18.27, usd_24h_vol: 120_000_000 },
        bitcoin: { usd: 64_000, usd_24h_change: 1.1 },
        ethereum: { usd: 2_400, usd_24h_change: 0.8 },
        solana: { usd: 140, usd_24h_change: 2.2 },
      }, now),
    });
    expect(user).toContain("as_of: 18:00 ART (2026-09-20T21:00:00.000Z)");
    expect(user).toContain("window: last 6h");
    expect(user).toContain("quote: 4.2 USD  18.27% 24h  source=coingecko");
    expect(user).toContain("near_usd_change_6h: unavailable");
    expect(user).toContain("near_usd_change_24h: 18.27%");
    expect(user).toContain("near_usd_change_7d: unavailable");
    expect(user).toContain("holdings: 13865 NEAR");
    expect(user).toContain("mark_usd: 58233");
    expect(user).toContain("ath_usd: 58233");
    expect(user).toContain("NEAR/BTC:");
    expect(user).toContain("NEAR_spot_volume_24h_usd: 120000000");
    expect(user).toContain("BULLISH Google News  NEAR Protocol Hits $242M TVL All-Time High");
    expect(user).toContain("desk_coverage_unavailable:");
    expect(user).toContain("previous_window: unavailable");
    expect(user).not.toMatch(/entry 12075/);
  });

  it("skips the LLM when the API key is empty", async () => {
    const result = await loadNearNote({
      now,
      quote,
      position,
      headlines,
      relatives: null,
      apiKey: "",
      complete: async () => {
        throw new Error("should not call");
      },
    });
    expect(result).toMatchObject({ note: null, status: "skipped", reason: "no-key" });
  });

  it("calls the LLM again and includes the previous report", async () => {
    let users: string[] = [];
    const complete = async (opts: { user: string; maxTokens?: number; timeoutMs?: number }) => {
      users.push(opts.user);
      expect(opts.maxTokens).toBe(3500);
      expect(opts.timeoutMs).toBe(60_000);
      return "15. ACTIONABLE CONCLUSION\nHOLD / LET WINNERS RUN\nNO MATERIAL CHANGE IN THESIS.";
    };
    const first = await loadNearNote({ now, quote, position, headlines, relatives: null, apiKey: "k", complete });
    const second = await loadNearNote({ now, quote, position, headlines, relatives: null, apiKey: "k", complete });
    expect(first.status).toBe("attached");
    expect(second.status).toBe("attached");
    expect(users).toHaveLength(2);
    expect(users[1]).toContain("previous_report:");
    expect(users[1]).toContain("HOLD / LET WINNERS RUN");
  });

  it("still has no note when the LLM fails", async () => {
    const result = await loadNearNote({
      now,
      quote,
      position,
      headlines,
      relatives: null,
      apiKey: "k",
      complete: async () => {
        throw new Error("LLM 500");
      },
    });
    expect(result).toMatchObject({ note: null, status: "failed", reason: "error" });
  });

  it("keeps a long intel note instead of clipping to 8 lines", () => {
    const raw = Array.from({ length: 40 }, (_, i) => `${i + 1}. line`).join("\n");
    const note = sanitizeNearNote(raw);
    expect(note?.split("\n")).toHaveLength(40);
  });
});
