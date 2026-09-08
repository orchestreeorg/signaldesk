import { describe, expect, it } from "vitest";
import type { OutgoingAlert } from "../../src/telegram/types.js";
import { renderAlert } from "../../src/telegram/html.js";

const base: OutgoingAlert = {
  kind: "FLASH",
  asset: "BTC",
  horizon: "24h",
  pUp: 0.09,
  pDown: 0.71,
  pIn: 0.2,
  why: ["venue pause", "CEX inflow z +2.4"],
  kill: "withdrawals resume AND inflow z < 0.5",
  eventId: "ev_1842",
  id: "ev_1842",
  sourceUrl: "https://www.coindesk.com/markets/venue-pause",
};

const kinds = ["FLASH", "FADE", "CONFIRM", "INVALIDATE", "DIGEST"] as const;

describe("telegram templates", () => {
  it.each(kinds)("renders %s HTML", (kind) => {
    const html = renderAlert({ ...base, kind });
    expect(html).toContain(`<b>${kind} BTC · 24h · short-bias</b>`);
    expect(html).toContain("P(↓&gt;2%) 0.71 · P(↑&gt;2%) 0.09 · P(in) 0.20");
    expect(html).toContain("venue pause + CEX inflow z +2.4");
    expect(html).toContain("withdrawals resume AND inflow z &lt; 0.5");
    expect(html).toContain("id: <code>ev_1842</code>");
    expect(html).toMatchSnapshot();
  });
});
