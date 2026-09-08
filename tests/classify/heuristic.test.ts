import { describe, expect, it } from "vitest";
import { heuristicExtract } from "../../src/classify/heuristic.js";
import type { RawItem } from "../../src/collectors/news/types.js";

function item(partial: Pick<RawItem, "sourceId" | "title" | "body">): RawItem {
  return {
    url: "https://example.com/x",
    sourceRank: 80,
    simhash: "0",
    publishedAt: new Date("2026-09-07T12:00:00.000Z"),
    ...partial,
  };
}

describe("heuristic extract", () => {
  it("maps Farside and venue stress without an LLM", () => {
    const etf = heuristicExtract(
      item({ sourceId: "farside", title: "US spot BTC ETF inflow", body: "IBIT took in 200m." }),
    );
    const stress = heuristicExtract(
      item({
        sourceId: "coindesk",
        title: "Major venue pauses BTC withdrawals after outage",
        body: "Exchange halted bitcoin withdrawals.",
      }),
    );
    expect(etf.class).toBe("ETF_INFLOW");
    expect(etf.polarity).toBeGreaterThan(0);
    expect(stress.class).toBe("EXCHANGE_STRESS");
    expect(stress.polarity).toBeLessThan(0);
  });
});
