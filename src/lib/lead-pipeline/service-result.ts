/**
 * Shared result types for lead pipeline service operations.
 *
 * Uses discriminated union pattern to prevent invalid states:
 * - Success: has id (optional), no error
 * - Failure: has error, no id
 */

/**
 * Successful service operation result
 */
export interface ServiceSuccess {
  readonly success: true;
  readonly id?: string | undefined;
  readonly latencyMs: number;
}

/**
 * Failed service operation result
 */
export interface ServiceFailure {
  readonly success: false;
  readonly error: Error;
  readonly latencyMs: number;
}

/**
 * Discriminated union of service operation results.
 * Use type guards (isServiceSuccess/isServiceFailure) for narrowing.
 */
export type ServiceResult = ServiceSuccess | ServiceFailure;

export const DEFAULT_LATENCY = 0;

/**
 * Create a successful service result
 */
export function createSuccess(
  id: string | undefined,
  latencyMs: number,
): ServiceSuccess {
  return { success: true, id, latencyMs };
}

/**
 * Create a failed service result
 */
export function createFailure(error: Error, latencyMs: number): ServiceFailure {
  return { success: false, error, latencyMs };
}

/**
 * Type guard for success result
 */
export function isServiceSuccess(
  result: ServiceResult,
): result is ServiceSuccess {
  return result.success === true;
}

/**
 * Type guard for failure result
 */
export function isServiceFailure(
  result: ServiceResult,
): result is ServiceFailure {
  return result.success === false;
}
