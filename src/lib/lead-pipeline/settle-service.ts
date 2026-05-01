import { createLatencyTimer } from "@/lib/lead-pipeline/metrics";
import {
  createFailure,
  createSuccess,
  type ServiceResult,
} from "@/lib/lead-pipeline/service-result";
import {
  OPERATION_TIMEOUT_MS,
  withTimeout,
} from "@/lib/lead-pipeline/with-timeout";

interface SettleServiceOptions<T> {
  operationName: string;
  timeoutMs?: number | undefined;
  mapId?: ((result: T) => string | undefined) | undefined;
}

function normalizeError(error: unknown): Error {
  if (error instanceof Error) return error;
  return new Error(String(error));
}

export async function settleService<T>(
  promise: Promise<T>,
  options: SettleServiceOptions<T>,
): Promise<ServiceResult> {
  const timer = createLatencyTimer();
  const timeoutMs = options.timeoutMs ?? OPERATION_TIMEOUT_MS;

  try {
    const result = await withTimeout(promise, timeoutMs, options.operationName);
    const id = options.mapId ? options.mapId(result) : undefined;
    return createSuccess(id, timer.stop());
  } catch (error) {
    return createFailure(normalizeError(error), timer.stop());
  }
}
