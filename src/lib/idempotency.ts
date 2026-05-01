/**
 * Idempotency Key Management
 *
 * 提供幂等键支持，防止重复请求导致的重复处理
 *
 * Security properties:
 * - TOCTOU protection: atomic SETNX via IdempotencyStore.setIfNotExists()
 * - Key semantic binding: key fingerprinted to {method}:{pathname}
 * - Persistence: results stored in IdempotencyStore (survives hot-cache clear)
 *
 * 使用方式：
 * 1. 客户端在请求头中添加 Idempotency-Key
 * 2. 服务端使用 withIdempotency 包装处理函数
 * 3. 重复请求会返回缓存的结果
 */

import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { API_ERROR_CODES } from "@/constants/api-error-codes";
import { createApiErrorResponse } from "@/lib/api/api-response";
import { HTTP_BAD_REQUEST, HTTP_SERVICE_UNAVAILABLE } from "@/constants";
import {
  type IdempotencyStore,
  createIdempotencyStore,
} from "@/lib/security/stores/idempotency-store";
import {
  waitForCompletion,
  normalizeHandlerResult,
  waitForCompletionResult,
  DEFAULT_TTL_MS,
} from "@/lib/idempotency-utils";
import {
  claimIdempotentResultKey,
  clearAllIdempotentResultKeys,
  clearIdempotentResultKey,
  completeIdempotentResultWork,
  getIdempotentResultCacheStats,
  getInFlightIdempotentResult,
  getRequiredMissingResult,
  getStoredIdempotentResult,
} from "@/lib/idempotency-result-utils";
import {
  checkInFlight,
  clearAllRequestIdempotencyKeys,
  clearRequestIdempotencyKey,
  getRequestIdempotencyCacheStats,
  registerInFlight,
  setInFlightFingerprint,
} from "@/lib/idempotency-runtime-cache";

const HTTP_CONFLICT = 409;

/** Singleton store — persists across clearAllIdempotencyKeys() calls */
let idempotencyStore: IdempotencyStore | null = null;

function getIdempotencyStore(): IdempotencyStore {
  if (!idempotencyStore) {
    idempotencyStore = createIdempotencyStore();
  }
  return idempotencyStore;
}

/** Maximum allowed length for an Idempotency-Key header (prevents memory abuse) */
const MAX_IDEMPOTENCY_KEY_LENGTH = 256;

/**
 * 从请求中提取幂等键
 * Rejects keys exceeding MAX_IDEMPOTENCY_KEY_LENGTH to prevent memory exhaustion.
 */
export function getIdempotencyKey(request: NextRequest): string | null {
  const key = request.headers.get("Idempotency-Key");
  if (key && key.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
    logger.warn("Idempotency-Key exceeds max length, treating as missing", {
      keyLength: key.length,
    });
    return null;
  }
  return key;
}

/**
 * Build the semantic fingerprint for a request (method + pathname).
 * The same raw idempotency key used for a different endpoint is rejected.
 */
export function createRequestFingerprint(
  request: NextRequest,
  bodyHash?: string,
): string {
  const { pathname } = new URL(request.url);
  const baseFingerprint = `${request.method}:${pathname}`;
  return bodyHash ? `${baseFingerprint}:${bodyHash}` : baseFingerprint;
}

/**
 * Handle requests that have an Idempotency-Key header.
 *
 * State machine:
 *   - Key absent → SETNX PENDING (winner runs handler) or wait for COMPLETED
 *   - Fingerprint mismatch → 409 Conflict
 *   - COMPLETED → return cached result
 */
interface IdempotencyHandlerContext {
  fingerprint: string;
  ttlMs: number;
}

/**
 * CONTEXT INTERFACES: Consolidate parameters for helper functions
 * Reduces parameter count from 4 to 3, enabling ESLint compliance
 */
interface ExistingEntryContext {
  fingerprint: string;
  store: IdempotencyStore;
}

/**
 * Handle the case where an existing entry is found (stored or in-flight).
 *
 * FIXED: Changed from `async (4 params)` to `sync (3 params + context)`
 * - Removed `async` keyword (no actual `await` in body — waitForCompletion is not awaited)
 * - Consolidated `fingerprint` and `store` into `context` parameter
 * - Return type: `NextResponse | Promise<NextResponse> | null` (can return Promise from waitForCompletion)
 * - Null-check moved to caller; all accesses to `existing` here are type-safe
 * - FIXED: Added NonNullable<> wrapper to parameter type to eliminate TypeScript null-narrowing error
 */
