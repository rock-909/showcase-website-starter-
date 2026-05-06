import { NextRequest, NextResponse } from "next/server";
import { safeParseJson } from "@/lib/api/safe-parse-json";

// ok: starter-lead-route-missing-safe-json-body
export async function POST(request: NextRequest): Promise<NextResponse> {
  const parsed = await safeParseJson<{ email?: string }>(request);
  if (!parsed.ok) {
    return NextResponse.json({ success: false });
  }

  return NextResponse.json({ ok: true });
}
