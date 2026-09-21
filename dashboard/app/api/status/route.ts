import { NextResponse } from "next/server";
import { loadWorkerStatus } from "@/lib/status";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const status = await loadWorkerStatus();
    return NextResponse.json(status);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { online: false, error: message, spawnable: false, vercel: Boolean(process.env.VERCEL) },
      { status: 500 },
    );
  }
}
