import type { FeatureSnapshot } from "../domain/index.js";

/** Positive = tape bid (bullish). Negative = tape offer (bearish). */
export function tapePolarity(snapshot: FeatureSnapshot): number {
  let score = 0;
  if (snapshot.exchangeNetflowZ !== null) {
    score -= snapshot.exchangeNetflowZ;
  }
  if (snapshot.stablecoinDeltaZ !== null) {
    score += snapshot.stablecoinDeltaZ * 0.5;
  }
  if (snapshot.cvd !== null) {
    score += Math.sign(snapshot.cvd);
  }
  if (snapshot.funding !== null && Math.abs(snapshot.funding) >= 0.0003) {
    score -= Math.sign(snapshot.funding) * 0.25;
  }
  if (score === 0) {
    return 0;
  }
  return score > 0 ? 1 : -1;
}

export function legsAgree(narrative: number, tape: number): boolean {
  return narrative !== 0 && tape !== 0 && Math.sign(narrative) === Math.sign(tape);
}

export function legsDisagree(narrative: number, tape: number): boolean {
  return narrative !== 0 && tape !== 0 && Math.sign(narrative) !== Math.sign(tape);
}
