CREATE TABLE IF NOT EXISTS ops_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz
);

CREATE INDEX IF NOT EXISTS ops_commands_unclaimed_idx
  ON ops_commands (at)
  WHERE claimed_at IS NULL;
