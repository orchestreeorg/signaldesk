import type { RawItem } from "../collectors/news/types.js";
import {
  classifyRawItem,
  MemoryNoveltyIndex,
  toNewEvent,
  type LlmClient,
  type NoveltyIndex,
} from "../classify/index.js";
import { eventFingerprint, type NewEvent } from "../db/events.js";
import type { Asset, Event, FeatureSnapshot } from "../domain/index.js";
import type { Policy } from "../policy/index.js";
import type { EmitResult } from "../policy/index.js";

export function quietSnapshot(asset: Asset, now = new Date()): FeatureSnapshot {
  return {
    ts: now,
    asset,
    exchangeNetflowZ: null,
    stablecoinDeltaZ: null,
    funding: null,
    oiChangePct: null,
    cvd: null,
    volRegime: "mid",
  };
}

export function eventFromClassified(item: RawItem, classified: Awaited<ReturnType<typeof classifyRawItem>>): Event {
  const input = toNewEvent(item, classified);
  return {
    id: classified.fingerprint.slice(0, 32),
    ...input,
    fingerprint: eventFingerprint(input),
  };
}

export async function runNewsDesk(
  items: RawItem[],
  deps: {
    llm: LlmClient;
    policy: Policy;
    novelty?: NoveltyIndex;
    persistEvent?: (input: NewEvent) => Promise<Event>;
    snapshotFor?: (asset: Asset, now: Date) => FeatureSnapshot | Promise<FeatureSnapshot>;
    now?: Date;
  },
): Promise<{ events: Event[]; emits: EmitResult[] }> {
  const novelty = deps.novelty ?? new MemoryNoveltyIndex();
  const now = deps.now ?? new Date();
  const events: Event[] = [];
  const emits: EmitResult[] = [];

  for (const item of items) {
    try {
      const classified = await classifyRawItem(item, deps.llm, novelty, item.publishedAt);
      novelty.remember?.(classified.fingerprint, item.publishedAt);
      const draft = toNewEvent(item, classified);
      const event = deps.persistEvent
        ? await deps.persistEvent(draft)
        : eventFromClassified(item, classified);
      events.push(event);
      if (classified.novelty === 0) {
        continue;
      }
      const asset = event.assets[0] ?? "BTC";
      const snapshot = (await deps.snapshotFor?.(asset, now)) ?? quietSnapshot(asset, now);
      emits.push(...(await deps.policy.handle(event, snapshot, now)));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`news: skip item ${item.url}: ${message}`);
    }
  }
  return { events, emits };
}
