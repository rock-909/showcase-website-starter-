import { NextRequest, NextResponse } from "next/server";
import type { ObservabilitySurface } from "@/lib/observability/system-observability";

export const REQUEST_ID_HEADER = "x-request-id";
export const OBSERVABILITY_SURFACE_HEADER = "x-observability-surface";

export interface RequestObservabilityContext {
  requestId: string;
  surface: ObservabilitySurface;
}

const requestObservabilityCache = new WeakMap<
  NextRequest,
  RequestObservabilityContext
>();

function readHeader(request: NextRequest, name: string): string | null {
  const value = request.headers.get(name);
  return value && value.trim() !== "" ? value.trim() : null;
}

export function getRequestObservability(
  request: NextRequest,
  surface: ObservabilitySurface,
): RequestObservabilityContext {
  const existing = requestObservabilityCache.get(request);
  if (existing) {
    return existing;
  }

  const requestId =
    readHeader(request, REQUEST_ID_HEADER) ??
    readHeader(request, "x-correlation-id") ??
    crypto.randomUUID();

  const context = {
    requestId,
    surface,
  };

  requestObservabilityCache.set(request, context);
  return context;
}

export function createSyntheticObservability(
  surface: ObservabilitySurface,
): RequestObservabilityContext {
  return {
    requestId: crypto.randomUUID(),
    surface,
  };
}

export function applyRequestObservability<T>(
  response: NextResponse<T>,
  context: RequestObservabilityContext,
): NextResponse<T> {
  response.headers.set(REQUEST_ID_HEADER, context.requestId);
  response.headers.set(OBSERVABILITY_SURFACE_HEADER, context.surface);
  return response;
}

export function withObservabilityContext<T extends Record<string, unknown>>(
  context: RequestObservabilityContext,
  extra?: T,
): T & RequestObservabilityContext {
  return {
    requestId: context.requestId,
    surface: context.surface,
    ...(extra ?? ({} as T)),
  };
}
