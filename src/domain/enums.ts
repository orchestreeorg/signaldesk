export const EVENT_CLASSES = [
  "ETF_INFLOW",
  "HACK_VENUE",
  "HACK_PROTOCOL",
  "RATE_CUT",
  "ENFORCEMENT",
  "LISTING",
  "UNLOCK",
  "MACRO_SURPRISE",
  "EXCHANGE_STRESS",
  "OTHER",
] as const;

export type EventClass = (typeof EVENT_CLASSES)[number];

export const ALERT_KINDS = [
  "FLASH",
  "FADE",
  "CONFIRM",
  "INVALIDATE",
  "DIGEST",
] as const;

export type AlertKind = (typeof ALERT_KINDS)[number];

export const ASSETS = ["BTC", "ETH"] as const;

export type Asset = (typeof ASSETS)[number];

export const HORIZONS = ["1h", "4h", "24h", "7d"] as const;

export type Horizon = (typeof HORIZONS)[number];

export const VOL_REGIMES = ["low", "mid", "high"] as const;

export type VolRegime = (typeof VOL_REGIMES)[number];
