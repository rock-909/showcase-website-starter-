/**
 * Idempotency Protection Tests
 *
 * These tests verify key security/stability properties provided by
 * `src/lib/idempotency.ts`:
 * - TOCTOU concurrency: duplicate concurrent requests execute handler once
 * - Key semantic binding: same key reused across different method/path is rejected
 * - Hot-cache resilience: clearing in-process hot caches does not lose completed results
 *
 * Note: cross-instance persistence requires a distributed IdempotencyStore backend
 * (not implemented yet).
 */

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HTTP_OK } from "@/constants";

import { clearAllIdempotencyKeys, withIdempotency } from "../idempotency";

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

function createRequest(
  method: string,
  path: string,
  idempotencyKey?: string,
): NextRequest {
  const url = `http://localhost:3000${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (idempotencyKey) {
    headers["Idempotency-Key"] = idempotencyKey;
  }
  return new NextRequest(url, { method, headers });
}

describe("idempotency security properties", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAllIdempotencyKeys();
  });

  afterEach(() => {
    clearAllIdempotencyKeys();
  });

  // =========================================================================
  // 1. TOCTOU Concurrency Test (Red)
  // =========================================================================
  describe("TOCTOU concurrency protection", () => {
    it("should execute business logic only once for duplicate concurrent requests", async () => {
      const executionCount = { value: 0 };
      const idempotencyKey = "concurrent-test-key-1";

      const request1 = createRequest("POST", "/api/inquiry", idempotencyKey);
      const request2 = createRequest("POST", "/api/inquiry", idempotencyKey);

      const handler = async () => {
        executionCount.value += 1;
        // Simulate async work to widen the race window
        await new Promise((resolve) => {
          setTimeout(resolve, 10);
        });
        return { success: true, executionId: executionCount.value };
      };

      // Fire both requests concurrently
      const [response1, response2] = await Promise.all([
        withIdempotency(request1, handler),
        withIdempotency(request2, handler),
      ]);

      // Both should succeed
      expect(response1.status).toBe(HTTP_OK);
      expect(response2.status).toBe(HTTP_OK);

      // Business logic should only execute ONCE — the second request
      // should get the cached result. Without a lock, both may execute.
      expect(executionCount.value).toBe(1);
    });
  });

  // =========================================================================
  // 2. Key Semantic Binding Test (Red)
  // =========================================================================
  describe("key semantic binding", () => {
    it("should reject same idempotency key used for different method/path", async () => {
      const sharedKey = "semantic-binding-key-1";

      // First: POST /api/inquiry with this key
      const request1 = createRequest("POST", "/api/inquiry", sharedKey);
      const response1 = await withIdempotency(request1, async () => ({
        action: "contact",
      }));
      expect(response1.status).toBe(HTTP_OK);

      // Second: POST /api/subscribe with the SAME key — should be rejected
      // because the key was originally used for a different endpoint.
      // Current implementation does not bind key to method/path.
      const request2 = createRequest("POST", "/api/subscribe", sharedKey);
      const response2 = await withIdempotency(request2, async () => ({
        action: "subscribe",
      }));

      // The response should indicate a conflict (e.g., 409 or 422),
      // not silently return the cached /api/inquiry result.
      const data = (await response2.json()) as Record<string, unknown>;
      expect(response2.status).not.toBe(HTTP_OK);
      expect(data).toHaveProperty("errorCode", "IDEMPOTENCY_KEY_REUSED");
    });
  });

  describe("non-idempotent fallback semantics", () => {
    it("should preserve statusCode even when no idempotency key is provided", async () => {
      const request = createRequest("POST", "/api/inquiry");
      const response = await withIdempotency(request, async () => ({
        success: false,
        errorCode: "BOOM",
        statusCode: 409,
      }));

      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({
        success: false,
        errorCode: "BOOM",
      });
    });
  });

  // =========================================================================
  // 3. Hot-cache Resilience Test
  // =========================================================================
  describe("hot-cache resilience", () => {
    it("should recognize previously used key after hot-cache clear (simulated)", async () => {
      const key = "persistence-test-key-1";

      // First request succeeds and caches
      const request1 = createRequest("POST", "/api/inquiry", key);
      await withIdempotency(request1, async () => ({ success: true }));

      // Simulate a hot-cache clear (e.g., module-level Maps cleared in tests).
      // This is NOT a true process restart; cross-instance persistence requires
      // a distributed IdempotencyStore backend.
      clearAllIdempotencyKeys();

      // Second request with same key should still return cached result
      // (from the IdempotencyStore), not re-execute business logic.
      const executionCount = { value: 0 };
      const request2 = createRequest("POST", "/api/inquiry", key);
      const response2 = await withIdempotency(request2, async () => {
        executionCount.value += 1;
        return { success: true, reExecuted: true };
      });

      const data = (await response2.json()) as Record<string, unknown>;

      // If results are stored in IdempotencyStore, handler should NOT execute again.
      expect(executionCount.value).toBe(0);
      expect(data).not.toHaveProperty("reExecuted");
    });
  });
});
