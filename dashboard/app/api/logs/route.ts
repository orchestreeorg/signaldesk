import { NextRequest, NextResponse } from "next/server";
import { readLogs } from "@/lib/redis";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const after = Number(request.nextUrl.searchParams.get("after") ?? "0");
  try {
    const events = await readLogs(Number.isFinite(after) ? after : 0);
    return NextResponse.json({ events });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message, events: [] }, { status: 500 });
  }
}
