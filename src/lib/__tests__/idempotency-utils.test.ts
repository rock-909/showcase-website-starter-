import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { API_ERROR_CODES } from "@/constants/api-error-codes";
import type { IdempotencyStore } from "@/lib/security/stores/idempotency-store";

import {
  normalizeHandlerResult,
  waitForCompletion,
  waitForCompletionResult,
} from "../idempotency-utils";

function createStore(getImpl: IdempotencyStore["get"]): IdempotencyStore {
  return {
    get: getImpl,
    setIfNotExists: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  };
}

describe("idempotency-utils", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe("normalizeHandlerResult", () => {
    it("keeps primitive results as HTTP 200 payloads", () => {
      expect(normalizeHandlerResult("ok")).toEqual({
        body: "ok",
        statusCode: 200,
      });
    });

    it("keeps null results as HTTP 200 payloads", () => {
      expect(normalizeHandlerResult(null)).toEqual({
        body: null,
        statusCode: 200,
      });
    });

    it("keeps boolean primitives as HTTP 200 payloads", () => {
      expect(normalizeHandlerResult(false)).toEqual({
        body: false,
        statusCode: 200,
      });
    });

    it("keeps array results as HTTP 200 payloads", () => {
      const payload = [1, 2, 3];
      const normalized = normalizeHandlerResult(payload);

      expect(normalized).toEqual({
        body: [1, 2, 3],
        statusCode: 200,
      });
      expect(normalized.body).toBe(payload);
    });

    it("keeps plain objects without statusCode untouched", () => {
      const payload = { ok: true };
      const normalized = normalizeHandlerResult(payload);

      expect(normalized).toEqual({
        body: { ok: true },
        statusCode: 200,
      });
      expect(normalized.body).toBe(payload);
    });

    it("ignores inherited statusCode properties", () => {
      const payload = Object.create({ statusCode: 409 }) as Record<
        string,
        unknown
      >;
      payload.ok = false;
      payload.errorCode = "BOOM";

      expect(normalizeHandlerResult(payload)).toEqual({
        body: payload,
        statusCode: 200,
      });
    });

    it("strips numeric statusCode from payload while preserving HTTP status", () => {
      expect(
        normalizeHandlerResult({
          ok: false,
          errorCode: "BOOM",
          statusCode: 409,
        }),
      ).toEqual({
        body: { ok: false, errorCode: "BOOM" },
        statusCode: 409,
      });
    });

    it("treats non-numeric statusCode as normal payload data", () => {
      expect(
        normalizeHandlerResult({
          ok: false,
          statusCode: "409",
          errorCode: "BOOM",
        }),
      ).toEqual({
        body: { ok: false, statusCode: "409", errorCode: "BOOM" },
        statusCode: 200,
      });
    });

    it("keeps callable values with statusCode properties as HTTP 200 payloads", () => {
      const callableResult = Object.assign(() => "ok", {
        statusCode: 418,
        label: "callable-result",
      });

      expect(normalizeHandlerResult(callableResult)).toEqual({
        body: callableResult,
        statusCode: 200,
      });
    });
  });

  describe("waitForCompletion", () => {
    it("returns cached success response after pending state resolves", async () => {
      const store = createStore(
        vi
          .fn<IdempotencyStore["get"]>()
          .mockResolvedValueOnce({
            status: "pending",
            createdAt: 0,
            expiresAt: 100,
          })
          .mockResolvedValueOnce({
            status: "success",
            response: { ok: true },
            createdAt: 0,
            expiresAt: 100,
          }),
      );

      const responsePromise = waitForCompletion("idem-key", store);
      await vi.advanceTimersByTimeAsync(100);

      const response = await responsePromise;
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ ok: true });
    });

    it("fails closed when pending entry disappears", async () => {
      const store = createStore(
        vi.fn<IdempotencyStore["get"]>().mockResolvedValueOnce(null),
      );

      const responsePromise = waitForCompletion("idem-key", store);
      await vi.advanceTimersByTimeAsync(50);

      const response = await responsePromise;
      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual(
        expect.objectContaining({
          errorCode: API_ERROR_CODES.IDEMPOTENCY_REQUEST_FAILED,
        }),
      );
    });

    it("checks the store before timing out on the HTTP helper path", async () => {
      const store = createStore(
        vi.fn<IdempotencyStore["get"]>().mockResolvedValueOnce(null),
      );

      const responsePromise = waitForCompletion("idem-key", store);
      await vi.advanceTimersByTimeAsync(50);

      const response = await responsePromise;
      expect(store.get).toHaveBeenCalledTimes(1);
      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual(
        expect.objectContaining({
          errorCode: API_ERROR_CODES.IDEMPOTENCY_REQUEST_FAILED,
        }),
      );
    });

    it("fails closed when the pending entry settles to error", async () => {
      const store = createStore(
        vi
          .fn<IdempotencyStore["get"]>()
          .mockResolvedValueOnce({
            status: "pending",
            createdAt: 0,
            expiresAt: 100,
          })
          .mockResolvedValueOnce({
            status: "error",
            createdAt: 0,
            expiresAt: 100,
          }),
      );

      const responsePromise = waitForCompletion("idem-key", store);
      await vi.advanceTimersByTimeAsync(100);

      const response = await responsePromise;
      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual(
        expect.objectContaining({
          errorCode: API_ERROR_CODES.IDEMPOTENCY_REQUEST_FAILED,
        }),
      );
    });

    it("times out after the fixed polling budget", async () => {
      const get = vi.fn<IdempotencyStore["get"]>().mockResolvedValue({
        status: "pending",
        createdAt: 0,
        expiresAt: 100,
      });
      const store = createStore(get);

      let settled = false;
      const responsePromise = waitForCompletion("idem-key", store).finally(
        () => {
          settled = true;
        },
      );

      await vi.advanceTimersByTimeAsync(10_000);

      expect(settled).toBe(true);
      expect(get).toHaveBeenCalledTimes(200);

      const response = await responsePromise;
      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual(
        expect.objectContaining({
          errorCode: API_ERROR_CODES.IDEMPOTENCY_REQUEST_TIMEOUT,
        }),
      );
    });

    it("returns success as soon as the first polling attempt resolves successfully", async () => {
      const store = createStore(
        vi.fn<IdempotencyStore["get"]>().mockResolvedValueOnce({
          status: "success",
          response: { ok: true },
          createdAt: 0,
          expiresAt: 100,
        }),
      );

      const responsePromise = waitForCompletion("idem-key", store);
      await vi.advanceTimersByTimeAsync(50);

      const response = await responsePromise;
      expect(store.get).toHaveBeenCalledTimes(1);
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ ok: true });
    });
  });

  describe("waitForCompletionResult", () => {
    it("returns cached typed result once the store reports success", async () => {
      const store = createStore(
        vi
          .fn<IdempotencyStore["get"]>()
          .mockResolvedValueOnce({
            status: "pending",
            createdAt: 0,
            expiresAt: 100,
          })
          .mockResolvedValueOnce({
            status: "success",
            response: { value: 42 },
            createdAt: 0,
            expiresAt: 100,
          }),
      );

      const resultPromise = waitForCompletionResult<{ value: number }>(
        "idem-key",
        store,
      );
      await vi.advanceTimersByTimeAsync(100);

      await expect(resultPromise).resolves.toEqual({
        ok: true,
        result: { value: 42 },
        cached: true,
      });
    });

    it("returns failed when the pending entry disappears", async () => {
      const store = createStore(
        vi.fn<IdempotencyStore["get"]>().mockResolvedValueOnce(null),
      );

      const resultPromise = waitForCompletionResult("idem-key", store);
      await vi.advanceTimersByTimeAsync(50);

      await expect(resultPromise).resolves.toEqual({
        ok: false,
        reason: "failed",
      });
    });

    it("checks the store before timing out on the typed helper path", async () => {
      const store = createStore(
        vi.fn<IdempotencyStore["get"]>().mockResolvedValueOnce(null),
      );

      const resultPromise = waitForCompletionResult("idem-key", store);
      await vi.advanceTimersByTimeAsync(50);

      await expect(resultPromise).resolves.toEqual({
        ok: false,
        reason: "failed",
      });
      expect(store.get).toHaveBeenCalledTimes(1);
    });

    it("returns failed when the pending entry settles to error", async () => {
      const store = createStore(
        vi
          .fn<IdempotencyStore["get"]>()
          .mockResolvedValueOnce({
            status: "pending",
            createdAt: 0,
            expiresAt: 100,
          })
          .mockResolvedValueOnce({
            status: "error",
            createdAt: 0,
            expiresAt: 100,
          }),
      );

      const resultPromise = waitForCompletionResult("idem-key", store);
      await vi.advanceTimersByTimeAsync(100);

      await expect(resultPromise).resolves.toEqual({
        ok: false,
        reason: "failed",
      });
    });

    it("returns timeout reason when the entry never settles", async () => {
      const get = vi.fn<IdempotencyStore["get"]>().mockResolvedValue({
        status: "pending",
        createdAt: 0,
        expiresAt: 100,
      });
      const store = createStore(get);

      let settled = false;
      const resultPromise = waitForCompletionResult("idem-key", store);
      resultPromise.finally(() => {
        settled = true;
      });
      await vi.advanceTimersByTimeAsync(10_000);

      expect(settled).toBe(true);
      expect(get).toHaveBeenCalledTimes(200);

      await expect(resultPromise).resolves.toEqual({
        ok: false,
        reason: "timeout",
      });
    });
  });
});
