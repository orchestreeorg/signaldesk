export const TONE_MODES = ["loose", "balanced", "strict"] as const;
export type ToneMode = (typeof TONE_MODES)[number];

export const HEADLINE_SEND_MODES = ["all", "skip_neutral", "directional_only"] as const;
export type HeadlineSendMode = (typeof HEADLINE_SEND_MODES)[number];

export type DeskSettings = {
  headlineEnabled: boolean;
  toneMode: ToneMode;
  headlineSend: HeadlineSendMode;
  bullishTerms: string[];
  bearishTerms: string[];
  flashEnabled: boolean;
  fadeEnabled: boolean;
  highNovelty: number;
  highCredibility: number;
  fadeCredibility: number;
  loudNarrative: number;
  flashDailyCap: number;
  newsBatchLimit: number;
};

export type NewsSourceRow = {
  id: string;
  name: string;
  url: string;
  rank: number;
  kind: "rss" | "atom" | "html" | "esplora";
  enabled: boolean;
};
