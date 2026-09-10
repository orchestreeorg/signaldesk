CREATE TABLE IF NOT EXISTS macro_observations (
  source text NOT NULL,
  as_of timestamptz NOT NULL,
  value double precision NOT NULL,
  aux jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (source, as_of)
);

CREATE INDEX IF NOT EXISTS macro_observations_as_of_idx
  ON macro_observations (as_of DESC);
