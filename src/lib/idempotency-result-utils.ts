/**
 * Idempotent Result Helper Functions
 *
 * Extracted from src/lib/idempotency.ts to reduce main file size while
 * preserving all idempotent result logic (caching, claiming, persistence).
 */

import { logger } from "@/lib/logger";
import {
  DEFAULT_TTL_MS,
  type IdempotentResult,
  waitForCompletionResult,
} from "@/lib/idempotency-utils";
import type { IdempotencyStore } from "@/lib/security/stores/idempotency-store";

const inFlightFingerprints = new Map<string, string>();
const pendingResults = new Map<string, Promise<unknown>>();
const MAX_IN_FLIGHT_ENTRIES = 1000;

export function getRequiredMissingResult<T>(
  required: boolean,
  idempotencyKey: string | null,
): IdempotentResult<T> | null {
  if (!required || idempotencyKey) {
    return null;
  }

  logger.warn("Missing required idempotency key");
  return { ok: false, reason: "missing" };
}

export async function getInFlightIdempotentResult<T>(
  idempotencyKey: string,
  fingerprint: string,
): Promise<IdempotentResult<T> | null> {
  const inFlight = pendingResults.get(idempotencyKey);
  if (!inFlight) {
    return null;
  }

  const existingFingerprint = inFlightFingerprints.get(idempotencyKey);
  if (existingFingerprint && existingFingerprint !== fingerprint) {
    return { ok: false, reason: "reused" };
  }

  try {
    return { ok: true, result: (await inFlight) as T, cached: true };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

export async function getStoredIdempotentResult<T>(
  idempotencyKey: string,
  fingerprint: string,
  store: IdempotencyStore,
): Promise<IdempotentResult<T> | null> {
  const existing = await store.get(idempotencyKey);
  if (!existing) {
    return null;
  }

  if (existing.status !== "pending" && existing.fingerprint !== fingerprint) {
    return { ok: false, reason: "reused" };
  }

  if (existing.status === "success") {
    return { ok: true, result: existing.response as T, cached: true };
  }

  if (existing.status === "error") {
    return { ok: false, reason: "failed" };
  }

  return waitForCompletionResult<T>(idempotencyKey, store);
}

export function claimIdempotentResultKey(
  idempotencyKey: string,
  context: {
    fingerprint: string;
    ttlMs: number;
    store: IdempotencyStore;
  },
): Promise<boolean> {
  const { fingerprint, ttlMs, store } = context;
  const now = Date.now();
  return store
    .setIfNotExists(
      idempotencyKey,
      {
        status: "pending",
        fingerprint,
        createdAt: now,
        expiresAt: now + ttlMs,
      },
      ttlMs,
    )
    .then((claimed) => claimed);
}

export function completeIdempotentResultWork<T>(
  idempotencyKey: string,
  context: {
    fingerprint: string;
    handler: () => Promise<T>;
    ttlMs?: number;
    store: IdempotencyStore;
  },
): Promise<T> {
  const { fingerprint, handler, store } = context;
  const completedTtlMs = context.ttlMs ?? DEFAULT_TTL_MS;
  const work = (async (): Promise<T> => {
    let result: T;
    const now = Date.now();
    try {
      result = await handler();
    } catch (error) {
      try {
        await store.delete(idempotencyKey);
      } catch (deleteError) {
        logger.error(
          "Failed to delete PENDING idempotency key after result failure",
          { deleteError, idempotencyKey },
        );
      }
      throw error;
    } finally {
      pendingResults.delete(idempotencyKey);
      inFlightFingerprints.delete(idempotencyKey);
    }

    try {
      await store.set(
        idempotencyKey,
        {
          status: "success",
          fingerprint,
          response: result,
          createdAt: now,
          expiresAt: now + completedTtlMs,
        },
        completedTtlMs,
      );
    } catch (completeError) {
      logger.error(
        "Failed to persist COMPLETED idempotency result — key remains PENDING until TTL expires",
        { completeError, idempotencyKey },
      );
    }

    return result;
  })();

  if (pendingResults.size < MAX_IN_FLIGHT_ENTRIES) {
    pendingResults.set(idempotencyKey, work as Promise<unknown>);
    inFlightFingerprints.set(idempotencyKey, fingerprint);
  }

  return work;
}

export function clearIdempotentResultKey(key: string): void {
  pendingResults.delete(key);
  inFlightFingerprints.delete(key);
}

export function clearAllIdempotentResultKeys(): void {
  pendingResults.clear();
  inFlightFingerprints.clear();
}

export function getIdempotentResultCacheStats() {
  return {
    size: pendingResults.size,
    keys: Array.from(new Set(pendingResults.keys())),
  };
}
