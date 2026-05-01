import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  HTTP_BAD_REQUEST,
  HTTP_OK,
  HTTP_SERVICE_UNAVAILABLE,
} from "@/constants";
import { API_ERROR_CODES } from "@/constants/api-error-codes";

const mocks = vi.hoisted(() => {
  const mockStore = {
    delete: vi.fn<() => Promise<void>>(),
    get: vi.fn<() => Promise<unknown>>(),
    set: vi.fn<() => Promise<void>>(),
    setIfNotExists: vi.fn<() => Promise<boolean>>(),
  };

  return {
    mockCheckInFlight: vi.fn(),
    mockClaimIdempotentResultKey: vi.fn(),
    mockClearAllIdempotentResultKeys: vi.fn(),
    mockClearAllRequestIdempotencyKeys: vi.fn(),
    mockClearIdempotentResultKey: vi.fn(),
    mockClearRequestIdempotencyKey: vi.fn(),
    mockCompleteIdempotentResultWork: vi.fn(),
    mockCreateApiErrorResponse: vi.fn(),
    mockCreateIdempotencyStore: vi.fn(() => mockStore),
    mockGetIdempotentResultCacheStats: vi.fn(),
    mockGetInFlightIdempotentResult: vi.fn(),
    mockGetRequestIdempotencyCacheStats: vi.fn(),
    mockGetRequiredMissingResult: vi.fn(),
    mockGetStoredIdempotentResult: vi.fn(),
    mockLoggerError: vi.fn(),
    mockLoggerWarn: vi.fn(),
    mockNormalizeHandlerResult: vi.fn(),
    mockDefaultTtlMs: 24 * 60 * 60 * 1000,
    mockRegisterInFlight: vi.fn(),
    mockSetInFlightFingerprint: vi.fn(),
    mockStore,
    mockWaitForCompletion: vi.fn(),
    mockWaitForCompletionResult: vi.fn(),
  };
});

vi.mock("@/lib/logger", () => ({
  logger: {
    debug: vi.fn(),
    error: mocks.mockLoggerError,
    info: vi.fn(),
    warn: mocks.mockLoggerWarn,
  },
}));

vi.mock("@/lib/security/stores/idempotency-store", () => ({
  createIdempotencyStore: mocks.mockCreateIdempotencyStore,
}));

vi.mock("@/lib/idempotency-utils", () => ({
  DEFAULT_TTL_MS: mocks.mockDefaultTtlMs,
  normalizeHandlerResult: mocks.mockNormalizeHandlerResult,
  waitForCompletion: mocks.mockWaitForCompletion,
  waitForCompletionResult: mocks.mockWaitForCompletionResult,
}));

vi.mock("@/lib/idempotency-result-utils", () => ({
  claimIdempotentResultKey: mocks.mockClaimIdempotentResultKey,
  clearAllIdempotentResultKeys: mocks.mockClearAllIdempotentResultKeys,
  clearIdempotentResultKey: mocks.mockClearIdempotentResultKey,
  completeIdempotentResultWork: mocks.mockCompleteIdempotentResultWork,
  getIdempotentResultCacheStats: mocks.mockGetIdempotentResultCacheStats,
  getInFlightIdempotentResult: mocks.mockGetInFlightIdempotentResult,
  getRequiredMissingResult: mocks.mockGetRequiredMissingResult,
  getStoredIdempotentResult: mocks.mockGetStoredIdempotentResult,
}));

vi.mock("@/lib/idempotency-runtime-cache", () => ({
  checkInFlight: mocks.mockCheckInFlight,
  clearAllRequestIdempotencyKeys: mocks.mockClearAllRequestIdempotencyKeys,
  clearRequestIdempotencyKey: mocks.mockClearRequestIdempotencyKey,
  getRequestIdempotencyCacheStats: mocks.mockGetRequestIdempotencyCacheStats,
  registerInFlight: mocks.mockRegisterInFlight,
  setInFlightFingerprint: mocks.mockSetInFlightFingerprint,
}));

vi.mock("@/lib/api/api-response", () => ({
  createApiErrorResponse: mocks.mockCreateApiErrorResponse,
}));

