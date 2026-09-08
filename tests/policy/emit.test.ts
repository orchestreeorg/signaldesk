import { describe, expect, it } from "vitest";
import type { Decision, Event } from "../../src/domain/index.js";
import { Policy } from "../../src/policy/index.js";
import { ChatStore } from "../../src/telegram/store.js";
import type { FeatureSnapshot } from "../../src/domain/index.js";

function event(fingerprint: string, polarity: number): Event {
  return {
    id: `id-${fingerprint}`,
    class: "ETF_INFLOW",
    assets: ["BTC"],
    source: "farside",
    url: `https://example.com/${fingerprint}`,
    fingerprint,
    novelty: 1,
    credibility: 0.85,
    polarity,
    occurredAt: new Date("2026-09-07T12:00:00.000Z"),
  };
}

function snap(cvd: number): FeatureSnapshot {
  return {
    ts: new Date("2026-09-07T12:00:00.000Z"),
    asset: "BTC",
    exchangeNetflowZ: null,
    stablecoinDeltaZ: null,
    funding: null,
    oiChangePct: null,
    cvd,
    volRegime: "mid",
  };
}

function flashDecision(): Decision {
  return {
    kind: "FLASH",
    asset: "BTC",
    horizon: "24h",
    pUp: 0.5,
    pDown: 0.2,
    pIn: 0.3,
    why: ["test"],
    kill: "none",
    eventId: "x",
  };
}

describe("policy", () => {
  it("5th FLASH in a day is dropped", async () => {
    const sent: string[] = [];
    const policy = new Policy({
      store: new ChatStore(),
      transport: { async send(_chat, html) { sent.push(html); } },
      chatId: "1",
      dryRun: false,
    });
    const now = new Date("2026-09-07T15:00:00.000Z");
    const ev = event("fp-1", 0.8);
    for (let i = 0; i < 4; i += 1) {
      const result = await policy.emit(flashDecision(), ev, now);
      expect(result.send.sent).toBe(true);
    }
    const fifth = await policy.emit(flashDecision(), ev, now);
    expect(fifth.send.sent).toBe(false);
    if (!fifth.send.sent) {
      expect(fifth.send.reason).toBe("flash-cap");
    }
    expect(sent).toHaveLength(4);
  });

  it("one CONFIRM per live thesis", async () => {
    const policy = new Policy({
      store: new ChatStore(),
      transport: { async send() {} },
      chatId: "1",
      dryRun: false,
    });
    const first = await policy.handle(event("fp-1", 0.8), snap(5));
    expect(first[0]?.decision.kind).toBe("FLASH");
    const confirm = await policy.handle(event("fp-2", 0.7), snap(4));
    expect(confirm[0]?.decision.kind).toBe("CONFIRM");
    const again = await policy.handle(event("fp-3", 0.6), snap(3));
    expect(again[0]?.send).toMatchObject({ sent: false, reason: "confirm-cap" });
  });

  it("is the only module that sends Telegram", async () => {
    const sent: string[] = [];
    const policy = new Policy({
      store: new ChatStore(),
      transport: { async send(_c, html) { sent.push(html); } },
      chatId: "9",
      dryRun: false,
    });
    await policy.handle(event("fp-live", 0.9), snap(8));
    expect(sent[0]).toContain("FLASH BTC");
  });
});
