import { canonicalizeKey } from "../../domain/index.js";
import { hammingDistance } from "./simhash.js";
import { SIMHASH_NEAR_DUP_BITS, type RawItem } from "./types.js";

export function isSameStory(a: RawItem, b: RawItem): boolean {
  if (canonicalizeKey(a.url) === canonicalizeKey(b.url)) {
    return true;
  }
  return hammingDistance(a.simhash, b.simhash) <= SIMHASH_NEAR_DUP_BITS;
}

export function collapseRawItems(items: RawItem[]): RawItem[] {
  const kept: RawItem[] = [];
  for (const item of items) {
    const existing = kept.find((row) => isSameStory(row, item));
    if (!existing) {
      kept.push(item);
    }
  }
  return kept;
}
