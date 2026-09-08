import { describe, expect, it } from "vitest";
import type { Event, FeatureSnapshot } from "../../src/domain/index.js";
import { adjustProbs, CLASS_PRIORS, fuse, normalize } from "../../src/fusion/index.js";

function event(partial: Partial<Event> & Pick<Event, "polarity" | "novelty" | "credibility">): Event {
  return {
    id: "ev_1",
    class: "ETF_INFLOW",
    assets: ["BTC"],
    source: "farside",
    url: "https://example.com/a",
    fingerprint: "fp-a",
    occurredAt: new Date("2026-09-07T12:00:00.000Z"),
    ...partial,
  };
}

function snapshot(partial: Partial<FeatureSnapshot> = {}): FeatureSnapshot {
  return {
    ts: new Date("2026-09-07T12:00:00.000Z"),
    asset: "BTC",
    exchangeNetflowZ: null,
    stablecoinDeltaZ: null,
    funding: null,
    oiChangePct: null,
    cvd: null,
    volRegime: "mid",
    ...partial,
  };
}

describe("fuse", () => {
  it("bullish news + sell-flow → FADE", () => {
    const decisions = fuse({
      event: event({ polarity: 0.7, novelty: 0.9, credibility: 0.8 }),
      snapshot: snapshot({ cvd: -8, exchangeNetflowZ: 2.1 }),
    });
    expect(decisions).toHaveLength(1);
    expect(decisions[0]?.kind).toBe("FADE");
    const row = decisions[0];
    expect(row ? row.pUp + row.pDown + row.pIn : 0).toBeCloseTo(1, 3);
  });

  it("both legs agree + high novelty → FLASH", () => {
    const decisions = fuse({
      event: event({ polarity: 0.8, novelty: 1, credibility: 0.85 }),
      snapshot: snapshot({ cvd: 6 }),
    });
    expect(decisions[0]?.kind).toBe("FLASH");
    expect(decisions[0]?.horizon).toBe("24h");
    expect(decisions[0]?.kill.length).toBeGreaterThan(0);
  });

  it("existing FLASH + second feed → CONFIRM", () => {
    const decisions = fuse({
      event: event({
        id: "ev_2",
        fingerprint: "fp-b",
        polarity: 0.7,
        novelty: 1,
        credibility: 0.8,
      }),
      snapshot: snapshot({ cvd: 4 }),
      live: {
        fingerprint: "fp-a",
        eventId: "ev_1",
        asset: "BTC",
        polarity: 1,
        kill: "CVD flips negative",
        confirmed: false,
      },
    });
    expect(decisions[0]?.kind).toBe("CONFIRM");
  });

  it("kill condition → INVALIDATE", () => {
    const decisions = fuse({
      event: event({
        class: "EXCHANGE_STRESS",
        polarity: -0.2,
        novelty: 0.5,
        credibility: 0.8,
      }),
      snapshot: snapshot({ cvd: 5 }),
      live: {
        fingerprint: "fp-a",
        eventId: "ev_1",
        asset: "BTC",
        polarity: -1,
        kill: "CVD flips positive AND funding >= 0",
        confirmed: false,
      },
    });
    expect(decisions[0]?.kind).toBe("INVALIDATE");
  });

  it("low novelty and quiet tape → empty", () => {
    const decisions = fuse({
      event: event({ polarity: 0.2, novelty: 0.1, credibility: 0.4, class: "OTHER" }),
      snapshot: snapshot(),
    });
    expect(decisions).toEqual([]);
  });

  it("extreme venue stress can FLASH without tape confirmation", () => {
    const decisions = fuse({
      event: event({
        class: "EXCHANGE_STRESS",
        polarity: -0.9,
        novelty: 1,
        credibility: 0.9,
      }),
      snapshot: snapshot(),
    });
    expect(decisions[0]?.kind).toBe("FLASH");
    expect(decisions[0]?.pDown).toBeGreaterThan(decisions[0]?.pUp ?? 1);
  });

  it("injected lower credibility threshold can FLASH a CoinDesk-like event", () => {
    const decisions = fuse({
      event: event({ polarity: 0.8, novelty: 1, credibility: 0.56 }),
      snapshot: snapshot({ cvd: 6 }),
      thresholds: { highCredibility: 0.5 },
    });
    expect(decisions[0]?.kind).toBe("FLASH");
  });

  it("priors and adjusted probs sum to 1", () => {
    for (const prior of Object.values(CLASS_PRIORS)) {
      const n = normalize(prior);
      expect(n.pUp + n.pDown + n.pIn).toBeCloseTo(1, 3);
    }
    const adjusted = adjustProbs(CLASS_PRIORS.ETF_INFLOW, 1, -1);
    expect(adjusted.pUp + adjusted.pDown + adjusted.pIn).toBeCloseTo(1, 3);
  });
});
