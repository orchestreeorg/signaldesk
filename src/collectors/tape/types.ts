import type { Asset } from "../../domain/index.js";

export type TapeTickKind = "trade" | "liquidation" | "mark" | "oi";

export type TapeTick = {
  ts: Date;
  asset: Asset;
  symbol: string;
  kind: TapeTickKind;
  price: number | null;
  qty: number | null;
  side: "buy" | "sell" | null;
  funding: number | null;
  openInterest: number | null;
  cvdDelta: number | null;
};

export const TAPE_SYMBOLS = ["BTCUSDT", "ETHUSDT"] as const;

export function assetFromSymbol(symbol: string): Asset | undefined {
  if (symbol.startsWith("BTC")) {
    return "BTC";
  }
  if (symbol.startsWith("ETH")) {
    return "ETH";
  }
  return undefined;
}
