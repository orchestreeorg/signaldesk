import type { AlertKind } from "../domain/index.js";
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
