import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_DESK_SETTINGS, SAMPLE_HEADLINE_TITLES } from "../../../../../src/desk/defaults.js";
import { parseSettings } from "../../../../../src/desk/validate.js";
import { headlineTone, shouldSendHeadline } from "../../../../../src/telegram/tone.js";
import { dashSecret } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const secret = dashSecret();
  if (secret && request.headers.get("x-dash-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json()) as Record<string, unknown>;
  const settings = parseSettings((body.settings as Record<string, unknown>) ?? body, DEFAULT_DESK_SETTINGS);
  if ("error" in settings) {
    return NextResponse.json({ error: settings.error }, { status: 400 });
  }
  const titles = Array.isArray(body.titles)
    ? body.titles.map((title) => String(title))
    : SAMPLE_HEADLINE_TITLES;
  return NextResponse.json({
    preview: titles.map((title) => {
      const tone = headlineTone(title, settings);
      return { title, tone, send: shouldSendHeadline(tone, settings) };
    }),
  });
}
