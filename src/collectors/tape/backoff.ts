export const BACKOFF_START_MS = 500;
export const BACKOFF_CAP_MS = 30_000;

export function nextBackoffMs(attempt: number): number {
  const exp = Math.max(0, attempt);
  return Math.min(BACKOFF_CAP_MS, BACKOFF_START_MS * 2 ** exp);
}
