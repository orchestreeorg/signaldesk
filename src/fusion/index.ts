export { fuse, DEFAULT_HORIZON, HIGH_CREDIBILITY, HIGH_NOVELTY } from "./fuse.js";
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
