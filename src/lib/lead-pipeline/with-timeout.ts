/**
 * Promise timeout helper for the lead pipeline.
 *
 * Keep it dependency-free (no metrics/logger imports) so it can be reused
 * without creating new coupling.
 */

export const OPERATION_TIMEOUT_MS = 10000; // 10 seconds

export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName: string,
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(
      () =>
        reject(new Error(`${operationName} timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );
  });

  return Promise.race([promise, timeoutPromise]);
}
