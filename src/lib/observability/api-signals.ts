import type { RequestObservabilityContext } from "@/lib/api/request-observability";
import {
  createSystemSignal,
  recordSystemSignal,
  type ObservabilityOutcome,
} from "@/lib/observability/system-observability";

interface ApiSignalOptions {
  context: RequestObservabilityContext;
  name: string;
  route: string;
  outcome: ObservabilityOutcome;
  statusCode: number;
  errorCode?: string;
  latencyMs?: number;
  meta?: Record<string, unknown>;
}

export function recordApiSignal(options: ApiSignalOptions): void {
  const {
    context,
    name,
    route,
    outcome,
    statusCode,
    errorCode,
    latencyMs,
    meta,
  } = options;

  recordSystemSignal(
    createSystemSignal({
      kind: "api_request",
      surface: context.surface,
      name,
      outcome,
      requestId: context.requestId,
      route,
      statusCode,
      ...(errorCode !== undefined ? { errorCode } : {}),
      ...(latencyMs !== undefined ? { latencyMs } : {}),
      ...(meta !== undefined ? { meta } : {}),
    }),
  );
}

interface ApiResponseSignalOptions {
  context: RequestObservabilityContext;
  response: Response;
  name: string;
  route: string;
  latencyMs?: number;
  meta?: Record<string, unknown>;
}

export async function recordApiResponseSignal(
  options: ApiResponseSignalOptions,
): Promise<void> {
  const { context, response, name, route, latencyMs, meta } = options;
  let errorCode: string | undefined;
  let outcome: ObservabilityOutcome = response.ok ? "success" : "failure";

  try {
    const body = await response.clone().json();
    if (
      typeof body === "object" &&
      body !== null &&
      "errorCode" in body &&
      typeof body.errorCode === "string"
    ) {
      const { errorCode: parsedErrorCode } = body as { errorCode: string };
      errorCode = parsedErrorCode;
    }
    if (
      typeof body === "object" &&
      body !== null &&
      "success" in body &&
      body.success === false
    ) {
      outcome = "failure";
    }
  } catch {
    // Some responses may not have JSON bodies; keep status-based outcome.
  }

  recordApiSignal({
    context,
    name,
    route,
    outcome,
    statusCode: response.status,
    ...(errorCode !== undefined ? { errorCode } : {}),
    ...(latencyMs !== undefined ? { latencyMs } : {}),
    ...(meta !== undefined ? { meta } : {}),
  });
}
