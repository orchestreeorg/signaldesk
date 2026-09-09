import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { persistRawItems } from "../../src/collectors/news/store.js";
import type { RawItem } from "../../src/collectors/news/types.js";
import { createPool } from "../../src/db/client.js";
import { handleCommand } from "../../src/telegram/commands.js";
import { renderHeadline } from "../../src/telegram/html.js";
import { sendAlert, sendHeadline, sendHeadlines } from "../../src/telegram/send.js";
import { ChatStore } from "../../src/telegram/store.js";
import { DEFAULT_DESK_SETTINGS } from "../../src/desk/defaults.js";
import { headlineTone, shouldSendHeadline } from "../../src/telegram/tone.js";
import type { OutgoingAlert } from "../../src/telegram/types.js";

const databaseUrl = process.env.DATABASE_URL;

function raw(partial: Partial<RawItem> & Pick<RawItem, "url" | "simhash">): RawItem {
  return {
    sourceId: "coindesk",
    sourceRank: 70,
    title: "Major venue pauses withdrawals",
    body: "Major venue pauses withdrawals",
    publishedAt: new Date("2026-09-08T12:00:00.000Z"),
    ...partial,
  };
}

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

const flash: OutgoingAlert = {
  kind: "FLASH",
  asset: "BTC",
  horizon: "24h",
  pUp: 0.1,
  pDown: 0.7,
  pIn: 0.2,
  why: ["test"],
  kill: "none",
  id: "ev_headline",
};

const loose = { ...DEFAULT_DESK_SETTINGS, toneMode: "loose" as const };
const strictSkip = {
  ...DEFAULT_DESK_SETTINGS,
  toneMode: "strict" as const,
  headlineSend: "skip_neutral" as const,
};

describe("headline tone", () => {
  it("tags a bearish title", () => {
    expect(headlineTone("Major venue pauses withdrawals")).toBe("BEARISH");
    expect(headlineTone("Exchange hack drains hot wallet")).toBe("BEARISH");
    expect(headlineTone("US spot ETF posts $400m outflow")).toBe("BEARISH");
  });

  it("tags a bullish title", () => {
    expect(headlineTone("Spot ETF posts record inflow")).toBe("BULLISH");
    expect(headlineTone("SEC approval clears spot ETF")).toBe("BULLISH");
    expect(headlineTone("Venue lists bitcoin perpetual")).toBe("BULLISH");
    expect(headlineTone("Fed cuts rates by 25 bps")).toBe("BULLISH");
  });

  it("stays NEUTRAL for unrelated or EDGAR-style titles", () => {
    expect(headlineTone("SCHEDULE 13D/A - Fund 1 Investments, LLC (Filed by)")).toBe("NEUTRAL");
    expect(headlineTone("Federal Reserve Board announces meeting minutes")).toBe("NEUTRAL");
    expect(headlineTone("What bitcoin did this week")).toBe("NEUTRAL");
    expect(headlineTone("Large BTC transfer: 1,240 BTC")).toBe("NEUTRAL");
    expect(headlineTone("Large BTC transfer: 1,240 BTC", { ...DEFAULT_DESK_SETTINGS, toneMode: "strict" })).toBe(
      "NEUTRAL",
    );
  });

  it("stays NEUTRAL when both sides hit in balanced mode", () => {
    expect(headlineTone("ETF inflow after exchange hack")).toBe("NEUTRAL");
  });

  it("loose picks a side when hit counts differ", () => {
    expect(headlineTone("ETF inflow after exchange hack", loose)).toBe("BULLISH");
  });

  it("skip_neutral drops NEUTRAL and still sends directional titles", () => {
    const skip = { ...DEFAULT_DESK_SETTINGS, headlineSend: "skip_neutral" as const };
    expect(shouldSendHeadline("NEUTRAL", skip)).toBe(false);
    expect(shouldSendHeadline("BULLISH", skip)).toBe(true);
    expect(shouldSendHeadline("BEARISH", skip)).toBe(true);
  });
});