function handleExistingEntry(
  idempotencyKey: string,
  existing: NonNullable<Awaited<ReturnType<IdempotencyStore["get"]>>>,
  context: ExistingEntryContext,
): NextResponse | Promise<NextResponse> {
  const { fingerprint, store } = context;

  if (existing.status !== "pending" && existing.fingerprint !== fingerprint) {
    return NextResponse.json(
      {
        success: false,
        errorCode: API_ERROR_CODES.IDEMPOTENCY_KEY_REUSED,
      },
      { status: HTTP_CONFLICT },
    );
  }

  if (existing.status === "success") {
    return NextResponse.json(existing.response);
  }

  if (existing.status === "error") {
    return createApiErrorResponse(
      API_ERROR_CODES.IDEMPOTENCY_REQUEST_FAILED,
      HTTP_SERVICE_UNAVAILABLE,
    );
  }

  // Status is "pending" — wait for completion (this is a Promise, not awaited by caller)
  return waitForCompletion(idempotencyKey, store);
}

/**
 * Atomic claim: if no entry exists, create PENDING entry; otherwise return false.
 *
 * FIXED: Consolidate parameters from 4 to 3 via context object
 * - Consolidated `ttlMs` and `store` into `context` parameter
 * - Kept `async` keyword (contains actual `await` in body)
 */
async function claimIdempotencyKeyAtomic(
  idempotencyKey: string,
  fingerprint: string,
  context: { store: IdempotencyStore; ttlMs: number },
): Promise<boolean> {
  const { store, ttlMs } = context;
  const now = Date.now();
  const claimed = await store.setIfNotExists(
    idempotencyKey,
    {
      status: "pending",
      fingerprint,
      createdAt: now,
      expiresAt: now + ttlMs,
    },
    ttlMs,
  );
  if (claimed) {
    setInFlightFingerprint(idempotencyKey, fingerprint);
  }
  return claimed;
}

/**
 * Main handler: route requests with idempotency key through state machine
 */
async function handleWithIdempotencyKey<T>(
  idempotencyKey: string,
  handler: () => Promise<T>,
  context: IdempotencyHandlerContext,
): Promise<NextResponse> {
  const { fingerprint, ttlMs } = context;
  const store = getIdempotencyStore();

  // Fast path: check in-flight cache
  const inFlightResponse = checkInFlight(idempotencyKey, fingerprint);
  if (inFlightResponse !== null) {
    return inFlightResponse;
  }

  // Check stored entry
  const existing = await store.get(idempotencyKey);
  if (existing !== null) {
    return handleExistingEntry(idempotencyKey, existing, {
      fingerprint,
      store,
    });
  }

  // Attempt to claim the key (atomic SETNX)
  // FIXED: Call site 2 — KEEP `await`, PASS context object
  const claimed = await claimIdempotencyKeyAtomic(idempotencyKey, fingerprint, {
    store,
    ttlMs,
  });

  if (!claimed) {
    // Lost the race — wait for the winner's result
    return waitForCompletion(idempotencyKey, store);
  }

  // We own the key — run the handler
  const now = Date.now();
  const work = (async (): Promise<NextResponse> => {
    try {
      const result = await handler();

      if (result instanceof NextResponse) {
        // Don't cache responses where the handler returns a NextResponse directly
        // (both 2xx and non-2xx). For idempotency caching, handlers must return
        // a plain serializable object instead of a NextResponse.
        try {
          await store.delete(idempotencyKey);
        } catch (deleteError) {
          logger.warn("Failed to delete non-cached idempotency key", {
            deleteError,
            idempotencyKey,
          });
        }
        return result;
      }

      const normalized = normalizeHandlerResult(result);

      // PENDING → COMPLETED transition.
      // Important: never delete a claimed key after the handler has finished, even
      // if the store write fails — failing closed avoids duplicate-write risk.
      try {
        await store.set(
          idempotencyKey,
          {
            status: "success",
            fingerprint,
            response: normalized.body,
            createdAt: now,
            expiresAt: now + ttlMs,
          },
          ttlMs,
        );
      } catch (completeError) {
        logger.error(
          "Failed to persist COMPLETED idempotency result — key remains PENDING until TTL expires",
          { completeError, idempotencyKey },
        );
      }

      return NextResponse.json(normalized.body, {
        status: normalized.statusCode,
      });
    } catch (error) {
      logger.error("Request handler failed", {
        error: error as Error,
        idempotencyKey,
      });
      // Delete the PENDING key so the next request can retry.
      // Isolated try/catch so a store failure does not mask the original error.
      try {
        await store.delete(idempotencyKey);
      } catch (deleteError) {
        logger.error(
          "Failed to delete PENDING idempotency key after handler failure — key stuck until TTL expires",
          { deleteError, idempotencyKey },
        );
      }
      throw error;
    } finally {
      clearRequestIdempotencyKey(idempotencyKey);
    }
  })();

  registerInFlight(idempotencyKey, fingerprint, work);

  return work;
}

/**
 * Handle requests without an idempotency key (no caching, just wrap handler)
 */
