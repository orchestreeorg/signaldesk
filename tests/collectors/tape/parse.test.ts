import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { nextBackoffMs } from "../../../src/collectors/tape/backoff.js";
import {
  parseAggTrade,
  parseForceOrder,
  parseMarkPrice,
  parseOpenInterest,
} from "../../../src/collectors/tape/parse.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) =>
  JSON.parse(readFileSync(join(here, "../../fixtures/tape", name), "utf8")) as unknown;

describe("tape parsers", () => {
  it("parses aggTrade into a TapeTick with CVD delta", () => {
    const tick = parseAggTrade(fixture("aggTrade.json"));
    expect(tick).toMatchObject({
      asset: "BTC",
      kind: "trade",
      price: 64000.1,
      qty: 0.25,
      side: "buy",
      cvdDelta: 0.25,
    });
  });

  it("parses forceOrder liquidations", () => {
    const tick = parseForceOrder(fixture("forceOrder.json"));
    expect(tick).toMatchObject({
      asset: "ETH",
      kind: "liquidation",
      side: "sell",
      price: 2399.8,
    });
  });

  it("parses markPrice funding", () => {
    const tick = parseMarkPrice(fixture("markPrice.json"));
    expect(tick).toMatchObject({
      asset: "BTC",
      kind: "mark",
      funding: 0.0001,
      price: 64010,
    });
  });

  it("parses open interest REST", () => {
    const tick = parseOpenInterest(fixture("openInterest.json"));
    expect(tick).toMatchObject({
      asset: "BTC",
      kind: "oi",
      openInterest: 18432.55,
    });
  });

  it("backs off reconnects exponentially up to 30s", () => {
    expect(nextBackoffMs(0)).toBe(500);
    expect(nextBackoffMs(1)).toBe(1000);
    expect(nextBackoffMs(2)).toBe(2000);
    expect(nextBackoffMs(10)).toBe(30_000);
  });
});
