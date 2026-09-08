import { DIGEST_HOURS_UTC } from "../jobs/schedule.js";

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

export function nextDigestAt(now = new Date()): Date {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const day = now.getUTCDate();
  for (const hour of DIGEST_HOURS_UTC) {
    const candidate = new Date(Date.UTC(year, month, day, hour, 0, 0));
    if (candidate.getTime() > now.getTime()) {
      return candidate;
    }
  }
  return new Date(Date.UTC(year, month, day + 1, DIGEST_HOURS_UTC[0], 0, 0));
}

export function formatWait(next: Date, now = new Date()): string {
  const sec = Math.max(0, Math.round((next.getTime() - now.getTime()) / 1000));
  const minutes = Math.floor(sec / 60);
  const seconds = sec % 60;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s until ${next.toISOString()}`;
}
