import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  IdempotencyEntry,
  IdempotencyStore,
} from "@/lib/security/stores/idempotency-store";

const mocks = vi.hoisted(() => ({
  mockDefaultTtlMs: 24 * 60 * 60 * 1000,
  mockLoggerError: vi.fn(),
  mockLoggerWarn: vi.fn(),
  mockWaitForCompletionResult: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    debug: vi.fn(),
    error: mocks.mockLoggerError,
    info: vi.fn(),
    warn: mocks.mockLoggerWarn,
  },
}));

vi.mock("@/lib/idempotency-utils", () => ({
  DEFAULT_TTL_MS: mocks.mockDefaultTtlMs,
  waitForCompletionResult: mocks.mockWaitForCompletionResult,
}));

import {
  claimIdempotentResultKey,
  clearAllIdempotentResultKeys,
  clearIdempotentResultKey,
  completeIdempotentResultWork,
  getIdempotentResultCacheStats,
  getInFlightIdempotentResult,
  getRequiredMissingResult,
  getStoredIdempotentResult,
} from "../idempotency-result-utils";

type MockStore = IdempotencyStore & {
  delete: ReturnType<typeof vi.fn<(idempotencyKey: string) => Promise<void>>>;
  get: ReturnType<
    typeof vi.fn<(idempotencyKey: string) => Promise<IdempotencyEntry | null>>
  >;
  set: ReturnType<
    typeof vi.fn<
      (
        idempotencyKey: string,
        entry: IdempotencyEntry,
        ttlMs: number,
      ) => Promise<void>
    >
  >;
  setIfNotExists: ReturnType<
    typeof vi.fn<
      (
        idempotencyKey: string,
        entry: IdempotencyEntry,
        ttlMs: number,
      ) => Promise<boolean>
    >
  >;
};

function createStore(): MockStore {
  return {
    delete: vi
      .fn<(idempotencyKey: string) => Promise<void>>()
      .mockResolvedValue(undefined),
    get: vi
      .fn<(idempotencyKey: string) => Promise<IdempotencyEntry | null>>()
      .mockResolvedValue(null),
    set: vi
      .fn<
        (
          idempotencyKey: string,
          entry: IdempotencyEntry,
          ttlMs: number,
        ) => Promise<void>
      >()
      .mockResolvedValue(undefined),
    setIfNotExists: vi
      .fn<
        (
          idempotencyKey: string,
          entry: IdempotencyEntry,
          ttlMs: number,
        ) => Promise<boolean>
      >()
      .mockResolvedValue(true),
  };
}

function createDeferred<T>() {
  let reject!: (reason?: unknown) => void;
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
}

