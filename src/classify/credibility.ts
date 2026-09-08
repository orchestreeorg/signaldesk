import type { EventClass } from "../domain/index.js";
import { isHotClass } from "./validate.js";

const PRIMARY_SOURCES = new Set(["fed", "edgar"]);

const SPAM = /airdrop|100x|guaranteed|free money|whitelisting|click here|giveaway/i;

export function isPrimarySource(sourceId: string, sourceRank: number): boolean {
  return PRIMARY_SOURCES.has(sourceId) || sourceRank >= 90;
}

export function looksLikeSpam(title: string, body: string): boolean {
  return SPAM.test(`${title}\n${body}`);
}

export function credibilityOf(input: {
  sourceId: string;
  sourceRank: number;
  class: EventClass;
  title: string;
  body: string;
}): { credibility: number; isPrimary: boolean; class: EventClass } {
  const isPrimary = isPrimarySource(input.sourceId, input.sourceRank);
  let credibility = input.sourceRank / 100;
  credibility = isPrimary ? Math.min(1, credibility + 0.05) : credibility * 0.8;

  let eventClass = input.class;
  if (looksLikeSpam(input.title, input.body) || input.sourceRank < 40) {
    credibility = Math.min(credibility, 0.25);
    if (isHotClass(eventClass)) {
      eventClass = "OTHER";
    }
  }

  return { credibility: Number(credibility.toFixed(4)), isPrimary, class: eventClass };
}
