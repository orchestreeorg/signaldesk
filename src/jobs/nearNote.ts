import { completeChat } from "../classify/complete.js";
import { formatDeskClock, formatDeskStamp } from "../ops/tz.js";
import type { NearHeadline } from "./nearNews.js";
import type { NearLot, NearPosition } from "./nearLots.js";
import type { NearQuote } from "./nearPrice.js";
import { simulateNearHoldingsUsd } from "./nearSimulate.js";

export const NEAR_NOTE_HEADLINE_LIMIT = 12;
export const NEAR_NOTE_LOOKBACK_MS = 6 * 60 * 60 * 1000;
export const NEAR_NOTE_LOT_LIMIT = 6;

export const NEAR_NOTE_SYSTEM_PROMPT = `You are a NEAR desk clerk, not an advisor.

You receive ONLY: live $NEAR, 24h change, current holdings, lot list (side/tokens/USD/time), and recent headlines (title, source, tone, time). All numbers in the payload are ground truth.

Write 4–6 short lines for Telegram (plain text, no markdown tables).

Rules:
- Use only the payload. If a figure is missing, write n/a. Never invent price, TVL, unlocks, or lots.
- No buy, sell, add, trim, target, or “you should.”
- Ignore generic English “near” and non-NEAR noise. Prefer official / gov / Protocol titles over recap blogs.
- Prefer what changed over what is always true.
- If headlines conflict, say conflicted. Do not average them into a fake consensus.
- If nothing material changed, say so in one line. Do not pad.

Output exactly:
1) MARK — price, 24h, holdings USD vs book net if both exist (label the gap as book vs mark, not PnL advice)
2) BOOK — last lot(s) and whether they sit above/below the live mark
3) TAPE — 1–3 headline facts that actually mention NEAR Protocol; cite source names; skip the rest
4) WATCH — one falsifier for the next hour (a price level already in the payload, or a named headline risk). Not a trade.`;

export type NearNoteStatus = "attached" | "skipped" | "failed";

export type NearNoteResult = {
  note: string | null;
  status: NearNoteStatus;
  reason?: "no-key" | "unchanged" | "empty" | "error";
};

export type NearNotePreviousHour = {
  quote: string;
  headlines: string[];
};

type Cache = {
  fingerprint: string;
  previous: NearNotePreviousHour;
};

let cache: Cache | null = null;

export function resetNearNoteCache(): void {
  cache = null;
}

export function pickNearNoteHeadlines(headlines: NearHeadline[], now: Date): NearHeadline[] {
  const cutoff = now.getTime() - NEAR_NOTE_LOOKBACK_MS;
  const recent = headlines.filter((row) => {
    const at = Date.parse(row.publishedAt);
    return Number.isFinite(at) && at >= cutoff;
  });
  return (recent.length > 0 ? recent : headlines).slice(0, NEAR_NOTE_HEADLINE_LIMIT);
}

export function fingerprintNearNote(input: {
  quote: NearQuote | null;
  tokens: number;
  lots: NearLot[];
  headlines: NearHeadline[];
}): string {
  const newestLot = input.lots[0]?.id ?? "";
  const urls = input.headlines.map((row) => row.url).join(",");
  return [
    input.quote?.value ?? "n/a",
    input.quote?.changePct ?? "n/a",
    input.tokens,
    newestLot,
    urls,
  ].join("|");
}

function formatQuoteLine(quote: NearQuote | null): string {
  if (!quote) {
    return "n/a";
  }
  const change = quote.changePct == null || !Number.isFinite(quote.changePct) ? "n/a" : `${quote.changePct}%`;
  return `${quote.value} USD  ${change}  source=${quote.source}`;
}

export function buildNearNoteUser(input: {
  now: Date;
  quote: NearQuote | null;
  position: NearPosition;
  lots: NearLot[];
  headlines: NearHeadline[];
  previous?: NearNotePreviousHour | null;
}): string {
  const mark = input.quote ? simulateNearHoldingsUsd(input.position.tokens, input.quote.value) : null;
  const lots = input.lots.slice(0, NEAR_NOTE_LOT_LIMIT);
  const lines = [
    `as_of: ${formatDeskClock(input.now)}`,
    `quote: ${formatQuoteLine(input.quote)}`,
    `holdings: ${input.position.tokens} NEAR`,
    `mark_usd: ${mark ?? "n/a"}`,
    `book_net_usd: ${input.position.value}`,
    `lots (newest first, max ${NEAR_NOTE_LOT_LIMIT}):`,
  ];
  if (lots.length === 0) {
    lines.push("- none");
  } else {
    for (const lot of lots) {
      lines.push(`- ${lot.side} ${lot.tokens} · ${lot.value}  ${formatDeskStamp(lot.at)}`);
    }
  }
  lines.push(`headlines (max ${NEAR_NOTE_HEADLINE_LIMIT}, last 6h if possible):`);
  if (input.headlines.length === 0) {
    lines.push("- none");
  } else {
    for (const row of input.headlines) {
      lines.push(`- ${row.tone} ${row.sourceName}  ${row.title}  ${formatDeskClock(new Date(row.publishedAt))}`);
    }
  }
  if (input.previous) {
    lines.push("previous_hour:");
    lines.push(`- quote: ${input.previous.quote}`);
    lines.push(`- headline_ids: ${input.previous.headlines.join(" ") || "none"}`);
  }
  return lines.join("\n");
}

export async function loadNearNote(input: {
  now: Date;
  quote: NearQuote | null;
  position: NearPosition;
  lots: NearLot[];
  headlines: NearHeadline[];
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  complete?: typeof completeChat;
}): Promise<NearNoteResult> {
  const apiKey = input.apiKey ?? "";
  if (!apiKey) {
    return { note: null, status: "skipped", reason: "no-key" };
  }
  const headlines = pickNearNoteHeadlines(input.headlines, input.now);
  const fingerprint = fingerprintNearNote({
    quote: input.quote,
    tokens: input.position.tokens,
    lots: input.lots,
    headlines,
  });
  if (cache && cache.fingerprint === fingerprint) {
    return { note: null, status: "skipped", reason: "unchanged" };
  }
  const user = buildNearNoteUser({
    now: input.now,
    quote: input.quote,
    position: input.position,
    lots: input.lots,
    headlines,
    previous: cache?.previous ?? null,
  });
  try {
    const complete = input.complete ?? completeChat;
    const raw = await complete({
      baseUrl: input.baseUrl ?? "https://api.openai.com/v1",
      apiKey,
      model: input.model ?? "gpt-4o-mini",
      system: NEAR_NOTE_SYSTEM_PROMPT,
      user,
    });
    const note = sanitizeNearNote(raw);
    if (!note) {
      return { note: null, status: "failed", reason: "empty" };
    }
    cache = {
      fingerprint,
      previous: {
        quote: formatQuoteLine(input.quote),
        headlines: headlines.map((row) => row.url),
      },
    };
    return { note, status: "attached" };
  } catch {
    return { note: null, status: "failed", reason: "error" };
  }
}

export function sanitizeNearNote(raw: string): string | null {
  const lines = raw
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 8);
  if (lines.length === 0) {
    return null;
  }
  return lines.join("\n");
}
