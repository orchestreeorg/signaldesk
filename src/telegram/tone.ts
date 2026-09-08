import {
  DEFAULT_DESK_SETTINGS,
  LOOSE_BEARISH_EXTRA,
  LOOSE_BULLISH_EXTRA,
  STRICT_STRONG_BEARISH,
  STRICT_STRONG_BULLISH,
} from "../desk/defaults.js";
import type { DeskSettings, HeadlineSendMode } from "../desk/types.js";

export const HEADLINE_TONES = ["BULLISH", "BEARISH", "NEUTRAL"] as const;
export type HeadlineTone = (typeof HEADLINE_TONES)[number];

export type ToneInput = Pick<DeskSettings, "toneMode" | "bullishTerms" | "bearishTerms" | "headlineSend" | "headlineEnabled">;

function escapeTerm(term: string): string {
  return term.trim().toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
}

export function termHits(title: string, terms: string[]): string[] {
  const lower = title.toLowerCase();
  return terms.filter((term) => {
    const trimmed = term.trim();
    if (!trimmed) {
      return false;
    }
    return new RegExp(`\\b${escapeTerm(trimmed)}\\b`, "i").test(lower);
  });
}

function hasWithdrawalStress(title: string): boolean {
  const lower = title.toLowerCase();
  return (
    /\bwithdrawals?\b/.test(lower) &&
    /\b(pause|pauses|paused|pausing|halt|halts|halted|outage)\b/.test(lower)
  );
}

function termsFor(settings: ToneInput, side: "bull" | "bear"): string[] {
  const base = side === "bull" ? settings.bullishTerms : settings.bearishTerms;
  if (settings.toneMode !== "loose") {
    return base;
  }
  const extra = side === "bull" ? LOOSE_BULLISH_EXTRA : LOOSE_BEARISH_EXTRA;
  return [...new Set([...base, ...extra])];
}

function isStrong(hits: string[], strong: string[]): boolean {
  const set = new Set(strong.map((term) => term.toLowerCase()));
  return hits.some((hit) => set.has(hit.toLowerCase()));
}

/**
 * Title-only tone for headline pings. Not classify polarity and not fusion.
 */
export function headlineTone(title: string, settings: ToneInput = DEFAULT_DESK_SETTINGS): HeadlineTone {
  const bullHits = termHits(title, termsFor(settings, "bull"));
  const bearHits = [
    ...termHits(title, termsFor(settings, "bear")),
    ...(hasWithdrawalStress(title) ? ["withdrawal-pause"] : []),
  ];
  const bull = bullHits.length;
  const bear = bearHits.length;

  if (settings.toneMode === "loose") {
    if (bull === bear) {
      return "NEUTRAL";
    }
    return bull > bear ? "BULLISH" : "BEARISH";
  }

  if (bull > 0 && bear > 0) {
    return "NEUTRAL";
  }
  if (bull === 0 && bear === 0) {
    return "NEUTRAL";
  }

  if (settings.toneMode === "strict") {
    const strong =
      bull > 0
        ? isStrong(bullHits, STRICT_STRONG_BULLISH) || bull >= 2
        : isStrong(bearHits.filter((hit) => hit !== "withdrawal-pause"), STRICT_STRONG_BEARISH) ||
          bear >= 2 ||
          hasWithdrawalStress(title);
    if (!strong) {
      return "NEUTRAL";
    }
  }

  return bull > 0 ? "BULLISH" : "BEARISH";
}

export function shouldSendHeadline(
  tone: HeadlineTone,
  settings: Pick<DeskSettings, "headlineEnabled" | "headlineSend"> = DEFAULT_DESK_SETTINGS,
): boolean {
  if (!settings.headlineEnabled) {
    return false;
  }
  const mode: HeadlineSendMode = settings.headlineSend;
  if (mode === "all") {
    return true;
  }
  return tone !== "NEUTRAL";
}
