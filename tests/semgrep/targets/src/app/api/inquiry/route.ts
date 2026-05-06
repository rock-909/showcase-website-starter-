import { NextRequest, NextResponse } from "next/server";
import { safeParseJson } from "@/lib/api/safe-parse-json";

async function handlePost(request: NextRequest): Promise<NextResponse> {
  // ok: starter-lead-route-missing-safe-json-body
  const parsed = await safeParseJson<{ productSlug?: string }>(request);
  if (!parsed.ok) {
    return NextResponse.json({ success: false });
  }

  return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handlePost(request);
}
