import { describe, expect, it } from "vitest";
import type { NearLot, NearPosition } from "../../src/jobs/nearLots.js";
import type { NearQuote } from "../../src/jobs/nearPrice.js";
import { handleCommand } from "../../src/telegram/commands.js";
import { renderNearPosition } from "../../src/telegram/html.js";
import { sendAlert, sendNearPosition } from "../../src/telegram/send.js";
import { ChatStore } from "../../src/telegram/store.js";
import type { OutgoingAlert } from "../../src/telegram/types.js";

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
    id: "1",
    side: "entry",
    at: new Date("2026-09-20T21:33:00.000Z"),
    tokens: 12075,
    value: 50351,
  },
  {
    id: "2",
    side: "entry",
    at: new Date("2026-09-20T21:29:00.000Z"),
    tokens: 1790,
    value: 7200,
  },
];

const flash: OutgoingAlert = {
  kind: "FLASH",
  asset: "BTC",
  horizon: "24h",
  pUp: 0.1,
  pDown: 0.7,
  pIn: 0.2,
  why: ["test"],
  kill: "none",
  id: "ev_near",
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

describe("NEAR position telegram", () => {
  it("lists live mark and ATH without the lot blotter", () => {
    const html = renderNearPosition({
      now,
      quote,
      position,
      ath: {
        value: 58_233,
        at: now,
        current: 58_233,
        status: "ath",
        under: 0,
        underPct: 0,
      },
    });
    expect(html).toContain("<b>NEAR · position · 18:00 ART</b>");
    expect(html).toContain("<b>$4.20</b>");
    expect(html).toContain("+18.27%");
    expect(html).toContain("13,865 NEAR");
    expect(html).toContain("<b>$58,233.00</b> mark");
    expect(html).toContain("ATH  $58,233.00");
    expect(html).toContain("CoinGecko · 18:00 ART");
    expect(html).not.toContain("entries ·");
    expect(html).not.toContain("entry  12,075");
    expect(html).not.toContain("exits");
  });

  it("reports how far the mark sits under the last ATH", () => {
    const html = renderNearPosition({
      now,
      quote,
      position,
      ath: {
        value: 61_200,
        at: now,
        current: 58_233,
        status: "under",
        under: 2_967,
        underPct: (2_967 / 61_200) * 100,
      },
    });
    expect(html).toContain("ATH  $61,200.00");
    expect(html).toContain("under  $2,967.00  (−4.8%)");
  });

  it("appends an escaped NOTE under the Position card", () => {
    const html = renderNearPosition({
      now,
      quote,
      position,
      note: "MARK — $4.20 vs book\nWATCH — <script>lose 4.20</script>",
    });
    expect(html).toContain("────────");
    expect(html).toContain("<b>NOTE</b>");
    expect(html.indexOf("────────")).toBeLessThan(html.indexOf("<b>NOTE</b>"));
    expect(html).toContain("MARK — $4.20 vs book");
    expect(html).toContain("&lt;script&gt;lose 4.20&lt;/script&gt;");
    expect(html).not.toContain("<script>");
  });

  it("keeps the Position empty state when the book is empty", () => {
    const html = renderNearPosition({
      now,
      quote: null,
      position: { tokens: 0, value: 0, entries: 0, exits: 0 },
    });
    expect(html).toContain("n/a live $NEAR");
    expect(html).toContain("n/a mark");
    expect(html).toContain("n/a ATH");
    expect(html).not.toContain("No entries or exits yet");
  });

  it("sends while mute and FLASH cap are in effect", async () => {
    const store = new ChatStore();
    const { sent, transport } = recordingTransport();
    handleCommand(store, "9", "/mute 60", now);
    const muted = await sendAlert(store, transport, { chatId: "9", alert: flash, dryRun: false, now });
    const mutedNear = await sendNearPosition(transport, {
      chatId: "9",
      quote,
      position,
      lots,
      dryRun: false,
      now,
    });
    expect(muted).toMatchObject({ sent: false, reason: "muted" });
    expect(mutedNear.sent).toBe(true);

    for (let i = 0; i < 4; i += 1) {
      await sendAlert(store, transport, { chatId: "2", alert: flash, dryRun: false, now });
    }
    const capped = await sendAlert(store, transport, { chatId: "2", alert: flash, dryRun: false, now });
    const cappedNear = await sendNearPosition(transport, {
      chatId: "2",
      quote,
      position,
      lots,
      dryRun: false,
      now,
    });
    expect(capped).toMatchObject({ sent: false, reason: "flash-cap" });
    expect(cappedNear.sent).toBe(true);
    expect(sent.filter((html) => html.includes("NEAR · position"))).toHaveLength(2);
  });

  it("still sends Position when the note is missing", async () => {
    const { sent, transport } = recordingTransport();
    const result = await sendNearPosition(transport, {
      chatId: "1",
      quote,
      position,
      lots,
      note: null,
      dryRun: false,
      now,
    });
    expect(result.sent).toBe(true);
    expect(result.html).toContain("NEAR · position");
    expect(result.html).not.toContain("<b>NOTE</b>");
    expect(sent).toHaveLength(1);
  });

  it("logs instead of sending when dry-run is on", async () => {
    const { sent, transport } = recordingTransport();
    const result = await sendNearPosition(transport, {
      chatId: "1",
      quote,
      position,
      lots,
      dryRun: true,
      now,
    });
    expect(result).toMatchObject({ sent: false, reason: "dry-run" });
    expect(sent).toHaveLength(1);
  });
});
