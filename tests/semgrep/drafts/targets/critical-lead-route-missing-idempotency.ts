// ruleid: critical-lead-route-missing-idempotency
export async function POST(request: Request) {
  return handleContactRequest(request);
}
