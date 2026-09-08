import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { TapeTick } from "../../src/collectors/tape/types.js";
import { BAR_MS, buildFeatureSnapshots, nullFlowAdapter } from "../../src/features/index.js";

const here = dirname(fileURLToPath(import.meta.url));

function tick(partial: Omit<TapeTick, "symbol"> & { symbol?: string }): TapeTick {
  return { symbol: `${partial.asset}USDT`, ...partial };
}

function syntheticTicks(t0: Date): TapeTick[] {
  const ticks: TapeTick[] = [];
  for (let i = 0; i < 36; i += 1) {
    const ts = new Date(t0.getTime() + i * BAR_MS);
    let price = 100;
    if (i < 12) {
      price = 100 + (i % 2) * 0.01;
    } else if (i < 24) {
      price = 100 + (i % 2) * 1;
    } else {
      price = i % 2 === 0 ? 110 : 90;
    }
    ticks.push(
      tick({
        ts,
        asset: "BTC",
        kind: "trade",
        price,
        qty: 1,
        side: i % 2 === 0 ? "buy" : "sell",
        funding: null,
        openInterest: null,
        cvdDelta: i % 2 === 0 ? 1 : -0.25,
      }),
    );
  }
  ticks.push(
    tick({
      ts: t0,
      asset: "BTC",
      kind: "oi",
      price: null,
      qty: null,
      side: null,
      funding: null,
      openInterest: 10_000,
      cvdDelta: null,
    }),
    tick({
      ts: new Date(t0.getTime() + 35 * BAR_MS),
      asset: "BTC",
      kind: "oi",
      price: null,
      qty: null,
      side: null,
      funding: null,
      openInterest: 11_000,
      cvdDelta: null,
    }),
    tick({
      ts: new Date(t0.getTime() + 35 * BAR_MS),
      asset: "BTC",
      kind: "mark",
      price: 90,
      qty: null,
      side: null,
      funding: 0.0002,
      openInterest: null,
      cvdDelta: null,
    }),
  );
  return ticks;
}

describe("feature snapshots", () => {
  const t0 = new Date("2026-09-01T00:00:00.000Z");
  const now = new Date(t0.getTime() + 35 * BAR_MS);

  it("matches the golden FeatureSnapshot for the tape fixture", async () => {
    const snapshots = await buildFeatureSnapshots(syntheticTicks(t0), now, nullFlowAdapter);
    const golden = JSON.parse(readFileSync(join(here, "golden/btc.json"), "utf8")) as unknown;
    expect(JSON.parse(JSON.stringify(snapshots))).toEqual(golden);
    expect(snapshots[0]?.exchangeNetflowZ).toBeNull();
    expect(snapshots[0]?.stablecoinDeltaZ).toBeNull();
    expect(snapshots[0]?.volRegime).toBe("high");
    expect(snapshots[0]?.funding).toBe(0.0002);
    expect(snapshots[0]?.oiChangePct).toBe(10);
  });

  it("uses all history when shorter than 30 days", async () => {
    const ticks = syntheticTicks(t0).filter((row) => row.kind === "trade").slice(0, 6);
    const snapshots = await buildFeatureSnapshots(ticks, now);
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]?.volRegime).toBe("mid");
    expect(snapshots[0]?.cvd).not.toBeNull();
  });
});
