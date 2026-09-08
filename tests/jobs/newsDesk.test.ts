import { describe, expect, it } from "vitest";
import { heuristicLlm, MemoryNoveltyIndex } from "../../src/classify/index.js";
import type { RawItem } from "../../src/collectors/news/types.js";
import { runNewsDesk } from "../../src/jobs/newsDesk.js";
import { Policy } from "../../src/policy/index.js";
import { ChatStore } from "../../src/telegram/store.js";

function item(partial: Partial<RawItem> & Pick<RawItem, "url" | "title" | "body" | "sourceId" | "sourceRank">): RawItem {
  return {
    simhash: "1",
    publishedAt: new Date("2026-09-07T12:00:00.000Z"),
    ...partial,
  };
}

describe("news desk", () => {
  it("classifies RSS items and only Policy sends", async () => {
    const sent: string[] = [];
    const policy = new Policy({
      store: new ChatStore(),
      transport: { async send(_chat: string, html: string) { sent.push(html); } },
      chatId: "1",
      dryRun: false,
    });
    const venue = item({
      url: "https://www.coindesk.com/markets/venue-pause",
      title: "Major venue pauses BTC withdrawals after outage",
      body: "A large crypto exchange halted bitcoin withdrawals.",
      sourceId: "coindesk",
      sourceRank: 70,
    });
    const fedHack = item({
      url: "https://www.federalreserve.gov/hack-venue",
      title: "Exchange hack drains BTC",
      body: "A major exchange was hacked and drained.",
      sourceId: "fed",
      sourceRank: 95,
    });
    const result = await runNewsDesk([venue, fedHack], {
      llm: heuristicLlm(),
      policy,
      novelty: new MemoryNoveltyIndex(),
    });
    expect(result.events[0]?.class).toBe("EXCHANGE_STRESS");
    expect(result.events[1]?.class).toBe("HACK_VENUE");
    expect(result.emits.some((row) => row.decision.kind === "FLASH")).toBe(true);
    expect(sent.some((html) => html.includes("FLASH"))).toBe(true);
  });

  it("does not re-alert the same fingerprint", async () => {
    const sent: string[] = [];
    const policy = new Policy({
      store: new ChatStore(),
      transport: { async send(_c: string, html: string) { sent.push(html); } },
      chatId: "1",
      dryRun: false,
    });
    const novelty = new MemoryNoveltyIndex();
    const raw = item({
      url: "https://www.federalreserve.gov/hack-venue-2",
      title: "Exchange hack drains BTC",
      body: "A major exchange was hacked and drained.",
      sourceId: "fed",
      sourceRank: 95,
    });
    await runNewsDesk([raw], { llm: heuristicLlm(), policy, novelty });
    await runNewsDesk([raw], { llm: heuristicLlm(), policy, novelty });
    expect(sent.filter((html) => html.includes("FLASH"))).toHaveLength(1);
  });

  it("can FADE when tape opposes a loud ETF print", async () => {
    const sent: string[] = [];
    const policy = new Policy({
      store: new ChatStore(),
      transport: { async send(_c: string, html: string) { sent.push(html); } },
      chatId: "1",
      dryRun: false,
    });
    const etf = item({
      url: "https://farside.co.uk/btc/?as_of=2026-09-04",
      title: "US spot BTC ETF inflow $174.6m (04 Sep 2026)",
      body: "Farside US spot Bitcoin ETF inflow 174.6 million.",
      sourceId: "farside",
      sourceRank: 80,
    });
    const result = await runNewsDesk([etf], {
      llm: heuristicLlm(),
      policy,
      novelty: new MemoryNoveltyIndex(),
      snapshotFor: (asset, now) => ({
        ts: now,
        asset,
        exchangeNetflowZ: 2.2,
        stablecoinDeltaZ: null,
        funding: null,
        oiChangePct: null,
        cvd: -8,
        volRegime: "mid",
      }),
    });
    expect(result.emits[0]?.decision.kind).toBe("FADE");
    expect(sent[0]).toContain("FADE");
  });
});

