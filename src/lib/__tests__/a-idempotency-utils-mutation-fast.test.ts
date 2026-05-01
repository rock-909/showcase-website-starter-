import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  normalizeHandlerResult,
  waitForCompletionResult,
} from "@/lib/idempotency-utils";
import type { IdempotencyStore } from "@/lib/security/stores/idempotency-store";

function createStore(getImpl: IdempotencyStore["get"]): IdempotencyStore {
  return {
    get: vi.fn(getImpl),
    set: vi.fn(),
    setIfNotExists: vi.fn(),
    delete: vi.fn(),
  };
}

describe("idempotency-utils mutation fast path", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps callable values with statusCode properties as plain HTTP 200 payloads", () => {
    const callableResult = Object.assign(() => "ok", {
      statusCode: 418,
      label: "callable-result",
    });

    expect(normalizeHandlerResult(callableResult)).toEqual({
      body: callableResult,
      statusCode: 200,
    });
  });

  it("checks the store before reporting a typed timeout", async () => {
    const store = createStore(vi.fn().mockResolvedValueOnce(null));

    const resultPromise = waitForCompletionResult("idem-key", store);
    await vi.advanceTimersByTimeAsync(50);

    await expect(resultPromise).resolves.toEqual({
      ok: false,
      reason: "failed",
    });
    expect(store.get).toHaveBeenCalledTimes(1);
  });
});