async function handleWithoutIdempotencyKey<T>(
  handler: () => Promise<T>,
): Promise<NextResponse> {
  try {
    const result = await handler();
    if (result instanceof NextResponse) {
      return result;
    }
    const normalized = normalizeHandlerResult(result);
    return NextResponse.json(normalized.body, {
      status: normalized.statusCode,
    });
  } catch (error) {
    logger.error("Request handler failed", { error: error as Error });
    throw error;
  }
}

type IdempotentResultReason = "missing" | "reused" | "timeout" | "failed";

export type IdempotentResult<T> =
  | { ok: true; result: T; cached?: boolean }
  | { ok: false; reason: IdempotentResultReason };

function resolveIdempotentResultTtl(ttl?: number): number {
  return typeof ttl === "number" && ttl > 0 ? ttl : DEFAULT_TTL_MS;
}

export async function withIdempotentResult<T>(
  idempotencyKey: string | null,
  handler: () => Promise<T>,
  options: {
    fingerprint: string;
    required?: boolean;
    ttl?: number;
  },
): Promise<IdempotentResult<T>> {
  const { fingerprint, required = false } = options;
  const ttlMs = resolveIdempotentResultTtl(options.ttl);
  const missingKeyResult = getRequiredMissingResult<T>(
    required,
    idempotencyKey,
  );
  if (missingKeyResult) return missingKeyResult;

  if (!idempotencyKey) {
    try {
      return { ok: true, result: await handler() };
    } catch {
      return { ok: false, reason: "failed" };
    }
  }

  const inFlightResult = await getInFlightIdempotentResult<T>(
    idempotencyKey,
    fingerprint,
  );
  if (inFlightResult) return inFlightResult;

  const store = getIdempotencyStore();
  const storedResult = await getStoredIdempotentResult<T>(
    idempotencyKey,
    fingerprint,
    store,
  );
  if (storedResult) return storedResult;

  const claimed = await claimIdempotentResultKey(idempotencyKey, {
    fingerprint,
    ttlMs,
    store,
  });

  if (!claimed) {
    return waitForCompletionResult<T>(idempotencyKey, store);
  }

  try {
    return {
      ok: true,
      result: await completeIdempotentResultWork(idempotencyKey, {
        fingerprint,
        handler,
        store,
      }),
    };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

/**
 * 幂等键中间件
 *
 * 核心行为：
 * - 当请求携带 Idempotency-Key 时：
 *   - 首次请求：原子 SETNX PENDING → 执行 handler → COMPLETED（成功）或删除（失败）
 *   - 重复请求：命中缓存 → 按缓存结果直接返回
 *   - 并发重复请求：等待首次请求完成后返回缓存结果（TOCTOU 保护）
 *   - 跨端点复用：409 Conflict（key 语义绑定）
 * - 当请求未携带 Idempotency-Key 时：直接执行 handler
 */
// eslint-disable-next-line require-await -- Returns Promise for API consistency
export async function withIdempotency<T>(
  request: NextRequest,
  handler: () => Promise<T>,
  options: {
    required?: boolean;
    ttl?: number;
    fingerprint?: string;
  } = {},
): Promise<NextResponse> {
  const { required = false } = options;
  const idempotencyKey = getIdempotencyKey(request);
  const ttlMs = resolveIdempotentResultTtl(options.ttl);

  if (required && !idempotencyKey) {
    logger.warn("Missing required Idempotency-Key header");
    return NextResponse.json(
      {
        success: false,
        errorCode: API_ERROR_CODES.IDEMPOTENCY_KEY_REQUIRED,
      },
      { status: HTTP_BAD_REQUEST },
    );
  }

  return idempotencyKey
    ? handleWithIdempotencyKey(idempotencyKey, handler, {
        fingerprint: options.fingerprint ?? createRequestFingerprint(request),
        ttlMs,
      })
    : handleWithoutIdempotencyKey(handler);
}

/**
 * 生成幂等键（客户端使用）
 */
export { generateIdempotencyKey } from "@/lib/idempotency-key";

/**
 * 清除指定幂等键（用于测试或手动清理）
 */
export function clearIdempotencyKey(key: string): void {
  clearRequestIdempotencyKey(key);
  clearIdempotentResultKey(key);
}

/**
 * 清除所有幂等键热缓存（用于测试）
 * NOTE: Does NOT clear the IdempotencyStore — store persists to simulate
 * cross-process/restart persistence.
 */
export function clearAllIdempotencyKeys(): void {
  clearAllRequestIdempotencyKeys();
  clearAllIdempotentResultKeys();
}

/**
 * Reset the backing idempotency store and hot caches (testing only).
 */
export function resetIdempotencyState(): void {
  idempotencyStore = null;
  clearAllIdempotencyKeys();
}

/**
 * 获取缓存统计信息
 */
export function getIdempotencyCacheStats() {
  const requestStats = getRequestIdempotencyCacheStats();
  const resultStats = getIdempotentResultCacheStats();

  return {
    size: requestStats.size + resultStats.size,
    keys: Array.from(new Set([...requestStats.keys, ...resultStats.keys])),
  };
}
