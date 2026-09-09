import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildDigestReport,
  formatMixScore,
  scoreNewsMix,
  type DigestAlertRow,
  type DigestItemRow,
} from "../../src/jobs/digest.js";
import { DEFAULT_DESK_SETTINGS } from "../../src/desk/defaults.js";
import { renderDigest } from "../../src/telegram/html.js";
import { ChatStore } from "../../src/telegram/store.js";
import { handleCommand } from "../../src/telegram/commands.js";
import { sendAlert, sendDigest } from "../../src/telegram/send.js";
import type { OutgoingAlert } from "../../src/telegram/types.js";

const now = new Date("2026-09-08T16:00:00.000Z");

function item(title: string): DigestItemRow {
  return { title, publishedAt: now };
}

function alert(partial: Partial<DigestAlertRow> & Pick<DigestAlertRow, "id" | "kind">): DigestAlertRow {
  return {
    asset: "BTC",
    why: ["venue pause"],
    at: now,
    realized24h: null,
    realized4h: null,
    ...partial,
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
  id: "ev_1",
};

describe("digest mix", () => {
  it("scores 2 bull + 1 bear + 3 neutral as (2-1)/3", () => {
    const mix = scoreNewsMix(
      [
        item("Spot ETF posts record inflow"),
        item("SEC approval clears spot ETF"),
        item("Exchange hack drains hot wallet"),
        item("SCHEDULE 13D/A - Fund 1 Investments, LLC (Filed by)"),
        item("What bitcoin did this week"),
        item("Large BTC transfer: 1,240 BTC"),
      ],
      DEFAULT_DESK_SETTINGS,
    );
    expect(mix).toEqual({ bull: 2, bear: 1, neutral: 3, score: (2 - 1) / 3 });
    expect(formatMixScore(mix.score)).toBe("+0.33");
  });

  it("returns mix n/a when there are no directional titles", () => {
    const report = buildDigestReport({
      now,
      alerts: [],
      items: [item("What bitcoin did this week"), item("Federal Reserve Board announces meeting minutes")],
    });
    expect(report.calls).toEqual({ FLASH: 0, FADE: 0, CONFIRM: 0, INVALIDATE: 0 });
    expect(report.lastCall).toBeNull();
    expect(report.mix.score).toBeNull();
    expect(report.mix.neutral).toBe(2);
    const html = renderDigest(report);
    expect(html).toContain("Calls: none");
    expect(html).toContain("Last: none");
    expect(html).toContain("News: mix n/a");
  });
});

describe("digest recap", () => {
  it("counts calls and uses 24h realized when present", () => {
    const report = buildDigestReport({
      now,
      alerts: [
        alert({ id: "a1", kind: "FLASH", at: new Date("2026-09-08T15:00:00.000Z"), realized24h: -0.012 }),
        alert({ id: "a2", kind: "FADE", at: new Date("2026-09-08T14:00:00.000Z") }),
        alert({ id: "a3", kind: "CONFIRM", at: new Date("2026-09-08T13:00:00.000Z") }),
      ],
      items: [item("Spot ETF posts record inflow")],
    });
    expect(report.calls.FLASH).toBe(1);
    expect(report.calls.FADE).toBe(1);
    expect(report.calls.CONFIRM).toBe(1);
    expect(report.lastCall).toMatchObject({ kind: "FLASH", asset: "BTC", realized: -0.012 });
    const html = renderDigest(report);
    expect(html).toContain("<b>DIGEST · last 24h · 16:00 UTC</b>");
    expect(html).toContain("Calls: FLASH 1 · FADE 1 · CONFIRM 1 · INVALIDATE 0");
    expect(html).toContain("Last: FLASH BTC · venue pause · -1.2%");
    expect(html).toContain("News: +1.00 (1 bull / 0 bear / 0 neutral)");
    expect(html).not.toMatch(/P\(&#8593|&gt;2%\)|P\(↑/);
    expect(html).not.toContain("P(↑");
    expect(html).not.toContain("P(↓");
  });

  it("escapes last-call why crumbs", () => {
    const html = renderDigest(
      buildDigestReport({
        now,
        alerts: [alert({ id: "a1", kind: "FLASH", why: ["foo <bar> & baz"] })],
        items: [],
      }),
    );
    expect(html).toContain("foo &lt;bar&gt; &amp; baz");
    expect(html).toContain("· open");
  });

  it("omits tape when the snapshot is quiet", () => {
    const html = renderDigest(
      buildDigestReport({
        now,
        alerts: [],
        items: [],
        snapshot: {
          ts: now,
          asset: "BTC",
          exchangeNetflowZ: null,
          stablecoinDeltaZ: null,
          funding: null,
          oiChangePct: null,
          cvd: null,
          volRegime: "mid",
        },
      }),
    );
    expect(html).not.toContain("tape:");
  });
});

describe("sendDigest", () => {
  it("sends while muted FLASH is blocked", async () => {
    const store = new ChatStore();
    const mutedAt = new Date("2026-09-07T12:00:00.000Z");
    handleCommand(store, "9", "/mute 60", mutedAt);
    const sent: string[] = [];
    const transport = {
      async send(_chat: string, html: string) {
        sent.push(html);
      },
    };
    const blocked = await sendAlert(store, transport, {
      chatId: "9",
      alert: flash,
      dryRun: false,
      now: mutedAt,
    });
    const digest = await sendDigest(store, transport, {
      chatId: "9",
      html: "<b>DIGEST · last 24h · 16:00 UTC</b>\nCalls: none",
      dryRun: false,
      now: mutedAt,
    });
    expect(blocked).toMatchObject({ sent: false, reason: "muted" });
    expect(digest.sent).toBe(true);
    expect(sent[0]).toContain("DIGEST");
    expect(sent[0]).not.toContain("P(↓");
  });
});

describe("digest isolation", () => {
  it("does not send Telegram", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(here, "../../src/jobs/digest.ts"), "utf8");
    expect(src).not.toMatch(/sendAlert|sendDigest|grammy/i);
  });
});
