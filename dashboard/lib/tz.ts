/** Argentina civil time. No DST; always UTC−3. Matches src/ops/tz.ts. */
export const DESK_TZ_ABBR = "ART";
const DESK_OFFSET_MS = -3 * 60 * 60 * 1000;

function parts(iso: string) {
  const date = new Date(iso);
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

function pad(value: number, width = 2): string {
  return String(value).padStart(width, "0");
}

export function formatDeskClock(iso: string, opts?: { seconds?: boolean; ms?: boolean }): string {
  const p = parts(iso);
  const hh = pad(p.hour);
  const mm = pad(p.minute);
  if (opts?.ms) {
    return `${hh}:${mm}:${pad(p.second)}.${pad(p.ms, 3)} ${DESK_TZ_ABBR}`;
  }
  if (opts?.seconds) {
    return `${hh}:${mm}:${pad(p.second)} ${DESK_TZ_ABBR}`;
  }
  return `${hh}:${mm} ${DESK_TZ_ABBR}`;
}

export function formatDeskStamp(iso: string): string {
  const p = parts(iso);
  return `${p.year}-${pad(p.month)}-${pad(p.day)} ${formatDeskClock(iso)}`;
}
