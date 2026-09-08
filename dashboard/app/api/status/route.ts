import { NextResponse } from "next/server";
import { isVercel } from "@/lib/env";
import { readHeartbeat, workerOnline } from "@/lib/redis";
import { canSpawnWorker } from "@/lib/spawn";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const heartbeat = await readHeartbeat();
    const online = workerOnline(heartbeat);
    return NextResponse.json({
      online,
      heartbeat,
      spawnable: canSpawnWorker(),
      vercel: isVercel(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ online: false, error: message, spawnable: canSpawnWorker(), vercel: isVercel() }, { status: 500 });
  }
}