describe("headline pings", () => {
  it("renders source, tone, escaped title, and clickable url", () => {
    const html = renderHeadline({
      sourceName: "CoinDesk",
      title: "Foo <bar> & baz",
      url: "https://www.coindesk.com/markets/venue-pause",
      tone: "BEARISH",
    });
    expect(html).toBe(
      [
        "<b>CoinDesk</b> · <b>BEARISH</b>",
        "Foo &lt;bar&gt; &amp; baz",
        '<a href="https://www.coindesk.com/markets/venue-pause">https://www.coindesk.com/markets/venue-pause</a>',
      ].join("\n"),
    );
    expect(html).not.toMatch(/FLASH|FADE|CONFIRM|INVALIDATE|DIGEST|P\(|long-bias|short-bias|ETF_INFLOW|ENFORCEMENT/);
  });

  it("balanced + all sends BEARISH venue pause and NEUTRAL EDGAR", async () => {
    const { sent, transport } = recordingTransport();
    await sendHeadlines(transport, {
      chatId: "1",
      dryRun: false,
      sourceNameOf: (id) => (id === "edgar" ? "SEC EDGAR" : "CoinDesk"),
      settings: DEFAULT_DESK_SETTINGS,
      items: [
        raw({ url: "https://www.coindesk.com/markets/venue-pause", simhash: "aa" }),
        raw({
          sourceId: "edgar",
          title: "SCHEDULE 13D/A - Fund 1 Investments, LLC (Filed by)",
          url: "https://www.sec.gov/Archives/edgar/13d",
          simhash: "bb",
        }),
      ],
    });
    expect(sent).toHaveLength(2);
    expect(sent[0]).toContain("<b>BEARISH</b>");
    expect(sent[1]).toContain("<b>NEUTRAL</b>");
  });

  it("strict + skip_neutral drops EDGAR and sends a hack title", async () => {
    const { sent, transport } = recordingTransport();
    const results = await sendHeadlines(transport, {
      chatId: "1",
      dryRun: false,
      settings: strictSkip,
      items: [
        raw({
          sourceId: "edgar",
          title: "SCHEDULE 13D/A - Fund 1 Investments, LLC (Filed by)",
          url: "https://www.sec.gov/Archives/edgar/13d",
          simhash: "cc",
        }),
        raw({
          title: "Exchange hack drains hot wallet",
          url: "https://www.coindesk.com/markets/hack",
          simhash: "dd",
        }),
      ],
    });
    expect(results[0]).toMatchObject({ sent: false, reason: "filtered" });
    expect(results[1]).toMatchObject({ sent: true });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toContain("<b>BEARISH</b>");
    expect(sent[0]).toContain("hack");
  });

  it("sends one message for a new item with a tone chip", async () => {
    const { sent, transport } = recordingTransport();
    const item = raw({
      url: "https://www.coindesk.com/markets/venue-pause",
      simhash: "aaaaaaaaaaaaaaaa",
    });
    const results = await sendHeadlines(transport, {
      chatId: "1",
      items: [item],
      dryRun: false,
      sourceNameOf: () => "CoinDesk",
    });
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ sent: true });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toContain("<b>CoinDesk</b> · <b>BEARISH</b>");
    expect(sent[0]).toContain("Major venue pauses withdrawals");
    expect(sent[0]).toContain("https://www.coindesk.com/markets/venue-pause");
  });

  it("sends nothing when persist returns an empty batch", async () => {
    const { sent, transport } = recordingTransport();
    const results = await sendHeadlines(transport, {
      chatId: "1",
      items: [],
      dryRun: false,
    });
    expect(results).toEqual([]);
    expect(sent).toEqual([]);
  });

  it("respects TELEGRAM_DRY_RUN (log only)", async () => {
    const { sent, transport } = recordingTransport();
    const result = await sendHeadline(transport, {
      chatId: "1",
      sourceName: "CoinDesk",
      title: "Major venue pauses withdrawals",
      url: "https://www.coindesk.com/markets/venue-pause",
      dryRun: true,
    });
    expect(result).toMatchObject({ sent: false, reason: "dry-run" });
    expect(sent).toHaveLength(1);
  });

  it("sends while muted; mute still blocks FLASH", async () => {
    const store = new ChatStore();
    const now = new Date("2026-09-08T12:00:00.000Z");
    handleCommand(store, "9", "/mute 60", now);
    const { sent, transport } = recordingTransport();
    const headline = await sendHeadline(transport, {
      chatId: "9",
      sourceName: "CoinDesk",
      title: "Major venue pauses withdrawals",
      url: "https://www.coindesk.com/markets/venue-pause",
      dryRun: false,
    });
    const blocked = await sendAlert(store, transport, {
      chatId: "9",
      alert: flash,
      dryRun: false,
      now,
    });
    expect(headline.sent).toBe(true);
    expect(blocked).toMatchObject({ sent: false, reason: "muted" });
    expect(sent).toHaveLength(1);
  });

  it("does not consume the FLASH daily cap", async () => {
    const store = new ChatStore();
    const now = new Date("2026-09-08T12:00:00.000Z");
    store.bind("2");
    const { transport } = recordingTransport();
    for (let i = 0; i < 4; i += 1) {
      await sendHeadline(transport, {
        chatId: "2",
        sourceName: "CoinDesk",
        title: `Ping ${i}`,
        url: `https://example.com/${i}`,
        dryRun: false,
      });
    }
    const firstFlash = await sendAlert(store, transport, {
      chatId: "2",
      alert: flash,
      dryRun: false,
      now,
    });
    expect(firstFlash.sent).toBe(true);
  });
});

