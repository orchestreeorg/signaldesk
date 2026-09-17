import { describe, expect, it } from "vitest";
import type { OverviewMacroIndex } from "../../src/jobs/macroScale.js";
import { handleCommand } from "../../src/telegram/commands.js";
import { renderMacroIndex } from "../../src/telegram/html.js";
import { sendAlert, sendMacroIndex } from "../../src/telegram/send.js";
import { ChatStore } from "../../src/telegram/store.js";
import type { OutgoingAlert } from "../../src/telegram/types.js";

const now = new Date("2026-09-17T14:00:00.000Z");

const index: OverviewMacroIndex = {
  score: 5.2,
  label: "Neutral",
  conflicted: true,
  asOf: now.toISOString(),
  legs: [
    { id: "coingecko", raw: 0.46, score: 7.3, weight: 0.175, inverted: false, included: true, reason: "ok" },
    { id: "cmc", raw: 62, score: 4.5, weight: 0.075, inverted: true, included: true, reason: "ok" },
    { id: "ovx", raw: 36, score: 4.5, weight: 0.15, inverted: true, included: true, reason: "ok" },
    { id: "gpr", raw: 90, score: 5.4, weight: 0.15, inverted: true, included: true, reason: "ok" },
    { id: "sp500", raw: 0.001, score: 5.2, weight: 0.3, inverted: false, included: true, reason: "ok" },
    { id: "gold", raw: 0, score: 5.0, weight: 0.15, inverted: false, included: true, reason: "ok" },
    { id: "news_mix", raw: -1, score: 1.0, weight: 0.05, inverted: false, included: true, reason: "ok" },
  ],
};

const flash: OutgoingAlert = {
  kind: "FLASH",
  asset: "BTC",
  horizon: "24h",
  pUp: 0.1,
  pDown: 0.7,
  pIn: 0.2,
  why: ["test"],
  kill: "none",
  id: "ev_macro",
};

function recordingTransport() {
  const sent: string[] = [];
  return {
    sent,
    transport: {
      async send(_chatId: string, html: string) {
        sent.push(html);
      },
    },
  };
}

describe("weekly index telegram", () => {
  it("lists the composite and every Overview leg", () => {
    const html = renderMacroIndex(index, now);
    expect(html).toContain("<b>INDEX · weekly risk-on · 14:00 UTC</b>");
    expect(html).toContain("<b>5.2 Neutral</b> · conflicted");
    expect(html).toContain("coingecko  7.3");
    expect(html).toContain("cmc ↕  4.5");
    expect(html).toContain("ovx ↕  4.5");
    expect(html).toContain("gpr ↕  5.4");
    expect(html).toContain("sp500  5.2");
    expect(html).toContain("gold  5.0");
    expect(html).toContain("news mix  1.0");
    expect(html).toContain("1 bearish · 10 bullish · weekly context · not fusion");
  });

  it("matches the Overview empty state when history is thin", () => {
    const html = renderMacroIndex(null, now);
    expect(html).toContain("n/a");
    expect(html).toContain("Collecting enough daily macro history · not fusion");
  });

  it("sends while mute and FLASH cap are in effect", async () => {
    const store = new ChatStore();
    const { sent, transport } = recordingTransport();
    handleCommand(store, "9", "/mute 60", now);
    const muted = await sendAlert(store, transport, { chatId: "9", alert: flash, dryRun: false, now });
    const mutedIndex = await sendMacroIndex(transport, { chatId: "9", index, dryRun: false, now });
    expect(muted).toMatchObject({ sent: false, reason: "muted" });
    expect(mutedIndex.sent).toBe(true);

    for (let i = 0; i < 4; i += 1) {
      await sendAlert(store, transport, { chatId: "2", alert: flash, dryRun: false, now });
    }
    const capped = await sendAlert(store, transport, { chatId: "2", alert: flash, dryRun: false, now });
    const cappedIndex = await sendMacroIndex(transport, { chatId: "2", index, dryRun: false, now });
    expect(capped).toMatchObject({ sent: false, reason: "flash-cap" });
    expect(cappedIndex.sent).toBe(true);
    expect(sent.filter((html) => html.includes("INDEX · weekly risk-on"))).toHaveLength(2);
  });

  it("logs instead of sending when dry-run is on", async () => {
    const { sent, transport } = recordingTransport();
    const result = await sendMacroIndex(transport, { chatId: "1", index, dryRun: true, now });
    expect(result).toMatchObject({ sent: false, reason: "dry-run" });
    expect(sent).toHaveLength(1);
  });
});
