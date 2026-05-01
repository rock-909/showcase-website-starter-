import { NextRequest, NextResponse } from "next/server";
import { withIdempotency } from "@/lib/idempotency";

async function handlePost(request: NextRequest): Promise<NextResponse> {
  // ok: critical-lead-route-missing-idempotency
  return withIdempotency(
    request,
    async () => {
      return NextResponse.json({ ok: true });
    },
    { required: true },
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handlePost(request);
}
