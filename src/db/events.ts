import { eq } from "drizzle-orm";
import type { Asset, Event, EventClass } from "../domain/index.js";
import { fingerprint } from "../domain/index.js";
import type { Database } from "./client.js";
import { toEvent } from "./map.js";
import { events } from "./schema.js";

export type NewEvent = {
  class: EventClass;
  assets: Asset[];
  source: string;
  url: string;
  novelty: number;
  credibility: number;
  polarity: number;
  occurredAt: Date;
};

function primaryAsset(assets: Asset[]): Asset {
  const asset = [...assets].sort()[0];
  if (!asset) {
    throw new Error("Event must include at least one asset");
  }
  return asset;
}

export function eventFingerprint(input: NewEvent): string {
  return fingerprint({
    class: input.class,
    asset: primaryAsset(input.assets),
    canonicalKey: input.url,
    at: input.occurredAt,
  });
}

export async function upsertEvent(db: Database, input: NewEvent): Promise<Event> {
  const fp = eventFingerprint(input);
  const existing = await db.select().from(events).where(eq(events.fingerprint, fp)).limit(1);
  const found = existing[0];
  if (found) {
    return toEvent(found);
  }

  const inserted = await db
    .insert(events)
    .values({
      class: input.class,
      assets: input.assets,
      source: input.source,
      url: input.url,
      fingerprint: fp,
      novelty: input.novelty,
      credibility: input.credibility,
      polarity: input.polarity,
      occurredAt: input.occurredAt,
    })
    .onConflictDoNothing({ target: events.fingerprint })
    .returning();

  const created = inserted[0];
  if (created) {
    return toEvent(created);
  }

  const raced = await db.select().from(events).where(eq(events.fingerprint, fp)).limit(1);
  const again = raced[0];
  if (!again) {
    throw new Error("Failed to upsert event");
  }
  return toEvent(again);
}
