import type pg from "pg";
import type { OpsControl, OpsControlAction } from "./types.js";

export const OPS_COMMAND_MAX_AGE_MS = 2 * 60_000;

const DDL = `
CREATE TABLE IF NOT EXISTS ops_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz
);
CREATE INDEX IF NOT EXISTS ops_commands_unclaimed_idx ON ops_commands (at) WHERE claimed_at IS NULL;
`;

const QUEUED_ACTIONS = new Set<OpsControlAction>([
  "stop",
  "pause",
  "resume",
  "run-news",
  "run-tape",
  "run-digest",
  "run-macro",
  "run-near",
]);

export function isQueuedControlAction(value: string): value is OpsControlAction {
  return QUEUED_ACTIONS.has(value as OpsControlAction);
}

export async function ensureOpsCommandTable(pool: pg.Pool): Promise<void> {
  await pool.query(DDL);
}

export async function enqueueOpsCommand(pool: pg.Pool, action: OpsControlAction, now = new Date()): Promise<void> {
  if (!isQueuedControlAction(action)) {
    throw new Error(`cannot queue ${action}`);
  }
  await ensureOpsCommandTable(pool);
  await pool.query(`INSERT INTO ops_commands (action, at) VALUES ($1, $2::timestamptz)`, [action, now.toISOString()]);
}

export async function claimOpsCommands(pool: pg.Pool, now = new Date()): Promise<OpsControl[]> {
  await ensureOpsCommandTable(pool);
  const cutoff = new Date(now.getTime() - OPS_COMMAND_MAX_AGE_MS).toISOString();
  const result = await pool.query<{ action: string; at: Date }>(
    `WITH next AS (
       SELECT id
       FROM ops_commands
       WHERE claimed_at IS NULL AND at >= $1::timestamptz
       ORDER BY at ASC
       FOR UPDATE SKIP LOCKED
       LIMIT 20
     )
     UPDATE ops_commands AS cmd
     SET claimed_at = $2::timestamptz
     FROM next
     WHERE cmd.id = next.id
     RETURNING cmd.action, cmd.at`,
    [cutoff, now.toISOString()],
  );
  const rows: OpsControl[] = [];
  for (const row of result.rows) {
    if (!isQueuedControlAction(row.action)) {
      continue;
    }
    const at = row.at instanceof Date ? row.at.toISOString() : String(row.at);
    rows.push({ action: row.action, at });
  }
  return rows;
}
