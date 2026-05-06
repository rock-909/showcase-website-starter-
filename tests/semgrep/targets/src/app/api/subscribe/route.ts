import { NextRequest, NextResponse } from "next/server";
import { safeParseJson } from "@/lib/api/safe-parse-json";

async function handlePost(request: NextRequest): Promise<NextResponse> {
  const parsed = await safeParseJson<{ email?: string }>(request);
  if (!parsed.ok) {
    return NextResponse.json({ success: false });
  }

  // ok: starter-lead-route-missing-safe-json-body
  return NextResponse.json({ ok: true });
}

const POST_RATE_LIMITED = (request: NextRequest) => handlePost(request);

export async function POST(request: NextRequest): Promise<NextResponse> {
  return POST_RATE_LIMITED(request);
}
