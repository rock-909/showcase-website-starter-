/**
 * Lightweight async retry helper for the lead pipeline.
 *
 * Keep it dependency-free (no metrics/logger imports) so it can be reused
 * without creating new coupling.
 */

import { MILLISECONDS_PER_SECOND } from "@/constants/time";

interface RetryOptions {
  /** Maximum number of retries after the initial attempt (default: 2) */
  readonly maxRetries: number;
  /** Base delay in milliseconds for exponential backoff (default: 1000) */
  readonly baseDelayMs?: number;
}

const DEFAULT_BASE_DELAY_MS = MILLISECONDS_PER_SECOND;

/**
 * Delay execution using setTimeout (compatible with fake timers in tests).
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Retry an async operation with exponential backoff.
 *
 * @param fn - The async function to retry
 * @param options - Retry configuration
 * @returns The result of the first successful attempt
 * @throws The error from the last failed attempt if all retries are exhausted
 */
export async function retryAsync<T>(
  fn: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const { maxRetries, baseDelayMs = DEFAULT_BASE_DELAY_MS } = options;
  let lastError!: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxRetries) {
        throw lastError;
      }

      // Exponential backoff: baseDelay * 2^attempt
      const backoffMs = baseDelayMs * 2 ** attempt;
      await delay(backoffMs);
    }
  }

  throw lastError;
}