describe("idempotency-result-utils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAllIdempotentResultKeys();
    mocks.mockWaitForCompletionResult.mockResolvedValue({
      ok: false,
      reason: "timeout",
    });
  });

  it("returns null when a missing key is allowed and logs when a required key is absent", () => {
    expect(getRequiredMissingResult(false, null)).toBeNull();
    expect(getRequiredMissingResult(true, "present")).toBeNull();
    expect(getRequiredMissingResult(true, null)).toEqual({
      ok: false,
      reason: "missing",
    });
    expect(mocks.mockLoggerWarn).toHaveBeenCalledWith(
      "Missing required idempotency key",
    );
  });

  it("returns null when no in-flight result exists", async () => {
    await expect(
      getInFlightIdempotentResult("missing-key", "POST:/api/inquiry"),
    ).resolves.toBeNull();
  });

  it("reuses an in-flight result for the same fingerprint", async () => {
    const store = createStore();
    const deferred = createDeferred<{ ok: true }>();

    const work = completeIdempotentResultWork("same-key", {
      fingerprint: "POST:/api/inquiry",
      handler: async () => deferred.promise,
      store,
      ttlMs: 321,
    });

    const inFlightPromise = getInFlightIdempotentResult<{ ok: true }>(
      "same-key",
      "POST:/api/inquiry",
    );
    deferred.resolve({ ok: true });

    await expect(inFlightPromise).resolves.toEqual({
      cached: true,
      ok: true,
      result: { ok: true },
    });
    await expect(work).resolves.toEqual({ ok: true });
    await expect(
      getInFlightIdempotentResult("same-key", "POST:/api/inquiry"),
    ).resolves.toBeNull();
    expect(getIdempotentResultCacheStats()).toEqual({ keys: [], size: 0 });
    expect(store.set).toHaveBeenCalledWith(
      "same-key",
      expect.objectContaining({
        fingerprint: "POST:/api/inquiry",
        response: { ok: true },
        status: "success",
      }),
      321,
    );
  });

  it("rejects reused in-flight results across fingerprints and reports failed executions", async () => {
    const store = createStore();
    const deferred = createDeferred<never>();
    const failingWork = completeIdempotentResultWork("reused-key", {
      fingerprint: "POST:/api/inquiry",
      handler: async () => deferred.promise,
      store,
    });

    await expect(
      getInFlightIdempotentResult("reused-key", "POST:/api/subscribe"),
    ).resolves.toEqual({ ok: false, reason: "reused" });
    const failedResult = getInFlightIdempotentResult(
      "reused-key",
      "POST:/api/inquiry",
    );
    deferred.reject(new Error("work failed"));
    await expect(failedResult).resolves.toEqual({
      ok: false,
      reason: "failed",
    });
    await expect(failingWork).rejects.toThrow("work failed");
    await expect(
      getInFlightIdempotentResult("reused-key", "POST:/api/inquiry"),
    ).resolves.toBeNull();
    expect(getIdempotentResultCacheStats()).toEqual({ keys: [], size: 0 });
  });

  it("returns stored success, failed, reused, and pending results with the correct contract", async () => {
    const store = createStore();
    store.get.mockResolvedValueOnce(null);
    await expect(
      getStoredIdempotentResult("missing-key", "POST:/api/inquiry", store),
    ).resolves.toBeNull();

    store.get.mockResolvedValueOnce({
      createdAt: 1,
      expiresAt: 2,
      fingerprint: "POST:/api/subscribe",
      response: { cached: true },
      status: "success",
    });
    await expect(
      getStoredIdempotentResult("reused-key", "POST:/api/inquiry", store),
    ).resolves.toEqual({ ok: false, reason: "reused" });

    store.get.mockResolvedValueOnce({
      createdAt: 1,
      expiresAt: 2,
      fingerprint: "POST:/api/inquiry",
      response: { cached: true },
      status: "success",
    });
    await expect(
      getStoredIdempotentResult("success-key", "POST:/api/inquiry", store),
    ).resolves.toEqual({
      cached: true,
      ok: true,
      result: { cached: true },
    });

    store.get.mockResolvedValueOnce({
      createdAt: 1,
      error: "boom",
      expiresAt: 2,
      fingerprint: "POST:/api/inquiry",
      status: "error",
    });
    await expect(
      getStoredIdempotentResult("error-key", "POST:/api/inquiry", store),
    ).resolves.toEqual({ ok: false, reason: "failed" });

    store.get.mockResolvedValueOnce({
      createdAt: 1,
      expiresAt: 2,
      fingerprint: "POST:/api/subscribe",
      status: "pending",
    });
    mocks.mockWaitForCompletionResult.mockResolvedValueOnce({
      cached: true,
      ok: true,
      result: { waited: true },
    });
    await expect(
      getStoredIdempotentResult("pending-key", "POST:/api/inquiry", store),
    ).resolves.toEqual({
      cached: true,
      ok: true,
      result: { waited: true },
    });
    expect(mocks.mockWaitForCompletionResult).toHaveBeenCalledWith(
      "pending-key",
      store,
    );
  });

  it("claims idempotent result keys with a pending entry and preserves the claim outcome", async () => {
    const store = createStore();
    vi.spyOn(Date, "now").mockReturnValue(1_000);

    await expect(
      claimIdempotentResultKey("claim-key", {
        fingerprint: "POST:/api/inquiry",
        store,
        ttlMs: 123,
      }),
    ).resolves.toBe(true);
    expect(store.setIfNotExists).toHaveBeenCalledWith(
      "claim-key",
      {
        createdAt: 1_000,
        expiresAt: 1_123,
        fingerprint: "POST:/api/inquiry",
        status: "pending",
      },
      123,
    );

    store.setIfNotExists.mockResolvedValueOnce(false);
    await expect(
      claimIdempotentResultKey("claim-key-2", {
        fingerprint: "POST:/api/inquiry",
        store,
        ttlMs: 123,
      }),
    ).resolves.toBe(false);
  });

  it("deletes pending entries on handler failure and logs cleanup problems", async () => {
    const store = createStore();
    const handlerError = new Error("handler failed");

    await expect(
      completeIdempotentResultWork("delete-ok", {
        fingerprint: "POST:/api/inquiry",
        handler: async () => {
          throw handlerError;
        },
        store,
      }),
    ).rejects.toBe(handlerError);
    expect(store.delete).toHaveBeenCalledWith("delete-ok");

    const deleteError = new Error("delete failed");
    store.delete.mockRejectedValueOnce(deleteError);
    await expect(
      completeIdempotentResultWork("delete-fail", {
        fingerprint: "POST:/api/inquiry",
        handler: async () => {
          throw handlerError;
        },
        store,
      }),
    ).rejects.toBe(handlerError);
    expect(mocks.mockLoggerError).toHaveBeenCalledWith(
      "Failed to delete PENDING idempotency key after result failure",
      {
        deleteError,
        idempotencyKey: "delete-fail",
      },
    );
  });

  it("falls back to the default ttl and logs persistence failures without dropping the result", async () => {
    const store = createStore();
    const completeError = new Error("persist failed");
    store.set.mockRejectedValueOnce(completeError);
    vi.spyOn(Date, "now").mockReturnValue(5_000);

    await expect(
      completeIdempotentResultWork("default-ttl-key", {
        fingerprint: "POST:/api/inquiry",
        handler: async () => ({ ok: true }),
        store,
      }),
    ).resolves.toEqual({ ok: true });

    expect(store.set).toHaveBeenCalledWith(
      "default-ttl-key",
      {
        createdAt: 5_000,
        expiresAt: 5_000 + mocks.mockDefaultTtlMs,
        fingerprint: "POST:/api/inquiry",
        response: { ok: true },
        status: "success",
      },
      mocks.mockDefaultTtlMs,
    );
    expect(mocks.mockLoggerError).toHaveBeenCalledWith(
      "Failed to persist COMPLETED idempotency result — key remains PENDING until TTL expires",
      {
        completeError,
        idempotencyKey: "default-ttl-key",
      },
    );
  });

  it("clears individual/all result keys and reports unique cache stats", async () => {
    const store = createStore();
    const deferredKeep = createDeferred<{ keep: true }>();
    const deferredDrop = createDeferred<{ drop: true }>();

    completeIdempotentResultWork("keep-key", {
      fingerprint: "POST:/api/inquiry",
      handler: async () => deferredKeep.promise,
      store,
    });
    completeIdempotentResultWork("drop-key", {
      fingerprint: "POST:/api/inquiry",
      handler: async () => deferredDrop.promise,
      store,
    });

    expect(getIdempotentResultCacheStats()).toEqual({
      keys: ["keep-key", "drop-key"],
      size: 2,
    });

    clearIdempotentResultKey("drop-key");
    expect(getIdempotentResultCacheStats()).toEqual({
      keys: ["keep-key"],
      size: 1,
    });

    clearAllIdempotentResultKeys();
    expect(getIdempotentResultCacheStats()).toEqual({ keys: [], size: 0 });

    deferredKeep.resolve({ keep: true });
    deferredDrop.resolve({ drop: true });
  });

  it("caps tracked pending result entries at the configured limit", () => {
    const store = createStore();

    for (let index = 0; index < 1_000; index += 1) {
      completeIdempotentResultWork(`key-${index}`, {
        fingerprint: "POST:/api/inquiry",
        handler: async () => new Promise(() => undefined),
        store,
      });
    }

    completeIdempotentResultWork("overflow-key", {
      fingerprint: "POST:/api/inquiry",
      handler: async () => new Promise(() => undefined),
      store,
    });

    const stats = getIdempotentResultCacheStats();
    expect(stats.size).toBe(1_000);
    expect(stats.keys).not.toContain("overflow-key");
  });
});
