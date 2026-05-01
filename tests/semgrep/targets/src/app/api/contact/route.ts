import { NextRequest, NextResponse } from "next/server";
import { withIdempotency } from "@/lib/idempotency";

// ruleid: critical-lead-route-missing-idempotency
export async function POST(request: NextRequest): Promise<NextResponse> {
  return withIdempotency(request, async () => {
    return NextResponse.json({ ok: true });
  });
}
