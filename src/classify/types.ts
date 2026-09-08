import type { Asset, EventClass } from "../domain/index.js";

export type LlmExtract = {
  class: string;
  assets: string[];
  polarity: number;
  summary: string;
};

export type Classification = {
  class: EventClass;
  assets: Asset[];
  polarity: number;
  novelty: number;
  credibility: number;
  summary: string;
  isPrimary: boolean;
  fingerprint: string;
};
