import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DEFAULT_DESK_SETTINGS } from "../../src/desk/defaults.js";
import type { DigestAlertRow } from "../../src/jobs/digest.js";
import {
  buildOverviewReport,
  filterHeadlinesByTone,
  pickLargeBtc,
  safeHref,
  type OverviewItemRow,
} from "../../src/jobs/overview.js";

const now = new Date("2026-09-08T16:00:00.000Z");
const here = dirname(fileURLToPath(import.meta.url));

function item(partial: Partial<OverviewItemRow> & Pick<OverviewItemRow, "title">): OverviewItemRow {
  return {
    url: `https://example.com/${encodeURIComponent(partial.title)}`,
    sourceId: "coindesk",
    publishedAt: now,
    ...partial,
  };
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

const mixItems: OverviewItemRow[] = [
  item({ title: "Spot ETF posts record inflow" }),
  item({ title: "SEC approval clears spot ETF" }),
  item({ title: "Exchange hack drains hot wallet" }),
  item({ title: "SCHEDULE 13D/A - Fund 1 Investments, LLC (Filed by)" }),
  item({ title: "What bitcoin did this week" }),
  item({ title: "Large BTC transfer: 1,240 BTC", sourceId: "mempool", url: "https://mempool.space/tx/ab" }),
];

describe("overview mix", () => {
  it("scores 2 bull + 1 bear + 3 neutral as (2-1)/3", () => {
    const report = buildOverviewReport({ now, alerts: [], items: mixItems, settings: DEFAULT_DESK_SETTINGS });
    expect(report.mix).toEqual({ bull: 2, bear: 1, neutral: 3, score: (2 - 1) / 3 });
    expect(report.mixLabel).toBe("+0.33");
  });

  it("returns mix n/a and Calls: none when empty of direction and alerts", () => {
    const report = buildOverviewReport({
      now,
      alerts: [],
      items: [item({ title: "What bitcoin did this week" })],
    });
    expect(report.calls).toEqual({ FLASH: 0, FADE: 0, CONFIRM: 0, INVALIDATE: 0 });
    expect(report.lastCall).toBeNull();
    expect(report.mix.score).toBeNull();
    expect(report.mixLabel).toBe("n/a");
  });
});

describe("overview mempool and tabs", () => {
  it("keeps large BTC prints on mempool rows only", () => {
    const report = buildOverviewReport({ now, alerts: [], items: mixItems });
    expect(report.largeBtc).toHaveLength(1);
    expect(report.largeBtc[0]?.sourceId).toBe("mempool");
    expect(report.largeBtc[0]?.title).toContain("1,240 BTC");
    expect(pickLargeBtc(mixItems).every((row) => row.sourceId === "mempool")).toBe(true);
  });

  it("filters headline tabs by tone", () => {
    const report = buildOverviewReport({ now, alerts: [], items: mixItems });
    expect(filterHeadlinesByTone(report.headlines, "ALL")).toHaveLength(6);
    expect(filterHeadlinesByTone(report.headlines, "BULLISH").every((row) => row.tone === "BULLISH")).toBe(true);
    expect(filterHeadlinesByTone(report.headlines, "BULLISH")).toHaveLength(2);
    expect(filterHeadlinesByTone(report.headlines, "BEARISH")).toHaveLength(1);
    expect(filterHeadlinesByTone(report.headlines, "NEUTRAL")).toHaveLength(3);
  });

  it("keeps last FLASH realized text without inventing prices", () => {
    const report = buildOverviewReport({
      now,
      alerts: [alert({ id: "a1", kind: "FLASH", realized24h: -0.012 })],
      items: [],
    });
    expect(report.lastCall).toMatchObject({ kind: "FLASH", realizedText: "-1.2%" });
  });
});

describe("overview links", () => {
  it("only allows http(s) hrefs", () => {
    expect(safeHref("https://mempool.space/tx/ab")).toContain("https://");
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("not a url")).toBeNull();
  });
});

describe("overview isolation", () => {
  it("does not send Telegram", () => {
    const src = readFileSync(join(here, "../../src/jobs/overview.ts"), "utf8");
    const route = readFileSync(join(here, "../../dashboard/app/api/overview/route.ts"), "utf8");
    const page = readFileSync(join(here, "../../dashboard/app/page.tsx"), "utf8");
    expect(src).not.toMatch(/sendAlert|sendDigest|grammy/i);
    expect(route).not.toMatch(/grammy|sendAlert|sendDigest/i);
    expect(page).not.toMatch(/dangerouslySetInnerHTML/);
  });

  it("keeps console controls on /console", () => {
    const consolePage = readFileSync(join(here, "../../dashboard/app/console/page.tsx"), "utf8");
    expect(consolePage).toMatch(/\/api\/control/);
    expect(consolePage).toMatch(/Send digest now/);
    expect(consolePage).toMatch(/href="\/console"|current="console"/);
  });
});
