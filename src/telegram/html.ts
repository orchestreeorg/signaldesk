import type { AlertKind } from "../domain/index.js";
import type { DigestReport } from "../jobs/digest.js";
import { formatMixScore, formatRealized } from "../jobs/digest.js";
import type { OverviewMacroIndex } from "../jobs/macroScale.js";
import type { NearLot, NearPosition } from "../jobs/nearLots.js";
import type { NearQuote } from "../jobs/nearPrice.js";
import { simulateNearHoldingsUsd } from "../jobs/nearSimulate.js";
import { formatDeskClock, formatDeskStamp } from "../ops/tz.js";
import type { HeadlineTone } from "./tone.js";
import type { OutgoingAlert } from "./types.js";

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function bias(alert: OutgoingAlert): string {
  if (alert.pDown > alert.pUp) {
    return "short-bias";
  }
  if (alert.pUp > alert.pDown) {
    return "long-bias";
  }
  return "neutral";
}

function fmt(value: number): string {
  return value.toFixed(2);
}

export function renderAlert(alert: OutgoingAlert): string {
  const id = alert.id ?? alert.eventId ?? "unknown";
  const src = alert.sourceUrl
    ? `<a href="${escapeHtml(alert.sourceUrl)}">link</a>`
    : "n/a";
  return [
    `<b>${alert.kind} ${alert.asset} · ${alert.horizon} · ${bias(alert)}</b>`,
    `P(↓&gt;2%) ${fmt(alert.pDown)} · P(↑&gt;2%) ${fmt(alert.pUp)} · P(in) ${fmt(alert.pIn)}`,
    `<b>Why:</b> ${escapeHtml(alert.why.join(" + ") || "n/a")}`,
    `<b>Kill:</b> ${escapeHtml(alert.kill)}`,
    `src: ${src} · id: <code>${escapeHtml(id)}</code>`,
  ].join("\n");
}

export function renderCommand(kind: AlertKind | "REGIME" | "LAST" | "WHY" | "START" | "WATCH" | "MUTE", body: string): string {
  return `<b>${kind}</b>\n${escapeHtml(body)}`;
}

function callsLine(calls: DigestReport["calls"]): string {
  const total = calls.FLASH + calls.FADE + calls.CONFIRM + calls.INVALIDATE;
  if (total === 0) {
    return "Calls: none";
  }
  return `Calls: FLASH ${calls.FLASH} · FADE ${calls.FADE} · CONFIRM ${calls.CONFIRM} · INVALIDATE ${calls.INVALIDATE}`;
}

function lastCallLine(last: DigestReport["lastCall"]): string {
  if (!last) {
    return "Last: none";
  }
  const realized = last.realized === null ? last.realizedLabel : formatRealized(last.realized);
  return `Last: ${last.kind} ${last.asset} · ${escapeHtml(last.why)} · ${realized}`;
}

function mixLine(mix: DigestReport["mix"]): string {
  const counts = `${mix.bull} bull / ${mix.bear} bear / ${mix.neutral} neutral`;
  if (mix.score === null) {
    return `News: mix n/a (${counts})`;
  }
  return `News: ${formatMixScore(mix.score)} (${counts})`;
}

/** 24h recap. Still DIGEST. Not the FLASH P() template. */
export function renderDigest(report: DigestReport): string {
  const lines = [
    `<b>DIGEST · last 24h · ${formatDeskClock(report.now)}</b>`,
    callsLine(report.calls),
    lastCallLine(report.lastCall),
    mixLine(report.mix),
  ];
  if (report.tape) {
    lines.push(`tape: ${escapeHtml(report.tape)}`);
  }
  return lines.join("\n");
}

/**
 * Weekly 1–10 composite as Overview lists it: score, label, conflicted, each leg.
 * Context only. Not fusion. Not an AlertKind.
 */
