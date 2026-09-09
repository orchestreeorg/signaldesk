import type { AlertKind } from "../domain/index.js";
import type { DigestReport } from "../jobs/digest.js";
import { formatMixScore, formatRealized } from "../jobs/digest.js";
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

function digestHourLabel(now: Date): string {
  return `${String(now.getUTCHours()).padStart(2, "0")}:00 UTC`;
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
    `<b>DIGEST · last 24h · ${digestHourLabel(report.now)}</b>`,
    callsLine(report.calls),
    lastCallLine(report.lastCall),
    mixLine(report.mix),
  ];
  if (report.tape) {
    lines.push(`tape: ${escapeHtml(report.tape)}`);
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
