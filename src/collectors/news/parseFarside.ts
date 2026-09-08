import type { ParsedFeedItem } from "./parseRss.js";

const MONTHS: Record<string, number> = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
};

const ROW_RE =
  /<tr[^>]*>\s*<td>\s*<span class="tabletext">(\d{1,2} \w{3} 20\d{2})<\/span>[\s\S]*?<\/tr>/gi;

function parseNum(raw: string): number {
  const negative = raw.includes("(");
  const value = Number(raw.replace(/[(),]/g, ""));
  if (!Number.isFinite(value)) {
    return 0;
  }
  return negative ? -value : value;
}

function parseDay(label: string): Date {
  const [day, month, year] = label.split(" ");
  const monthIndex = MONTHS[month ?? ""];
  if (!day || monthIndex === undefined || !year) {
    return new Date(0);
  }
  return new Date(Date.UTC(Number(year), monthIndex, Number(day), 21, 0, 0));
}

export function parseFarsideHtml(html: string, pageUrl: string): ParsedFeedItem[] {
  const rows: Array<{ label: string; total: number; at: Date }> = [];
  for (const match of html.matchAll(ROW_RE)) {
    const label = match[1];
    const block = match[0];
    if (!label || !block) {
      continue;
    }
    if (/>(?:-|&mdash;)<\/span>/.test(block)) {
      continue;
    }
    const nums = [...block.matchAll(/>(\(?[\d,.]+\)?)<\/span>/g)].map((item) => parseNum(item[1] ?? ""));
    const total = nums.at(-1);
    if (total === undefined) {
      continue;
    }
    rows.push({ label, total, at: parseDay(label) });
  }
  const latest = rows.sort((a, b) => a.at.getTime() - b.at.getTime()).at(-1);
  if (!latest) {
    return [];
  }
  const iso = latest.at.toISOString().slice(0, 10);
  const direction = latest.total >= 0 ? "inflow" : "outflow";
  const abs = Math.abs(latest.total).toFixed(1);
  return [
    {
      url: `${pageUrl.replace(/\/$/, "")}/?as_of=${iso}`,
      title: `US spot BTC ETF ${direction} $${abs}m (${latest.label})`,
      body: `Farside US spot Bitcoin ETF ${direction} ${abs} million on ${latest.label}.`,
      publishedAt: latest.at,
    },
  ];
}
