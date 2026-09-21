CREATE TABLE IF NOT EXISTS ops_heartbeat (
  id integer PRIMARY KEY CHECK (id = 1),
  payload jsonb NOT NULL,
  ts timestamptz NOT NULL
);
