import type { Alert, AlertKind, Asset, Horizon } from "../domain/index.js";
import type { Database } from "./client.js";
import { toAlert } from "./map.js";
import { alerts } from "./schema.js";

export type NewAlert = {
  kind: AlertKind;
  fingerprint: string;
  eventId?: string;
  asset: Asset;
  horizon: Horizon;
  pUp: number;
  pDown: number;
  pIn: number;
  why: string[];
  kill: string;
};

export type InsertAlertResult =
  | { inserted: true; alert: Alert }
  | { inserted: false; reason: "duplicate" };

export async function insertAlert(db: Database, input: NewAlert): Promise<InsertAlertResult> {
  const inserted = await db
    .insert(alerts)
    .values({
      kind: input.kind,
      fingerprint: input.fingerprint,
      eventId: input.eventId,
      asset: input.asset,
      horizon: input.horizon,
      pUp: input.pUp,
      pDown: input.pDown,
      pIn: input.pIn,
      why: input.why,
      kill: input.kill,
    })
    .onConflictDoNothing({ target: [alerts.kind, alerts.fingerprint] })
    .returning();

  const created = inserted[0];
  if (!created) {
    return { inserted: false, reason: "duplicate" };
  }
  return { inserted: true, alert: toAlert(created) };
}