describe.skipIf(!databaseUrl)("headline persist gate", () => {
  const pool = createPool(databaseUrl ?? "");
  const prefix = "https://example.com/headline-test/";

  beforeAll(async () => {
    await persistRawItems(pool, []);
  });

  beforeEach(async () => {
    await pool.query("DELETE FROM raw_items WHERE url LIKE $1", [`${prefix}%`]);
  });

  afterAll(async () => {
    await pool.query("DELETE FROM raw_items WHERE url LIKE $1", [`${prefix}%`]);
    await pool.end();
  });

  it("sends once for a new URL and never again on a second persist", async () => {
    const { sent, transport } = recordingTransport();
    const item = raw({ url: `${prefix}same-url`, simhash: "1111111111111111" });
    const first = await persistRawItems(pool, [item]);
    await sendHeadlines(transport, { chatId: "1", items: first, dryRun: false });
    expect(first).toHaveLength(1);
    expect(sent).toHaveLength(1);

    const second = await persistRawItems(pool, [item]);
    await sendHeadlines(transport, { chatId: "1", items: second, dryRun: false });
    expect(second).toEqual([]);
    expect(sent).toHaveLength(1);
  });

  it("sends nothing for a same-story simhash on a second persist", async () => {
    const { sent, transport } = recordingTransport();
    const firstItem = raw({
      url: `${prefix}story-a`,
      simhash: "0000000000000000",
      title: "Venue pause A",
    });
    const nearDup = raw({
      url: `${prefix}story-b`,
      simhash: "0000000000000001",
      title: "Venue pause B",
    });
    const first = await persistRawItems(pool, [firstItem]);
    await sendHeadlines(transport, { chatId: "1", items: first, dryRun: false });
    expect(sent).toHaveLength(1);

    const second = await persistRawItems(pool, [nearDup]);
    await sendHeadlines(transport, { chatId: "1", items: second, dryRun: false });
    expect(second).toEqual([]);
    expect(sent).toHaveLength(1);
  });
});