export function renderMacroIndex(index: OverviewMacroIndex | null, now: Date): string {
  const head = `<b>INDEX · weekly risk-on · ${formatDeskClock(now)}</b>`;
  if (!index) {
    return [head, "n/a", "Collecting enough daily macro history · not fusion"].join("\n");
  }
  const conflict = index.conflicted ? " · conflicted" : "";
  const lines = [
    head,
    `<b>${index.score.toFixed(1)} ${escapeHtml(index.label)}</b>${conflict}`,
  ];
  for (const leg of index.legs) {
    const name = `${leg.id.replace("_", " ")}${leg.inverted ? " ↕" : ""}`;
    const value = leg.score === null ? "n/a" : leg.score.toFixed(1);
    lines.push(`${escapeHtml(name)}  ${value}`);
  }
  lines.push("1 bearish · 10 bullish · weekly context · not fusion");
  return lines.join("\n");
}

export const NEAR_POSITION_LOT_LIMIT = 6;

function formatNearTokens(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

function formatNearUsd(n: number): string {
  const abs = Math.abs(n).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
  return n < 0 ? `−${abs.replace("$", "$")}` : abs;
}

function formatNearPx(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 4 });
}

function formatNearPct(n: number | null): string {
  if (n == null || !Number.isFinite(n)) {
    return "n/a";
  }
  const abs = Math.abs(n).toFixed(2);
  if (n > 0) {
    return `+${abs}%`;
  }
  if (n < 0) {
    return `−${abs}%`;
  }
  return `${abs}%`;
}

/**
 * Same numbers the NEAR Position box shows: live mark, holdings USD, last lots.
 * Not fusion. Not an AlertKind.
 */
export function renderNearPosition(input: {
  now: Date;
  quote: NearQuote | null;
  position: NearPosition;
  lots: NearLot[];
  note?: string | null;
}): string {
  const mark = input.quote ? simulateNearHoldingsUsd(input.position.tokens, input.quote.value) : null;
  const lines = [`<b>NEAR · position · ${formatDeskClock(input.now)}</b>`];
  if (input.quote) {
    lines.push(`<b>${formatNearPx(input.quote.value)}</b>  ${formatNearPct(input.quote.changePct)}`);
  } else {
    lines.push("n/a live $NEAR");
  }
  lines.push(`${formatNearTokens(input.position.tokens)} NEAR`);
  lines.push(mark == null ? "n/a mark" : `<b>${formatNearUsd(mark)}</b> mark`);
  lines.push(`${input.position.entries} entries · ${input.position.exits} exits`);
  if (input.quote) {
    const source = input.quote.source === "coingecko" ? "CoinGecko" : "Yahoo NEAR-USD";
    lines.push(`${source} · ${formatDeskClock(new Date(input.quote.asOf))}`);
  }
  const lots = input.lots.slice(0, NEAR_POSITION_LOT_LIMIT);
  if (lots.length === 0) {
    lines.push("No entries or exits yet");
  } else {
    for (const lot of lots) {
      lines.push(`${escapeHtml(lot.side)}  ${formatNearTokens(lot.tokens)} · ${formatNearUsd(lot.value)}`);
      lines.push(formatDeskStamp(lot.at));
    }
  }
  const note = input.note?.trim();
  if (note) {
    lines.push("");
    lines.push("<b>NOTE</b>");
    for (const line of note.split(/\n+/)) {
      const text = line.trim();
      if (text) {
        lines.push(escapeHtml(text));
      }
    }
  }
  return lines.join("\n");
}

/** Title + URL ping. Not an AlertKind. Mute and FLASH cap do not apply. */
export function renderHeadline(input: {
  sourceName: string;
  title: string;
  url: string;
  tone: HeadlineTone;
}): string {
  const href = escapeHtml(input.url);
  return [
    `<b>${escapeHtml(input.sourceName)}</b> · <b>${escapeHtml(input.tone)}</b>`,
    escapeHtml(input.title),
    `<a href="${href}">${href}</a>`,
  ].join("\n");
}