import {
  clearAllIdempotencyKeys,
  clearIdempotencyKey,
  getIdempotencyCacheStats,
  getIdempotencyKey,
  resetIdempotencyState,
  withIdempotency,
  withIdempotentResult,
} from "../idempotency";

function createRequest(
  method = "POST",
  path = "/api/inquiry",
  idempotencyKey?: string,
): NextRequest {
  const headers = new Headers();

  if (idempotencyKey) {
    headers.set("Idempotency-Key", idempotencyKey);
  }

  return new NextRequest(`http://localhost:3000${path}`, {
    headers,
    method,
  });
}

describe("idempotency behavioral contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetIdempotencyState();

    mocks.mockStore.delete.mockResolvedValue(undefined);
    mocks.mockStore.get.mockResolvedValue(null);
    mocks.mockStore.set.mockResolvedValue(undefined);
    mocks.mockStore.setIfNotExists.mockResolvedValue(true);

    mocks.mockCheckInFlight.mockReturnValue(null);
    mocks.mockWaitForCompletion.mockResolvedValue(
      NextResponse.json({ waited: true }),
    );
    mocks.mockNormalizeHandlerResult.mockImplementation((result: unknown) => {
      if (
        result &&
        typeof result === "object" &&
        !Array.isArray(result) &&
        Object.hasOwn(result, "statusCode") &&
        typeof (result as { statusCode?: unknown }).statusCode === "number"
      ) {
        const record = result as Record<string, unknown>;
        const { statusCode, ...body } = record;
        return { body, statusCode: statusCode as number };
      }

      return { body: result, statusCode: HTTP_OK };
    });
    mocks.mockWaitForCompletionResult.mockResolvedValue({
      ok: false,
      reason: "timeout",
    });
    mocks.mockCreateApiErrorResponse.mockImplementation(
      (errorCode: string, status: number) =>
        NextResponse.json(
          {
            errorCode,
            success: false,
          },
          { status },
        ),
    );

    mocks.mockGetRequiredMissingResult.mockReturnValue(null);
    mocks.mockGetInFlightIdempotentResult.mockResolvedValue(null);
    mocks.mockGetStoredIdempotentResult.mockResolvedValue(null);
    mocks.mockClaimIdempotentResultKey.mockResolvedValue(true);
    mocks.mockCompleteIdempotentResultWork.mockImplementation(
      async (_key: string, context: { handler: () => Promise<unknown> }) =>
        context.handler(),
    );

    mocks.mockGetRequestIdempotencyCacheStats.mockReturnValue({
      keys: [],
      size: 0,
    });
    mocks.mockGetIdempotentResultCacheStats.mockReturnValue({
      keys: [],
      size: 0,
    });
  });

  it("accepts a max-length key and rejects longer values with explicit warning metadata", () => {
    const maxLengthKey = "k".repeat(256);
    const overlongKey = "k".repeat(257);

    expect(
      getIdempotencyKey(createRequest("POST", "/api/inquiry", maxLengthKey)),
    ).toBe(maxLengthKey);
    expect(
      getIdempotencyKey(createRequest("POST", "/api/inquiry", overlongKey)),
    ).toBeNull();
    expect(mocks.mockLoggerWarn).toHaveBeenCalledWith(
      "Idempotency-Key exceeds max length, treating as missing",
      { keyLength: 257 },
    );
  });

  it("returns in-flight responses immediately before touching the store", async () => {
    const inFlightResponse = NextResponse.json({ cached: "in-flight" });
    mocks.mockCheckInFlight.mockReturnValue(inFlightResponse);

    const response = await withIdempotency(
      createRequest("POST", "/api/inquiry", "in-flight-key"),
      async () => ({ shouldNotRun: true }),
      { fingerprint: "POST:/api/inquiry" },
    );

    expect(response).toBe(inFlightResponse);
    expect(mocks.mockStore.get).not.toHaveBeenCalled();
  });

  it("rejects reused keys when a settled entry has a different fingerprint", async () => {
    mocks.mockStore.get.mockResolvedValue({
      createdAt: 1,
      expiresAt: 2,
      fingerprint: "POST:/api/subscribe",
      response: { cached: true },
      status: "success",
    });

    const response = await withIdempotency(
      createRequest("POST", "/api/inquiry", "reused-key"),
      async () => ({ shouldNotRun: true }),
      { fingerprint: "POST:/api/inquiry" },
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      errorCode: API_ERROR_CODES.IDEMPOTENCY_KEY_REUSED,
      success: false,
    });
    expect(mocks.mockStore.setIfNotExists).not.toHaveBeenCalled();
  });

  it("replays stored success responses with HTTP 200", async () => {
    mocks.mockStore.get.mockResolvedValue({
      createdAt: 1,
      expiresAt: 2,
      fingerprint: "POST:/api/inquiry",
      response: { cached: true, source: "store" },
      status: "success",
    });

    const response = await withIdempotency(
      createRequest("POST", "/api/inquiry", "cached-key"),
      async () => ({ shouldNotRun: true }),
      { fingerprint: "POST:/api/inquiry" },
    );

    expect(response.status).toBe(HTTP_OK);
    expect(await response.json()).toEqual({ cached: true, source: "store" });
  });

  it("fails closed when an existing entry already settled as error", async () => {
    mocks.mockStore.get.mockResolvedValue({
      createdAt: 1,
      error: "boom",
      expiresAt: 2,
      fingerprint: "POST:/api/inquiry",
      status: "error",
    });

    const response = await withIdempotency(
      createRequest("POST", "/api/inquiry", "failed-key"),
      async () => ({ shouldNotRun: true }),
      { fingerprint: "POST:/api/inquiry" },
    );

    expect(mocks.mockCreateApiErrorResponse).toHaveBeenCalledWith(
      API_ERROR_CODES.IDEMPOTENCY_REQUEST_FAILED,
      HTTP_SERVICE_UNAVAILABLE,
    );
    expect(response.status).toBe(HTTP_SERVICE_UNAVAILABLE);
    expect(await response.json()).toEqual({
      errorCode: API_ERROR_CODES.IDEMPOTENCY_REQUEST_FAILED,
      success: false,
    });
  });

  it("waits for completion when the store only contains a pending entry", async () => {
    mocks.mockStore.get.mockResolvedValue({
      createdAt: 1,
      expiresAt: 2,
      fingerprint: "POST:/api/inquiry",
      status: "pending",
    });

    const response = await withIdempotency(
      createRequest("POST", "/api/inquiry", "pending-key"),
      async () => ({ shouldNotRun: true }),
      { fingerprint: "POST:/api/inquiry" },
    );

    expect(mocks.mockWaitForCompletion).toHaveBeenCalledWith(
      "pending-key",
      mocks.mockStore,
    );
    expect(await response.json()).toEqual({ waited: true });
  });

  it("does not reject a pending entry solely because the in-flight fingerprint differs", async () => {
    mocks.mockStore.get.mockResolvedValue({
      createdAt: 1,
      expiresAt: 2,
      fingerprint: "POST:/api/subscribe",
      status: "pending",
    });

    const response = await withIdempotency(
      createRequest("POST", "/api/inquiry", "pending-mismatch-key"),
      async () => ({ shouldNotRun: true }),
      { fingerprint: "POST:/api/inquiry" },
    );

    expect(response.status).toBe(HTTP_OK);
    expect(await response.json()).toEqual({ waited: true });
    expect(mocks.mockWaitForCompletion).toHaveBeenCalledWith(
      "pending-mismatch-key",
      mocks.mockStore,
    );
  });

  it("claims a missing key with a pending entry, uses explicit ttl, and persists normalized results", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_000);
    mocks.mockNormalizeHandlerResult.mockReturnValue({
      body: { ok: true },
      statusCode: 201,
    });

    const response = await withIdempotency(
      createRequest("POST", "/api/inquiry", "fresh-key"),
      async () => ({ ok: true, raw: true }),
      {
        fingerprint: "POST:/api/inquiry",
        ttl: 1_234,
      },
    );

    expect(mocks.mockStore.setIfNotExists).toHaveBeenCalledWith(
      "fresh-key",
      {
        createdAt: 1_000,
        expiresAt: 2_234,
        fingerprint: "POST:/api/inquiry",
        status: "pending",
      },
      1_234,
    );
    expect(mocks.mockSetInFlightFingerprint).toHaveBeenCalledWith(
      "fresh-key",
      "POST:/api/inquiry",
    );
    expect(mocks.mockRegisterInFlight).toHaveBeenCalledWith(
      "fresh-key",
      "POST:/api/inquiry",
      expect.any(Promise),
    );
    expect(mocks.mockStore.set).toHaveBeenCalledWith(
      "fresh-key",
      {
        createdAt: 1_000,
        expiresAt: 2_234,
        fingerprint: "POST:/api/inquiry",
        response: { ok: true },
        status: "success",
      },
      1_234,
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("falls back to the default ttl when request ttl is non-positive", async () => {
    vi.spyOn(Date, "now").mockReturnValue(2_000);

    await withIdempotency(
      createRequest("POST", "/api/inquiry", "ttl-fallback-key"),
      async () => ({ ok: true }),
      {
        fingerprint: "POST:/api/inquiry",
        ttl: 0,
      },
    );

    expect(mocks.mockStore.setIfNotExists).toHaveBeenCalledWith(
      "ttl-fallback-key",
      expect.objectContaining({
        createdAt: 2_000,
        expiresAt: 2_000 + mocks.mockDefaultTtlMs,
      }),
      mocks.mockDefaultTtlMs,
    );
  });

  it("waits for completion after losing the atomic claim race", async () => {
    mocks.mockStore.setIfNotExists.mockResolvedValue(false);
    const handler = vi.fn(async () => ({ shouldNotRun: true }));

    const response = await withIdempotency(
      createRequest("POST", "/api/inquiry", "race-key"),
      handler,
      { fingerprint: "POST:/api/inquiry" },
    );

    expect(handler).not.toHaveBeenCalled();
    expect(mocks.mockSetInFlightFingerprint).not.toHaveBeenCalled();
    expect(mocks.mockWaitForCompletion).toHaveBeenCalledWith(
      "race-key",
      mocks.mockStore,
    );
    expect(await response.json()).toEqual({ waited: true });
  });

  it("passes through direct NextResponse results and warns if cleanup fails", async () => {
    const directResponse = NextResponse.json({ direct: true }, { status: 202 });
    const deleteError = new Error("delete failed");
    mocks.mockStore.delete.mockRejectedValue(deleteError);

    const response = await withIdempotency(
      createRequest("POST", "/api/inquiry", "direct-response-key"),
      async () => directResponse,
      { fingerprint: "POST:/api/inquiry" },
    );

    expect(response).toBe(directResponse);
    expect(mocks.mockStore.set).not.toHaveBeenCalled();
    expect(mocks.mockStore.delete).toHaveBeenCalledWith("direct-response-key");
    expect(mocks.mockLoggerWarn).toHaveBeenCalledWith(
      "Failed to delete non-cached idempotency key",
      {
        deleteError,
        idempotencyKey: "direct-response-key",
      },
    );
  });

  it("returns the normalized response even when persisting the completed result fails", async () => {
    const completeError = new Error("persist failed");
    mocks.mockStore.set.mockRejectedValue(completeError);
    mocks.mockNormalizeHandlerResult.mockReturnValue({
      body: { persisted: false },
      statusCode: 202,
    });

    const response = await withIdempotency(
      createRequest("POST", "/api/inquiry", "persist-key"),
      async () => ({ persisted: false }),
      { fingerprint: "POST:/api/inquiry" },
    );

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ persisted: false });
    expect(mocks.mockLoggerError).toHaveBeenCalledWith(
      "Failed to persist COMPLETED idempotency result — key remains PENDING until TTL expires",
      {
        completeError,
        idempotencyKey: "persist-key",
      },
    );
  });

  it("logs the handler failure, attempts cleanup, and preserves the original error", async () => {
    const handlerError = new Error("handler failed");
    const deleteError = new Error("cleanup failed");
    mocks.mockStore.delete.mockRejectedValue(deleteError);

    await expect(
      withIdempotency(
        createRequest("POST", "/api/inquiry", "failure-key"),
        async () => {
          throw handlerError;
        },
        { fingerprint: "POST:/api/inquiry" },
      ),
    ).rejects.toBe(handlerError);

    expect(mocks.mockLoggerError).toHaveBeenNthCalledWith(
      1,
      "Request handler failed",
      {
        error: handlerError,
        idempotencyKey: "failure-key",
      },
    );
    expect(mocks.mockStore.delete).toHaveBeenCalledWith("failure-key");
    expect(mocks.mockLoggerError).toHaveBeenNthCalledWith(
      2,
      "Failed to delete PENDING idempotency key after handler failure — key stuck until TTL expires",
      {
        deleteError,
        idempotencyKey: "failure-key",
      },
    );
    expect(mocks.mockClearRequestIdempotencyKey).toHaveBeenCalledWith(
      "failure-key",
    );
  });

  it("passes through direct NextResponse values when no idempotency key is provided", async () => {
    const directResponse = NextResponse.json({ direct: true }, { status: 207 });

    const response = await withIdempotency(
      createRequest("POST", "/api/inquiry"),
      async () => directResponse,
    );

    expect(response).toBe(directResponse);
    expect(mocks.mockNormalizeHandlerResult).not.toHaveBeenCalled();
  });

  it("logs and rethrows handler failures when no idempotency key is provided", async () => {
    const handlerError = new Error("no-key failure");

    await expect(
      withIdempotency(createRequest("POST", "/api/inquiry"), async () => {
        throw handlerError;
      }),
    ).rejects.toBe(handlerError);

    expect(mocks.mockLoggerError).toHaveBeenCalledWith(
      "Request handler failed",
      { error: handlerError },
    );
  });

  it("treats required as false by default and executes the handler when the key is missing", async () => {
    const handler = vi.fn(async () => ({ ok: true }));
    const result = await withIdempotentResult(null, handler, {
      fingerprint: "POST:/api/inquiry",
    });

    expect(mocks.mockGetRequiredMissingResult).toHaveBeenCalledWith(
      false,
      null,
    );
    expect(handler).toHaveBeenCalledTimes(1);
    expect(mocks.mockCreateIdempotencyStore).not.toHaveBeenCalled();
    expect(mocks.mockGetInFlightIdempotentResult).not.toHaveBeenCalled();
    expect(mocks.mockGetStoredIdempotentResult).not.toHaveBeenCalled();
    expect(mocks.mockClaimIdempotentResultKey).not.toHaveBeenCalled();
    expect(mocks.mockWaitForCompletionResult).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: true,
      result: { ok: true },
    });
  });

  it("returns failed when the missing-key result handler throws", async () => {
    const handler = vi.fn(async () => {
      throw new Error("result failed");
    });
    const result = await withIdempotentResult(null, handler, {
      fingerprint: "POST:/api/inquiry",
      required: false,
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(mocks.mockCreateIdempotencyStore).not.toHaveBeenCalled();
    expect(mocks.mockGetInFlightIdempotentResult).not.toHaveBeenCalled();
    expect(mocks.mockClaimIdempotentResultKey).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, reason: "failed" });
  });

  it("short-circuits to an in-flight idempotent result", async () => {
    mocks.mockGetInFlightIdempotentResult.mockResolvedValue({
      cached: true,
      ok: true,
      result: { from: "in-flight" },
    });

    const result = await withIdempotentResult(
      "in-flight-result-key",
      async () => ({ shouldNotRun: true }),
      { fingerprint: "POST:/api/inquiry" },
    );

    expect(result).toEqual({
      cached: true,
      ok: true,
      result: { from: "in-flight" },
    });
    expect(mocks.mockGetStoredIdempotentResult).not.toHaveBeenCalled();
  });

  it("uses the explicit idempotent-result ttl and falls back to the default when needed", async () => {
    mocks.mockClaimIdempotentResultKey.mockResolvedValue(false);

    await withIdempotentResult("explicit-ttl-key", async () => ({ ok: true }), {
      fingerprint: "POST:/api/inquiry",
      ttl: 321,
    });
    expect(mocks.mockClaimIdempotentResultKey).toHaveBeenLastCalledWith(
      "explicit-ttl-key",
      expect.objectContaining({
        fingerprint: "POST:/api/inquiry",
        store: mocks.mockStore,
        ttlMs: 321,
      }),
    );

    await withIdempotentResult("fallback-ttl-key", async () => ({ ok: true }), {
      fingerprint: "POST:/api/inquiry",
      ttl: 0,
    });
    expect(mocks.mockClaimIdempotentResultKey).toHaveBeenLastCalledWith(
      "fallback-ttl-key",
      expect.objectContaining({
        ttlMs: mocks.mockDefaultTtlMs,
      }),
    );
  });

  it("ignores non-number ttl values at runtime and falls back to the default ttl", async () => {
    mocks.mockClaimIdempotentResultKey.mockResolvedValue(false);

    await withIdempotentResult("runtime-ttl-key", async () => ({ ok: true }), {
      fingerprint: "POST:/api/inquiry",
      ttl: "300" as unknown as number,
    });

    expect(mocks.mockClaimIdempotentResultKey).toHaveBeenLastCalledWith(
      "runtime-ttl-key",
      expect.objectContaining({
        ttlMs: mocks.mockDefaultTtlMs,
      }),
    );
  });

  it("waits for completion results after losing the result-claim race", async () => {
    mocks.mockClaimIdempotentResultKey.mockResolvedValue(false);
    mocks.mockWaitForCompletionResult.mockResolvedValue({
      ok: false,
      reason: "timeout",
    });

    const result = await withIdempotentResult(
      "lost-result-claim",
      async () => ({ shouldNotRun: true }),
      { fingerprint: "POST:/api/inquiry" },
    );

    expect(result).toEqual({ ok: false, reason: "timeout" });
    expect(mocks.mockWaitForCompletionResult).toHaveBeenCalledWith(
      "lost-result-claim",
      mocks.mockStore,
    );
  });

  it("returns failed when completing the idempotent result work throws", async () => {
    mocks.mockCompleteIdempotentResultWork.mockRejectedValue(
      new Error("complete failed"),
    );

    const result = await withIdempotentResult(
      "completion-failure-key",
      async () => ({ ok: true }),
      { fingerprint: "POST:/api/inquiry" },
    );

    expect(result).toEqual({ ok: false, reason: "failed" });
  });

  it("rejects missing required request keys with a 400 response and warning", async () => {
    const response = await withIdempotency(
      createRequest("POST", "/api/inquiry"),
      async () => ({ ok: true }),
      { required: true },
    );

    expect(mocks.mockLoggerWarn).toHaveBeenCalledWith(
      "Missing required Idempotency-Key header",
    );
    expect(response.status).toBe(HTTP_BAD_REQUEST);
    expect(await response.json()).toEqual({
      errorCode: API_ERROR_CODES.IDEMPOTENCY_KEY_REQUIRED,
      success: false,
    });
  });

  it("clears individual and all request/result caches through the exported helpers", () => {
    clearIdempotencyKey("cache-key");
    expect(mocks.mockClearRequestIdempotencyKey).toHaveBeenCalledWith(
      "cache-key",
    );
    expect(mocks.mockClearIdempotentResultKey).toHaveBeenCalledWith(
      "cache-key",
    );

    mocks.mockClearAllRequestIdempotencyKeys.mockClear();
    mocks.mockClearAllIdempotentResultKeys.mockClear();

    clearAllIdempotencyKeys();
    expect(mocks.mockClearAllRequestIdempotencyKeys).toHaveBeenCalledTimes(1);
    expect(mocks.mockClearAllIdempotentResultKeys).toHaveBeenCalledTimes(1);
  });

  it("merges request/result cache stats and removes duplicate keys", () => {
    mocks.mockGetRequestIdempotencyCacheStats.mockReturnValue({
      keys: ["request-only", "shared"],
      size: 2,
    });
    mocks.mockGetIdempotentResultCacheStats.mockReturnValue({
      keys: ["shared", "result-only"],
      size: 3,
    });

    expect(getIdempotencyCacheStats()).toEqual({
      keys: ["request-only", "shared", "result-only"],
      size: 5,
    });
  });
});
