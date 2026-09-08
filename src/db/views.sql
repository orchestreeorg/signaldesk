CREATE OR REPLACE VIEW event_study_priors AS
WITH classes AS (
  SELECT unnest(ARRAY[
    'ETF_INFLOW', 'HACK_VENUE', 'HACK_PROTOCOL', 'RATE_CUT', 'ENFORCEMENT',
    'LISTING', 'UNLOCK', 'MACRO_SURPRISE', 'EXCHANGE_STRESS', 'OTHER'
  ]) AS class
),
regimes AS (
  SELECT unnest(ARRAY['low', 'mid', 'high']) AS vol_regime
),
horizons AS (
  SELECT unnest(ARRAY['1h', '4h', '24h', '7d']) AS horizon
),
grid AS (
  SELECT class, vol_regime, horizon
  FROM classes
  CROSS JOIN regimes
  CROSS JOIN horizons
),
resolved AS (
  SELECT
    e.class,
    COALESCE(fs.vol_regime, 'mid') AS vol_regime,
    o.horizon,
    o.realized_return
  FROM outcomes o
  JOIN alerts a ON a.id = o.alert_id
  JOIN events e ON e.id = a.event_id
  LEFT JOIN LATERAL (
    SELECT s.vol_regime
    FROM feature_snapshots s
    WHERE s.asset = a.asset
      AND s.ts <= COALESCE(a.sent_at, a.created_at)
    ORDER BY s.ts DESC
    LIMIT 1
  ) fs ON TRUE
  WHERE o.realized_return IS NOT NULL
    AND o.resolved_at IS NOT NULL
),
cell AS (
  SELECT
    class,
    vol_regime,
    horizon,
    COUNT(*)::int AS n,
    AVG(CASE WHEN realized_return > 0.02 THEN 1.0 ELSE 0.0 END) AS p_up,
    AVG(CASE WHEN realized_return < -0.02 THEN 1.0 ELSE 0.0 END) AS p_down,
    AVG(CASE WHEN realized_return BETWEEN -0.02 AND 0.02 THEN 1.0 ELSE 0.0 END) AS p_in
  FROM resolved
  GROUP BY 1, 2, 3
),
global AS (
  SELECT
    COUNT(*)::int AS n,
    COALESCE(AVG(CASE WHEN realized_return > 0.02 THEN 1.0 ELSE 0.0 END), 1.0 / 3) AS p_up,
    COALESCE(AVG(CASE WHEN realized_return < -0.02 THEN 1.0 ELSE 0.0 END), 1.0 / 3) AS p_down,
    COALESCE(AVG(CASE WHEN realized_return BETWEEN -0.02 AND 0.02 THEN 1.0 ELSE 0.0 END), 1.0 / 3) AS p_in
  FROM resolved
)
SELECT
  g.class,
  g.vol_regime,
  g.horizon,
  COALESCE(c.n, 0) AS n,
  CASE WHEN COALESCE(c.n, 0) >= 20 THEN c.p_up ELSE glob.p_up END AS p_up,
  CASE WHEN COALESCE(c.n, 0) >= 20 THEN c.p_down ELSE glob.p_down END AS p_down,
  CASE WHEN COALESCE(c.n, 0) >= 20 THEN c.p_in ELSE glob.p_in END AS p_in,
  CASE WHEN COALESCE(c.n, 0) >= 20 THEN 'empirical' ELSE 'global' END AS source
FROM grid g
CROSS JOIN global glob
LEFT JOIN cell c
  ON c.class = g.class
 AND c.vol_regime = g.vol_regime
 AND c.horizon = g.horizon;
