import type { Decision, Event, FeatureSnapshot, Horizon } from "../domain/index.js";
import { adjustProbs, lookupPrior, type PriorLookup } from "./priors.js";
import { legsAgree, legsDisagree, tapePolarity } from "./tape.js";
import { defaultKill, tapeKillsThesis, type LiveThesis } from "./thesis.js";

export const HIGH_NOVELTY = 0.8;
export const HIGH_CREDIBILITY = 0.7;
export const LOUD_NARRATIVE = 0.4;
export const FADE_CREDIBILITY = 0.5;
export const DEFAULT_HORIZON: Horizon = "24h";

export type FuseThresholds = {
  highNovelty?: number;
  highCredibility?: number;
  fadeCredibility?: number;
  loudNarrative?: number;
};

const EXTREME = new Set(["HACK_VENUE", "HACK_PROTOCOL", "EXCHANGE_STRESS"]);

export type FuseInput = {
  event: Event;
  snapshot: FeatureSnapshot;
  live?: LiveThesis | null;
  killHit?: boolean;
  priors?: PriorLookup;
  thresholds?: FuseThresholds;
};

function resolveThresholds(input: FuseInput) {
  return {
    highNovelty: input.thresholds?.highNovelty ?? HIGH_NOVELTY,
    highCredibility: input.thresholds?.highCredibility ?? HIGH_CREDIBILITY,
    fadeCredibility: input.thresholds?.fadeCredibility ?? FADE_CREDIBILITY,
    loudNarrative: input.thresholds?.loudNarrative ?? LOUD_NARRATIVE,
  };
}

function pickAsset(event: Event, snapshot: FeatureSnapshot) {
  if (event.assets.includes(snapshot.asset)) {
    return snapshot.asset;
  }
  return event.assets[0] ?? snapshot.asset;
}

function decision(
  input: FuseInput,
  kind: Decision["kind"],
  narrative: number,
  tape: number,
): Decision {
  const asset = pickAsset(input.event, input.snapshot);
  const probs = adjustProbs(
    lookupPrior(
      {
        class: input.event.class,
        volRegime: input.snapshot.volRegime,
        horizon: DEFAULT_HORIZON,
      },
      input.priors,
    ),
    narrative,
    tape,
  );
  const t = resolveThresholds(input);
  const why: string[] = [
    `${input.event.class} polarity ${narrative}`,
    `tape ${tape >= 0 ? "bid" : "offer"}`,
  ];
  if (input.event.novelty >= t.highNovelty) {
    why.push("high novelty");
  }
  if (input.event.credibility >= t.highCredibility) {
    why.push("high credibility");
  }
  return {
    kind,
    asset,
    horizon: DEFAULT_HORIZON,
    ...probs,
    why,
    kill: defaultKill(narrative || tape),
    eventId: input.event.id,
  };
}

export function fuse(input: FuseInput): Decision[] {
  const narrative = Math.sign(input.event.polarity) * Math.min(1, Math.abs(input.event.polarity));
  const tape = tapePolarity(input.snapshot);
  const live = input.live;
  const t = resolveThresholds(input);

  if (live && (input.killHit || tapeKillsThesis(live, tape))) {
    return [decision(input, "INVALIDATE", live.polarity, tape)];
  }

  if (
    live &&
    live.fingerprint !== input.event.fingerprint &&
    live.asset === pickAsset(input.event, input.snapshot) &&
    legsAgree(narrative, tape) &&
    Math.sign(narrative) === Math.sign(live.polarity)
  ) {
    return [decision(input, "CONFIRM", narrative, tape)];
  }

  const strong =
    input.event.novelty >= t.highNovelty && input.event.credibility >= t.highCredibility;
  const extreme = EXTREME.has(input.event.class) && strong;

  if (strong && legsAgree(narrative, tape)) {
    return [decision(input, "FLASH", narrative, tape)];
  }
  if (extreme && !legsDisagree(narrative, tape)) {
    return [decision(input, "FLASH", narrative || -1, tape)];
  }
  if (
    Math.abs(input.event.polarity) >= t.loudNarrative &&
    input.event.credibility >= t.fadeCredibility &&
    legsDisagree(narrative, tape)
  ) {
    return [decision(input, "FADE", narrative, tape)];
  }
  return [];
}
