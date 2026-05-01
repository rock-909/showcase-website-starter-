import { NextRequest, NextResponse } from "next/server";
import { withIdempotency } from "@/lib/idempotency";

function handlePost(request: NextRequest): Promise<NextResponse> {
  return withIdempotency(
    request,
    async () => {
      // ok: critical-lead-route-missing-idempotency
      return NextResponse.json({ ok: true });
    },
    { required: true },
  );
}

const POST_RATE_LIMITED = (request: NextRequest) => handlePost(request);

export async function POST(request: NextRequest): Promise<NextResponse> {
  return POST_RATE_LIMITED(request);
}
