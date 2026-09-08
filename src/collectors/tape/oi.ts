import { parseOpenInterest } from "./parse.js";
import { openInterestUrl } from "./stream.js";
import { TAPE_SYMBOLS, type TapeTick } from "./types.js";

export async function fetchOpenInterest(
  fetchImpl: typeof fetch = fetch,
  host?: string,
): Promise<TapeTick[]> {
  const ticks: TapeTick[] = [];
  for (const symbol of TAPE_SYMBOLS) {
    const response = await fetchImpl(openInterestUrl(symbol, host), {
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      continue;
    }
    const tick = parseOpenInterest(await response.json());
    if (tick) {
      ticks.push(tick);
    }
  }
  return ticks;
}
