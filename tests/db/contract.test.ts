import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { insertAlert } from "../../src/db/alerts.js";
import { createDb, createPool } from "../../src/db/client.js";
import { eventFingerprint, upsertEvent, type NewEvent } from "../../src/db/events.js";
import { migrate } from "../../src/db/migrate.js";
import { alerts, events, outcomes } from "../../src/db/schema.js";
import { COLLAPSE_WINDOW_MS } from "../../src/domain/index.js";

const databaseUrl = process.env.DATABASE_URL;

const story: NewEvent = {
  class: "EXCHANGE_STRESS",
  assets: ["BTC"],
  source: "coindesk",
  url: "https://www.coindesk.com/markets/venue-pause",
  novelty: 0.9,
  credibility: 0.8,
  polarity: -0.7,
  occurredAt: new Date("2026-09-07T12:00:00.000Z"),
};

describe.skipIf(!databaseUrl)("domain persistence", () => {
  const pool = createPool(databaseUrl ?? "");
  const db = createDb(pool);

  beforeAll(async () => {
    await migrate(databaseUrl ?? "");
  });

  beforeEach(async () => {
    await db.delete(outcomes);
    await db.delete(alerts);
    await db.delete(events);
  });

  afterAll(async () => {
    await pool.end();
  });

  it("reuses the event row for the same class+asset+url inside 30 minutes", async () => {
    const first = await upsertEvent(db, story);
    const second = await upsertEvent(db, {
      ...story,
      occurredAt: new Date(story.occurredAt.getTime() + 10 * 60 * 1000),
      novelty: 0.1,
    });
    expect(second.id).toBe(first.id);
    expect(second.fingerprint).toBe(first.fingerprint);
    expect(second.fingerprint).toBe(eventFingerprint(story));
  });

  it("creates a new event fingerprint after the collapse window", async () => {
    const first = await upsertEvent(db, story);
    const later = await upsertEvent(db, {
      ...story,
      occurredAt: new Date(story.occurredAt.getTime() + COLLAPSE_WINDOW_MS),
    });
    expect(later.fingerprint).not.toBe(first.fingerprint);
    expect(later.id).not.toBe(first.id);
  });

  it("rejects a duplicate FLASH for the same fingerprint", async () => {
    const event = await upsertEvent(db, story);
    const payload = {
      kind: "FLASH" as const,
      fingerprint: event.fingerprint,
      eventId: event.id,
      asset: "BTC" as const,
      horizon: "24h" as const,
      pUp: 0.09,
      pDown: 0.71,
      pIn: 0.2,
      why: ["venue pause"],
      kill: "withdrawals resume",
    };
    const first = await insertAlert(db, payload);
    const second = await insertAlert(db, payload);
    expect(first.inserted).toBe(true);
    expect(second).toEqual({ inserted: false, reason: "duplicate" });
  });
});
