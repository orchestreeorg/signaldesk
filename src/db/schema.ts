import {
  doublePrecision,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const events = pgTable("events", {
  id: uuid("id").defaultRandom().primaryKey(),
  class: text("class").notNull(),
  assets: text("assets").array().notNull(),
  source: text("source").notNull(),
  url: text("url").notNull(),
  fingerprint: text("fingerprint").notNull().unique(),
  novelty: doublePrecision("novelty").notNull(),
  credibility: doublePrecision("credibility").notNull(),
  polarity: doublePrecision("polarity").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const featureSnapshots = pgTable(
  "feature_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ts: timestamp("ts", { withTimezone: true }).notNull(),
    asset: text("asset").notNull(),
    exchangeNetflowZ: doublePrecision("exchange_netflow_z"),
    stablecoinDeltaZ: doublePrecision("stablecoin_delta_z"),
    funding: doublePrecision("funding"),
    oiChangePct: doublePrecision("oi_change_pct"),
    cvd: doublePrecision("cvd"),
    volRegime: text("vol_regime").notNull(),
  },
  (table) => [unique("feature_snapshots_ts_asset").on(table.ts, table.asset)],
);

export const alerts = pgTable(
  "alerts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    kind: text("kind").notNull(),
    fingerprint: text("fingerprint").notNull(),
    eventId: uuid("event_id").references(() => events.id),
    asset: text("asset").notNull(),
    horizon: text("horizon").notNull(),
    pUp: doublePrecision("p_up").notNull(),
    pDown: doublePrecision("p_down").notNull(),
    pIn: doublePrecision("p_in").notNull(),
    why: text("why").array().notNull().default([]),
    kill: text("kill").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [unique("alerts_kind_fingerprint").on(table.kind, table.fingerprint)],
);

export const outcomes = pgTable(
  "outcomes",
  {
    alertId: uuid("alert_id")
      .notNull()
      .references(() => alerts.id),
    horizon: text("horizon").notNull(),
    realizedReturn: doublePrecision("realized_return"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => [primaryKey({ columns: [table.alertId, table.horizon] })],
);
