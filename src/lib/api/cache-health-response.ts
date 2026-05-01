import { NextRequest, NextResponse } from "next/server";
import {
  applyRequestObservability,
  getRequestObservability,
} from "@/lib/api/request-observability";
import { recordApiResponseSignal } from "@/lib/observability/api-signals";

export interface CacheHealthResponse {
  status: "ok";
}

const CACHE_HEALTH_HEADERS = {
  "cache-control": "no-store",
} as const;

export function createCacheHealthResponse(): NextResponse<CacheHealthResponse> {
  return NextResponse.json(
    { status: "ok" },
    {
      status: 200,
      headers: CACHE_HEALTH_HEADERS,
    },
  );
}

export interface ObservedCacheHealthResponseOptions {
  requestId?: string;
}

export function createObservedCacheHealthResponse(
  request: NextRequest,
  options: ObservedCacheHealthResponseOptions = {},
): NextResponse<CacheHealthResponse> {
  const baseContext = getRequestObservability(request, "cache-health");
  const context = options.requestId
    ? { ...baseContext, requestId: options.requestId }
    : baseContext;
  const response = applyRequestObservability(
    createCacheHealthResponse(),
    context,
  );

  recordApiResponseSignal({
    context,
    response,
    name: "health.get",
    route: "/api/health",
  }).catch(() => undefined);

  return response;
}
