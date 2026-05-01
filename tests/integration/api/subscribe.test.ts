import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as route from "@/app/api/subscribe/route";
import { API_ERROR_CODES } from "@/constants/api-error-codes";
import { resetIdempotencyState } from "@/lib/idempotency";

vi.mock("@/lib/security/distributed-rate-limit", () => ({
  checkDistributedRateLimit: vi.fn(async () => ({
    allowed: true,
    remaining: 3,
    resetTime: Date.now() + 60000,
    retryAfter: null,
  })),
  createRateLimitHeaders: vi.fn(() => new Headers()),
}));

vi.mock("@/lib/turnstile", () => ({
  verifyTurnstile: vi.fn(async () => true),
  verifyTurnstileDetailed: vi.fn(async () => ({ success: true })),
}));

vi.mock("@/lib/lead-pipeline", () => ({
  processLead: vi.fn(async () => ({
    success: true,
    outcome: "success",
    partialSuccess: false,
    referenceId: "ref-123",
    recordCreated: true,
    emailSent: false,
  })),
}));

const makeReq = (body: unknown, headers: HeadersInit = {}) =>
  new NextRequest(
    new Request("http://localhost/api/subscribe", {
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "test-idempotency-key",
        ...(headers as Record<string, string>),
      },
    }),
  );

describe("api/subscribe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetIdempotencyState();
  });

  it("handles malformed payload gracefully (returns JSON response)", async () => {
    const malformedReq = new NextRequest(
      new Request("http://localhost/api/subscribe", {
        method: "POST",
        body: "this is not json",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "test-idempotency-key",
        },
      }),
    );

    const res = await route.POST(malformedReq);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.errorCode).toBe(API_ERROR_CODES.INVALID_JSON_BODY);
  });

  it("returns 413 when payload exceeds the shared JSON body limit", async () => {
    const req = new NextRequest(
      new Request("http://localhost/api/subscribe", {
        method: "POST",
        body: JSON.stringify({
          email: "ok@example.com",
          turnstileToken: "valid-token",
        }),
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "test-idempotency-key",
          "Content-Length": "70000",
        },
      }),
    );

    const res = await route.POST(req);
    expect(res.status).toBe(413);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.errorCode).toBe(API_ERROR_CODES.PAYLOAD_TOO_LARGE);
  });

  it("returns 400 when Idempotency-Key is missing", async () => {
    const req = new NextRequest(
      new Request("http://localhost/api/subscribe", {
        method: "POST",
        body: JSON.stringify({ email: "ok@example.com", turnstileToken: "x" }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    const res = await route.POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.errorCode).toBe(API_ERROR_CODES.IDEMPOTENCY_KEY_REQUIRED);
  });

  it("accepts valid email with idempotency key and caches", async () => {
    const headers = { "Idempotency-Key": "key-1" };
    const res1 = await route.POST(
      makeReq(
        { email: "ok@example.com", turnstileToken: "valid-token" },
        headers,
      ),
    );
    expect(res1.status).toBe(200);
    const res2 = await route.POST(
      makeReq(
        { email: "ok@example.com", turnstileToken: "valid-token" },
        headers,
      ),
    );
    expect(res2.status).toBe(200);
    const json2 = await res2.json();
    expect(json2.success).toBe(true);
  });

  it("returns 409 when the same idempotency key is reused with a different body", async () => {
    const leadPipeline = await import("@/lib/lead-pipeline");
    const headers = { "Idempotency-Key": "key-body-conflict" };

    const first = await route.POST(
      makeReq(
        { email: "ok@example.com", turnstileToken: "valid-token" },
        headers,
      ),
    );
    const second = await route.POST(
      makeReq(
        { email: "different@example.com", turnstileToken: "valid-token" },
        headers,
      ),
    );

    expect(first.status).toBe(200);
    expect(second.status).toBe(409);
    expect(vi.mocked(leadPipeline.processLead)).toHaveBeenCalledTimes(1);

    const json = await second.json();
    expect(json.errorCode).toBe(API_ERROR_CODES.IDEMPOTENCY_KEY_REUSED);
  });

  it("returns 400 when turnstileToken is missing", async () => {
    const res = await route.POST(makeReq({ email: "test@example.com" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.errorCode).toBe(API_ERROR_CODES.SUBSCRIBE_SECURITY_REQUIRED);
  });

  it("returns 400 when turnstile verification fails", async () => {
    const utils = await import("@/lib/turnstile");
    (
      utils.verifyTurnstileDetailed as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce({
      success: false,
      errorCodes: ["invalid-input-response"],
    });

    const res = await route.POST(
      makeReq({ email: "test@example.com", turnstileToken: "invalid-token" }),
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.errorCode).toBe(API_ERROR_CODES.SUBSCRIBE_SECURITY_FAILED);
  });

  it("returns 503 when turnstile verification is unavailable", async () => {
    const utils = await import("@/lib/turnstile");
    (
      utils.verifyTurnstileDetailed as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce({
      success: false,
      errorCodes: ["network-error"],
    });

    const res = await route.POST(
      makeReq({ email: "test@example.com", turnstileToken: "invalid-token" }),
    );
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.errorCode).toBe(API_ERROR_CODES.SERVICE_UNAVAILABLE);
  });

  it("returns partial-success contract when only part of the lead pipeline succeeds", async () => {
    const leadPipeline = await import("@/lib/lead-pipeline");
    vi.mocked(leadPipeline.processLead).mockResolvedValueOnce({
      success: false,
      partialSuccess: true,
      referenceId: "ref-partial-123",
      recordCreated: true,
      emailSent: false,
    });

    const res = await route.POST(
      makeReq({ email: "test@example.com", turnstileToken: "valid-token" }),
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.errorCode).toBe(API_ERROR_CODES.SUBSCRIBE_PARTIAL_SUCCESS);
    expect(json.data).toEqual({
      partialSuccess: true,
      referenceId: "ref-partial-123",
      emailSent: false,
      recordCreated: true,
    });
  });

  it("returns 429 when rate limited", async () => {
    const rateLimit = await import("@/lib/security/distributed-rate-limit");
    (
      rateLimit.checkDistributedRateLimit as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetTime: Date.now() + 60000,
      retryAfter: 60,
    });

    const res = await route.POST(
      makeReq({ email: "test@example.com", turnstileToken: "valid-token" }),
    );
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.success).toBe(false);
  });

  it("returns 400 when email is missing", async () => {
    const res = await route.POST(makeReq({ turnstileToken: "valid-token" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.errorCode).toBe(
      API_ERROR_CODES.SUBSCRIBE_VALIDATION_EMAIL_REQUIRED,
    );
  });
});
