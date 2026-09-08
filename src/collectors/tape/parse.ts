import { assetFromSymbol, type TapeTick } from "./types.js";

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function ts(value: unknown): Date {
  const n = num(value);
  return n ? new Date(n) : new Date();
}

export function parseAggTrade(payload: unknown): TapeTick | undefined {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }
  const row = payload as Record<string, unknown>;
  const symbol = String(row.s ?? "");
  const asset = assetFromSymbol(symbol);
  const price = num(row.p);
  const qty = num(row.q);
  if (!asset || price === null || qty === null) {
    return undefined;
  }
  const maker = Boolean(row.m);
  const side = maker ? "sell" : "buy";
  return {
    ts: ts(row.T ?? row.E),
    asset,
    symbol,
    kind: "trade",
    price,
    qty,
    side,
    funding: null,
    openInterest: null,
    cvdDelta: side === "buy" ? qty : -qty,
  };
}

export function parseForceOrder(payload: unknown): TapeTick | undefined {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }
  const row = payload as Record<string, unknown>;
  const order = (row.o ?? row) as Record<string, unknown>;
  const symbol = String(order.s ?? "");
  const asset = assetFromSymbol(symbol);
  const price = num(order.ap ?? order.p);
  const qty = num(order.q);
  if (!asset || price === null) {
    return undefined;
  }
  const side = String(order.S ?? "").toUpperCase() === "BUY" ? "buy" : "sell";
  return {
    ts: ts(order.T ?? row.E),
    asset,
    symbol,
    kind: "liquidation",
    price,
    qty,
    side,
    funding: null,
    openInterest: null,
    cvdDelta: null,
  };
}

export function parseMarkPrice(payload: unknown): TapeTick | undefined {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }
  const row = payload as Record<string, unknown>;
  const symbol = String(row.s ?? "");
  const asset = assetFromSymbol(symbol);
  const price = num(row.p);
  if (!asset || price === null) {
    return undefined;
  }
  return {
    ts: ts(row.E),
    asset,
    symbol,
    kind: "mark",
    price,
    qty: null,
    side: null,
    funding: num(row.r),
    openInterest: null,
    cvdDelta: null,
  };
}

export function parseOpenInterest(payload: unknown): TapeTick | undefined {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }
  const row = payload as Record<string, unknown>;
  const symbol = String(row.symbol ?? row.s ?? "");
  const asset = assetFromSymbol(symbol);
  const openInterest = num(row.openInterest);
  if (!asset || openInterest === null) {
    return undefined;
  }
  return {
    ts: row.time ? ts(row.time) : new Date(),
    asset,
    symbol,
    kind: "oi",
    price: null,
    qty: null,
    side: null,
    funding: null,
    openInterest,
    cvdDelta: null,
  };
}

export function parseTapeMessage(payload: unknown): TapeTick | undefined {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }
  const row = payload as Record<string, unknown>;
  const event = String(row.e ?? "");
  if (event === "aggTrade") {
    return parseAggTrade(row);
  }
  if (event === "forceOrder") {
    return parseForceOrder(row);
  }
  if (event === "markPriceUpdate" || event === "markPrice") {
    return parseMarkPrice(row);
  }
  if ("openInterest" in row) {
    return parseOpenInterest(row);
  }
  return undefined;
}
