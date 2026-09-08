import type { AlertKind, Asset, EventClass, Horizon, VolRegime } from "./enums.js";

export type Event = {
  id: string;
  class: EventClass;
  assets: Asset[];
  source: string;
  url: string;
  fingerprint: string;
  novelty: number;
  credibility: number;
  polarity: number;
  occurredAt: Date;
};

export type FeatureSnapshot = {
  ts: Date;
  asset: Asset;
  exchangeNetflowZ: number | null;
  stablecoinDeltaZ: number | null;
  funding: number | null;
  oiChangePct: number | null;
  cvd: number | null;
  volRegime: VolRegime;
};

export type Decision = {
  kind: AlertKind;
  asset: Asset;
  horizon: Horizon;
  pUp: number;
  pDown: number;
  pIn: number;
  why: string[];
  kill: string;
  eventId?: string;
};

export type Outcome = {
  alertId: string;
  horizon: Horizon;
  realizedReturn: number | null;
  resolvedAt: Date | null;
};

export type Alert = {
  id: string;
  kind: AlertKind;
  fingerprint: string;
  eventId: string | null;
  asset: Asset;
  horizon: Horizon;
  pUp: number;
  pDown: number;
  pIn: number;
  why: string[];
  kill: string;
  sentAt: Date | null;
};
