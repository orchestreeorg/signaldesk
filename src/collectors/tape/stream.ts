import { parseTapeMessage } from "./parse.js";
import { TAPE_SYMBOLS, type TapeTick } from "./types.js";

export const TAPE_WS_HOST = "wss://fstream.binance.com";
export const TAPE_REST_HOST = "https://fapi.binance.com";

export function combinedStreamUrl(host = TAPE_WS_HOST): string {
  const streams = TAPE_SYMBOLS.flatMap((symbol) => {
    const id = symbol.toLowerCase();
    return [`${id}@aggTrade`, `${id}@forceOrder`, `${id}@markPrice@1s`];
  });
  return `${host}/stream?streams=${streams.join("/")}`;
}

export function openInterestUrl(symbol: string, host = TAPE_REST_HOST): string {
  return `${host}/fapi/v1/openInterest?symbol=${symbol}`;
}

export function parseStreamEnvelope(raw: string): TapeTick | undefined {
  const message = JSON.parse(raw) as { data?: unknown };
  return parseTapeMessage(message.data ?? message);
}
