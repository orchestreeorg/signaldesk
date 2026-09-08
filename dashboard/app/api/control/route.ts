import { NextRequest, NextResponse } from "next/server";
import { dashSecret } from "@/lib/env";
import { getRedis, readHeartbeat, workerOnline } from "@/lib/redis";
import { startLocalWorker, stopLocalWorker } from "@/lib/spawn";
import { OPS_CONTROL_CHANNEL, type OpsControlAction } from "@/lib/types";

export const dynamic = "force-dynamic";

const ACTIONS = new Set<OpsControlAction>(["start", "stop", "pause", "resume", "run-news", "run-tape"]);

export async function POST(request: NextRequest) {
  const secret = dashSecret();
  if (secret && request.headers.get("x-dash-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json()) as { action?: string };
  const action = body.action as OpsControlAction | undefined;
  if (!action || !ACTIONS.has(action)) {
    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }

  try {
    if (action === "start") {
      const online = workerOnline(await readHeartbeat());
      if (online) {
        await publish("resume");
        return NextResponse.json({ ok: true, message: "Worker already running; resumed." });
      }
      const started = startLocalWorker();
      return NextResponse.json({
        ok: true,
        message: started.already ? "Local worker pid already alive." : `Spawned pnpm worker pid=${started.pid}`,
      });
    }
    if (action === "stop") {
      await publish("stop");
      stopLocalWorker();
      return NextResponse.json({ ok: true, message: "Stop sent to worker." });
    }
    await publish(action);
    return NextResponse.json({ ok: true, message: `${action} sent` });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function publish(action: OpsControlAction) {
  await getRedis().publish(
    OPS_CONTROL_CHANNEL,
    JSON.stringify({ action, at: new Date().toISOString() }),
  );
}
