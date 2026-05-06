/**
 * Promise timeout helper for the lead pipeline.
 *
 * Keep it dependency-free (no metrics/logger imports) so it can be reused
 * without creating new coupling.
 */

export const OPERATION_TIMEOUT_MS = 10000; // 10 seconds

export class OperationTimeoutError extends Error {
  readonly operationName: string;
  readonly timeoutMs: number;

  constructor(operationName: string, timeoutMs: number) {
    super(`${operationName} timed out after ${timeoutMs}ms`);
    this.name = "OperationTimeoutError";
    this.operationName = operationName;
    this.timeoutMs = timeoutMs;
  }
}

export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName: string,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new OperationTimeoutError(operationName, timeoutMs)),
      timeoutMs,
    );
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
  });
}
