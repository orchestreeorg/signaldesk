import { NextRequest, NextResponse } from "next/server";
import { enqueueOpsCommand, isQueuedControlAction } from "../../../../src/ops/commands.js";
import { getDatabase } from "@/lib/pg";
import { startLocalWorker, stopLocalWorker } from "@/lib/spawn";
import { loadWorkerStatus } from "@/lib/status";
import type { OpsControlAction } from "@/lib/types";

export const dynamic = "force-dynamic";

const ACTIONS = new Set<OpsControlAction>([
  "start",
  "stop",
  "pause",
  "resume",
  "run-news",
  "run-tape",
  "run-digest",
  "run-macro",
  "run-near",
]);

const MESSAGES: Partial<Record<OpsControlAction, string>> = {
  "run-digest": "Queued DIGEST. The worker will send it on the desk bot in a few seconds.",
  "run-macro": "Queued weekly index. The worker will send it on the desk bot in a few seconds.",
  "run-near": "Queued NEAR position. The worker will send it on the NEAR bot in a few seconds.",
  "run-news": "Queued news poll.",
  "run-tape": "Queued tape OI tick.",
  pause: "Queued pause.",
  resume: "Queued resume.",
  stop: "Queued stop.",
};

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { action?: string };
  const action = body.action as OpsControlAction | undefined;
  if (!action || !ACTIONS.has(action)) {
    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }

  try {
    if (action === "start") {
      const status = await loadWorkerStatus();
      if (status.online) {
        await dispatch("resume");
        return NextResponse.json({ ok: true, message: "Worker already running; resume queued." });
      }
      const started = startLocalWorker();
      return NextResponse.json({
        ok: true,
        message: started.already ? "Local worker pid already alive." : `Spawned pnpm worker pid=${started.pid}`,
      });
    }
    if (action === "stop") {
      await dispatch("stop");
      stopLocalWorker();
      return NextResponse.json({ ok: true, message: MESSAGES.stop });
    }
    await dispatch(action);
    return NextResponse.json({ ok: true, message: MESSAGES[action] ?? `${action} queued` });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function dispatch(action: OpsControlAction) {
  if (!isQueuedControlAction(action)) {
    throw new Error(`cannot queue ${action}`);
  }
  await enqueueOpsCommand(getDatabase(), action);
}
