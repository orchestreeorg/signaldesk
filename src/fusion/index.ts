export {
  fuse,
  DEFAULT_HORIZON,
  FADE_CREDIBILITY,
  HIGH_CREDIBILITY,
  HIGH_NOVELTY,
  LOUD_NARRATIVE,
  type FuseThresholds,
} from "./fuse.js";
export {
  adjustProbs,
  CLASS_PRIORS,
  lookupPrior,
  normalize,
  type PriorKey,
  type PriorLookup,
} from "./priors.js";
export { legsAgree, legsDisagree, tapePolarity } from "./tape.js";
export { defaultKill, type LiveThesis } from "./thesis.js";
