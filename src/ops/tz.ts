/** Argentina civil time. No DST; always UTC−3. */
export const DESK_TZ = "America/Argentina/Buenos_Aires";
export const DESK_TZ_ABBR = "ART";
export const DESK_OFFSET_MS = -3 * 60 * 60 * 1000;

export type DeskParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  ms: number;
};

export function deskParts(date: Date): DeskParts {
  const shifted = new Date(date.getTime() + DESK_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
    ms: shifted.getUTCMilliseconds(),
  };
}

export function fromDeskLocal(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute = 0,
  second = 0,
  ms = 0,
): Date {
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second, ms) - DESK_OFFSET_MS);
}

export function deskDayKey(date: Date): string {
  const p = deskParts(date);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function formatDeskClock(date: Date, opts?: { seconds?: boolean; ms?: boolean }): string {
  const p = deskParts(date);
  const hh = String(p.hour).padStart(2, "0");
  const mm = String(p.minute).padStart(2, "0");
  if (opts?.ms) {
    const ss = String(p.second).padStart(2, "0");
    const ms = String(p.ms).padStart(3, "0");
    return `${hh}:${mm}:${ss}.${ms} ${DESK_TZ_ABBR}`;
  }
  if (opts?.seconds) {
    const ss = String(p.second).padStart(2, "0");
    return `${hh}:${mm}:${ss} ${DESK_TZ_ABBR}`;
  }
  return `${hh}:${mm} ${DESK_TZ_ABBR}`;
}

export function formatDeskStamp(date: Date): string {
  const p = deskParts(date);
  const y = String(p.year);
  const m = String(p.month).padStart(2, "0");
  const d = String(p.day).padStart(2, "0");
  return `${y}-${m}-${d} ${formatDeskClock(date)}`;
}
