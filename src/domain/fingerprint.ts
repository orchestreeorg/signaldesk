import { createHash } from "node:crypto";
import type { Asset, EventClass } from "./enums.js";

export const COLLAPSE_WINDOW_MS = 30 * 60 * 1000;

export function collapseBucket(at: Date): number {
  return Math.floor(at.getTime() / COLLAPSE_WINDOW_MS);
}

export function canonicalizeKey(key: string): string {
  try {
    const url = new URL(key);
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
    if (url.pathname !== "/" && url.pathname.endsWith("/")) {
      url.pathname = url.pathname.slice(0, -1);
    }
    return url.toString();
  } catch {
    return key.trim();
  }
}

export function fingerprint(input: {
  class: EventClass;
  asset: Asset;
  canonicalKey: string;
  at: Date;
}): string {
  const payload = [
    input.class,
    input.asset,
    canonicalizeKey(input.canonicalKey),
    String(collapseBucket(input.at)),
  ].join("\n");
  return createHash("sha256").update(payload).digest("hex");
}
