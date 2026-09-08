CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class text NOT NULL,
  assets text[] NOT NULL,
  source text NOT NULL,
  url text NOT NULL,
  fingerprint text NOT NULL UNIQUE,
  novelty double precision NOT NULL,
  credibility double precision NOT NULL,
  polarity double precision NOT NULL,
  occurred_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS feature_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ts timestamptz NOT NULL,
  asset text NOT NULL,
  exchange_netflow_z double precision,
  stablecoin_delta_z double precision,
  funding double precision,
  oi_change_pct double precision,
  cvd double precision,
  vol_regime text NOT NULL,
  CONSTRAINT feature_snapshots_ts_asset UNIQUE (ts, asset)
);

CREATE TABLE IF NOT EXISTS alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  fingerprint text NOT NULL,
  event_id uuid REFERENCES events (id),
  asset text NOT NULL,
  horizon text NOT NULL,
  p_up double precision NOT NULL,
  p_down double precision NOT NULL,
  p_in double precision NOT NULL,
  why text[] NOT NULL DEFAULT '{}',
  kill text NOT NULL,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT alerts_kind_fingerprint UNIQUE (kind, fingerprint)
);

CREATE TABLE IF NOT EXISTS outcomes (
  alert_id uuid NOT NULL REFERENCES alerts (id),
  horizon text NOT NULL,
  realized_return double precision,
  resolved_at timestamptz,
  PRIMARY KEY (alert_id, horizon)
);
