import type { Asset } from "../domain/index.js";

export type LiveThesis = {
  fingerprint: string;
  eventId: string;
  asset: Asset;
  polarity: number;
  kill: string;
  confirmed: boolean;
};

export function defaultKill(polarity: number): string {
  if (polarity < 0) {
    return "CVD flips positive AND funding >= 0";
  }
  if (polarity > 0) {
    return "CVD flips negative AND exchange inflow z > 1";
  }
  return "Tape polarity flips for two consecutive snapshots";
}

export function tapeKillsThesis(thesis: LiveThesis, tape: number): boolean {
  if (tape === 0) {
    return false;
  }
  return Math.sign(thesis.polarity) !== 0 && Math.sign(tape) !== Math.sign(thesis.polarity);
}
