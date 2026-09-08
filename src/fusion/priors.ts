import type { EventClass, Horizon, VolRegime } from "../domain/index.js";

export type Probs = {
  pUp: number;
  pDown: number;
  pIn: number;
};

export type PriorKey = {
  class: EventClass;
  volRegime: VolRegime;
  horizon: Horizon;
};

export type PriorLookup = (key: PriorKey) => Probs | undefined;

/** Fallback when the event-study view has no row. E2 prefers SQL once N≥20. */
export const CLASS_PRIORS: Record<EventClass, Probs> = {
  ETF_INFLOW: { pUp: 0.42, pDown: 0.18, pIn: 0.4 },
  HACK_VENUE: { pUp: 0.12, pDown: 0.58, pIn: 0.3 },
  HACK_PROTOCOL: { pUp: 0.14, pDown: 0.52, pIn: 0.34 },
  RATE_CUT: { pUp: 0.4, pDown: 0.2, pIn: 0.4 },
  ENFORCEMENT: { pUp: 0.18, pDown: 0.48, pIn: 0.34 },
  LISTING: { pUp: 0.38, pDown: 0.22, pIn: 0.4 },
  UNLOCK: { pUp: 0.22, pDown: 0.38, pIn: 0.4 },
  MACRO_SURPRISE: { pUp: 0.34, pDown: 0.34, pIn: 0.32 },
  EXCHANGE_STRESS: { pUp: 0.1, pDown: 0.62, pIn: 0.28 },
  OTHER: { pUp: 0.3, pDown: 0.3, pIn: 0.4 },
};

export function normalize(probs: Probs): Probs {
  const sum = probs.pUp + probs.pDown + probs.pIn;
  if (sum <= 0) {
    return { pUp: 1 / 3, pDown: 1 / 3, pIn: 1 / 3 };
  }
  return {
    pUp: Number((probs.pUp / sum).toFixed(4)),
    pDown: Number((probs.pDown / sum).toFixed(4)),
    pIn: Number((probs.pIn / sum).toFixed(4)),
  };
}

export function lookupPrior(key: PriorKey, lookup?: PriorLookup): Probs {
  return lookup?.(key) ?? CLASS_PRIORS[key.class];
}

export function adjustProbs(prior: Probs, narrative: number, tape: number): Probs {
  const mag = Math.min(0.2, (Math.abs(narrative) + Math.abs(tape)) * 0.08);
  let { pUp, pDown, pIn } = prior;
  const nSign = Math.sign(narrative);
  const tSign = Math.sign(tape);
  if (nSign !== 0 && nSign === tSign) {
    if (nSign > 0) {
      pUp += mag;
      pDown = Math.max(0.05, pDown - mag / 2);
      pIn = Math.max(0.05, pIn - mag / 2);
    } else {
      pDown += mag;
      pUp = Math.max(0.05, pUp - mag / 2);
      pIn = Math.max(0.05, pIn - mag / 2);
    }
  } else if (nSign !== 0 && tSign !== 0 && nSign !== tSign) {
    pIn += mag;
    pUp = Math.max(0.05, pUp - mag / 2);
    pDown = Math.max(0.05, pDown - mag / 2);
  }
  return normalize({ pUp, pDown, pIn });
}
