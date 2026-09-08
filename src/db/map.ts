import type { Alert, AlertKind, Asset, Event, EventClass, Horizon } from "../domain/index.js";
import type { alerts, events } from "./schema.js";

type EventRow = typeof events.$inferSelect;
type AlertRow = typeof alerts.$inferSelect;

export function toEvent(row: EventRow): Event {
  return {
    id: row.id,
    class: row.class as EventClass,
    assets: row.assets as Asset[],
    source: row.source,
    url: row.url,
    fingerprint: row.fingerprint,
    novelty: row.novelty,
    credibility: row.credibility,
    polarity: row.polarity,
    occurredAt: row.occurredAt,
  };
}

export function toAlert(row: AlertRow): Alert {
  return {
    id: row.id,
    kind: row.kind as AlertKind,
    fingerprint: row.fingerprint,
    eventId: row.eventId,
    asset: row.asset as Asset,
    horizon: row.horizon as Horizon,
    pUp: row.pUp,
    pDown: row.pDown,
    pIn: row.pIn,
    why: row.why,
    kill: row.kill,
    sentAt: row.sentAt,
  };
}
