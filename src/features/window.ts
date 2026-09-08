/**
 * Feature window
 *
 * Bars are 5 minutes. The lookback is 30 days of those bars.
 * If history is shorter than 30 days, use all available bars — do not pad
 * or invent prices. Rolling realized vol uses 12 bars (one hour) when at
 * least 12 closes exist; otherwise it uses every return in the sample.
 */
export const BAR_MS = 5 * 60 * 1000;
export const FEATURE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
export const ROLLING_VOL_BARS = 12;

export function barStartMs(at: Date): number {
  return Math.floor(at.getTime() / BAR_MS) * BAR_MS;
}

export function windowStartMs(now: Date, earliestTickMs: number): number {
  const floor = now.getTime() - FEATURE_WINDOW_MS;
  return Math.max(floor, earliestTickMs);
}
