import { NextRequest } from "next/server";
import { createObservedCacheHealthResponse } from "@/lib/api/cache-health-response";

/**
 * Health check endpoint used by monitoring and cron jobs.
 *
 * Returns a minimal, stable JSON payload so that both automated checks
 * and e2e tests can reliably assert service availability.
 */
export function GET(request: NextRequest) {
  return createObservedCacheHealthResponse(request);
}
