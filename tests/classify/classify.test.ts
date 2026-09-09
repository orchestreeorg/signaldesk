import { describe, expect, it } from "vitest";
import type { RawItem } from "../../src/collectors/news/types.js";
import { classifyRawItem, MemoryNoveltyIndex, mockLlm } from "../../src/classify/index.js";
import { CLASSIFY_SYSTEM_PROMPT } from "../../src/classify/prompt.js";
import type { LlmExtract } from "../../src/classify/types.js";

function item(partial: Partial<RawItem> & Pick<RawItem, "url" | "title" | "body" | "sourceId" | "sourceRank">): RawItem {
  return {
    simhash: "0",
    publishedAt: new Date("2026-09-07T12:00:00.000Z"),
    ...partial,
  };
}

const extracts: Record<string, LlmExtract> = {
  "https://example.com/exploit": {
    class: "HACK_PROTOCOL",
    assets: ["ETH"],
    polarity: -0.9,
    summary: "Protocol drained",
  },
  "https://example.com/fomc": {
    class: "MACRO_SURPRISE",
    assets: ["BTC"],
    polarity: 0.4,
    summary: "FOMC holds, hawkish surprise",
  },
  "https://example.com/etf": {
    class: "ETF_INFLOW",
    assets: ["BTC"],
    polarity: 0.6,
    summary: "US spot ETF net inflow",
  },
  "https://example.com/unlock": {
    class: "UNLOCK",
    assets: ["ETH"],
    polarity: -0.3,
    summary: "Cliff unlock next week",
  },
  "https://example.com/lawsuit": {
    class: "ENFORCEMENT",
    assets: ["BTC"],
    polarity: -0.5,
    summary: "SEC sues issuer",
  },
  "https://example.com/junk": {
    class: "HACK_VENUE",
    assets: ["BTC"],
    polarity: -1,
    summary: "Guaranteed 100x airdrop hack rumor",
  },
};

describe("classify", () => {
  const llm = mockLlm(extracts);

  it("keeps the extract prompt free of probabilities", () => {
    expect(CLASSIFY_SYSTEM_PROMPT).toMatch(/Do not output probabilities/);
    expect(CLASSIFY_SYSTEM_PROMPT).not.toMatch(/pUp|P\(up/);
  });

  it("maps exploit to HACK_PROTOCOL", async () => {
    const classified = await classifyRawItem(
      item({
        url: "https://example.com/exploit",
        title: "DEX exploit drains ETH",
        body: "A protocol exploit drained the pool.",
        sourceId: "theblock",
        sourceRank: 75,
      }),
      llm,
      new MemoryNoveltyIndex(),
    );
    expect(classified.class).toBe("HACK_PROTOCOL");
    expect(classified.assets).toEqual(["ETH"]);
    expect(classified.polarity).toBe(-0.9);
    expect(classified.novelty).toBe(1);
    expect(classified).not.toHaveProperty("pUp");
  });

  it("maps FOMC to MACRO_SURPRISE", async () => {
    const classified = await classifyRawItem(
      item({
        url: "https://example.com/fomc",
        title: "FOMC holds rates",
        body: "Fed statement surprised markets.",
        sourceId: "fed",
        sourceRank: 95,
      }),
      llm,
      new MemoryNoveltyIndex(),
    );
    expect(classified.class).toBe("MACRO_SURPRISE");
    expect(classified.isPrimary).toBe(true);
    expect(classified.credibility).toBeGreaterThan(0.9);
  });

  it("maps ETF flow, unlock, and lawsuit", async () => {
    const novelty = new MemoryNoveltyIndex();
    const etf = await classifyRawItem(
      item({
        url: "https://example.com/etf",
        title: "Bitcoin ETF inflow",
        body: "Spot BTC ETFs took in 400m.",
        sourceId: "farside",
        sourceRank: 80,
      }),
      llm,
      novelty,
    );
    const unlock = await classifyRawItem(
      item({
        url: "https://example.com/unlock",
        title: "Token unlock",
        body: "ETH cliff unlock.",
        sourceId: "coindesk",
        sourceRank: 70,
      }),
      llm,
      novelty,
    );
    const lawsuit = await classifyRawItem(
      item({
        url: "https://example.com/lawsuit",
        title: "SEC lawsuit",
        body: "Enforcement action filed.",
        sourceId: "edgar",
        sourceRank: 90,
      }),
      llm,
      novelty,
    );
    expect(etf.class).toBe("ETF_INFLOW");
    expect(unlock.class).toBe("UNLOCK");
    expect(lawsuit.class).toBe("ENFORCEMENT");
    expect(lawsuit.isPrimary).toBe(true);
  });

  it("does not let junk blog spam become a FLASH-class with high credibility", async () => {
    const classified = await classifyRawItem(
      item({
        url: "https://example.com/junk",
        title: "Guaranteed 100x airdrop",
        body: "Click here for free money hack rumor.",
        sourceId: "spamblog",
        sourceRank: 20,
      }),
      llm,
      new MemoryNoveltyIndex(),
    );
    expect(classified.class).toBe("OTHER");
    expect(classified.credibility).toBeLessThanOrEqual(0.25);
  });

  it("sets novelty to 0 when the fingerprint was seen in 24h", async () => {
    const novelty = new MemoryNoveltyIndex();
    const raw = item({
      url: "https://example.com/etf",
      title: "Bitcoin ETF inflow",
      body: "Spot BTC ETFs took in 400m.",
      sourceId: "farside",
      sourceRank: 80,
    });
    const first = await classifyRawItem(raw, llm, novelty);
    novelty.remember(first.fingerprint, raw.publishedAt);
    const second = await classifyRawItem(raw, llm, novelty);
    expect(first.novelty).toBe(1);
    expect(second.novelty).toBe(0);
    expect(second.fingerprint).toBe(first.fingerprint);
  });

  it("does not let the LLM relabel a mempool transfer", async () => {
    let called = 0;
    const classified = await classifyRawItem(
      item({
        url: "https://mempool.space/tx/aa11",
        title: "Large BTC transfer: 1,240 BTC",
        body: "1,240 BTC on-chain. tx aa11. block 900001.",
        sourceId: "mempool",
        sourceRank: 70,
      }),
      {
        async extract() {
          called += 1;
          return { class: "ETF_INFLOW", assets: ["ETH"], polarity: 0.9, summary: "should be ignored" };
        },
      },
      new MemoryNoveltyIndex(),
    );
    expect(called).toBe(0);
    expect(classified.class).toBe("OTHER");
    expect(classified.assets).toEqual(["BTC"]);
    expect(classified.polarity).toBe(0);
  });

  it("falls back to the heuristic when the LLM throws", async () => {
    const classified = await classifyRawItem(
      item({
        url: "https://example.com/venue-down",
        title: "Major venue pauses BTC withdrawals after outage",
        body: "A large crypto exchange halted bitcoin withdrawals.",
        sourceId: "coindesk",
        sourceRank: 70,
      }),
      { async extract() { throw new Error("LLM 500"); } },
      new MemoryNoveltyIndex(),
    );
    expect(classified.class).toBe("EXCHANGE_STRESS");
  });
});
