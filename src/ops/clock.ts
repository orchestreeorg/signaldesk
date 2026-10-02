import { DIGEST_HOURS, MACRO_HOURS, NEAR_HOURS } from "../jobs/schedule.js";
import { deskParts, formatDeskStamp, fromDeskLocal } from "./tz.js";

const NEWS_MS = 5 * 60 * 1000;
const TAPE_MS = 60 * 1000;

export function nextAlignedUtc(periodMs: number, now = new Date()): Date {
  const t = now.getTime();
  return new Date(Math.floor(t / periodMs) * periodMs + periodMs);
}

export function nextNewsAt(now = new Date()): Date {
  return nextAlignedUtc(NEWS_MS, now);
}

export function nextTapeAt(now = new Date()): Date {
  return nextAlignedUtc(TAPE_MS, now);
}

function nextAtDeskHours(hours: readonly number[], now = new Date()): Date {
  const p = deskParts(now);
  for (const hour of hours) {
    const candidate = fromDeskLocal(p.year, p.month, p.day, hour);
    if (candidate.getTime() > now.getTime()) {
      return candidate;
    }
  }
  const midnight = fromDeskLocal(p.year, p.month, p.day, 0);
  const next = deskParts(new Date(midnight.getTime() + 24 * 60 * 60 * 1000));
  return fromDeskLocal(next.year, next.month, next.day, hours[0] ?? 0);
}

export function nextDigestAt(now = new Date()): Date {
  return nextAtDeskHours(DIGEST_HOURS, now);
}

export function nextMacroAt(now = new Date()): Date {
  return nextAtDeskHours(MACRO_HOURS, now);
}

export function nextNearAt(now = new Date()): Date {
  return nextAtDeskHours(NEAR_HOURS, now);
}

export function formatWait(next: Date, now = new Date()): string {
  const sec = Math.max(0, Math.round((next.getTime() - now.getTime()) / 1000));
  const minutes = Math.floor(sec / 60);
  const seconds = sec % 60;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s until ${formatDeskStamp(next)}`;
}
