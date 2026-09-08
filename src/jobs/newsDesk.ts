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
import { ops } from "../ops/log.js";
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

  ops("news", "desk.start", `Classifying ${items.length} new item(s)`, {
    data: { items: items.length },
  });
  for (const item of items) {
    try {
      ops("news", "item.classify", `Classify ${item.sourceId}: ${item.title.slice(0, 120)}`, {
        data: { sourceId: item.sourceId, url: item.url },
      });
      const classified = await classifyRawItem(item, deps.llm, novelty, item.publishedAt);
      novelty.remember?.(classified.fingerprint, item.publishedAt);
      const draft = toNewEvent(item, classified);
      const event = deps.persistEvent
        ? await deps.persistEvent(draft)
        : eventFromClassified(item, classified);
      events.push(event);
      ops("news", "item.classified", `${classified.class} novelty=${classified.novelty} cred=${classified.credibility}`, {
        level: "ok",
        data: {
          class: classified.class,
          novelty: classified.novelty,
          credibility: classified.credibility,
          polarity: classified.polarity,
        },
      });
      if (classified.novelty === 0) {
        ops("news", "item.skip", `Ignoring ${item.url}: already seen in 24h (novelty 0)`, {
          level: "skip",
          data: { url: item.url },
        });
        continue;
      }
      const asset = event.assets[0] ?? "BTC";
      const snapshot = (await deps.snapshotFor?.(asset, now)) ?? quietSnapshot(asset, now);
      emits.push(...(await deps.policy.handle(event, snapshot, now)));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      ops("news", "item.skip", `Ignoring item ${item.url}: ${message}`, {
        level: "skip",
        data: { url: item.url, reason: message },
      });
    }
  }
  return { events, emits };
}
