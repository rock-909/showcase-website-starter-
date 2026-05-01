import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { API_ERROR_CODES } from "@/constants/api-error-codes";
import { resetIdempotencyState } from "@/lib/idempotency";
import { processLead } from "@/lib/lead-pipeline";
import { verifyTurnstileDetailed } from "@/lib/turnstile";
import { POST } from "../route";

vi.unmock("zod");

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

vi.mock("@/lib/lead-pipeline", async () => {
  const actual = await vi.importActual<typeof import("@/lib/lead-pipeline")>(
    "@/lib/lead-pipeline",
  );

  return {
    ...actual,
    processLead: vi.fn(async () => ({
      success: true,
      partialSuccess: false,
      referenceId: "sub-ref-001",
      recordCreated: true,
      emailSent: false,
    })),
  };
});

let requestCounter = 0;

function makeSubscribeRequest(
  body: unknown,
  headers: Record<string, string> = {},
): NextRequest {
  requestCounter += 1;
  return new NextRequest(
    new Request("http://localhost/api/subscribe", {
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": `subscribe-route-test-${requestCounter}`,
        ...headers,
      },
    }),
  );
}

describe("/api/subscribe route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetIdempotencyState();
  });

  it("rejects invalid JSON before Turnstile verification", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/subscribe", {
        method: "POST",
        body: "{bad json",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "subscribe-invalid-json",
        },
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      errorCode: API_ERROR_CODES.INVALID_JSON_BODY,
    });
    expect(verifyTurnstileDetailed).not.toHaveBeenCalled();
    expect(processLead).not.toHaveBeenCalled();
  });

  it("requires idempotency key", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/subscribe", {
        method: "POST",
        body: JSON.stringify({
          email: "subscriber@example.com",
          turnstileToken: "valid-token",
        }),
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      errorCode: API_ERROR_CODES.IDEMPOTENCY_KEY_REQUIRED,
    });
    expect(processLead).not.toHaveBeenCalled();
  });

  it("rejects missing email before Turnstile verification", async () => {
    const response = await POST(
      makeSubscribeRequest({
        turnstileToken: "valid-token",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      errorCode: API_ERROR_CODES.SUBSCRIBE_VALIDATION_EMAIL_REQUIRED,
    });
    expect(verifyTurnstileDetailed).not.toHaveBeenCalled();
    expect(processLead).not.toHaveBeenCalled();
  });

  it("rejects invalid email before Turnstile verification", async () => {
    const response = await POST(
      makeSubscribeRequest({
        email: "not-an-email",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      errorCode: API_ERROR_CODES.SUBSCRIBE_VALIDATION_EMAIL_INVALID,
    });
    expect(verifyTurnstileDetailed).not.toHaveBeenCalled();
    expect(processLead).not.toHaveBeenCalled();
  });

  it("requires Turnstile after email validation passes", async () => {
    const response = await POST(
      makeSubscribeRequest({
        email: "subscriber@example.com",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      errorCode: API_ERROR_CODES.SUBSCRIBE_SECURITY_REQUIRED,
    });
    expect(processLead).not.toHaveBeenCalled();
  });

  it("passes a validated lowercase newsletter lead to processLead", async () => {
    const response = await POST(
      makeSubscribeRequest({
        email: "subscriber@example.com",
        turnstileToken: "valid-token",
      }),
    );

    expect(response.status).toBe(200);
    expect(verifyTurnstileDetailed).toHaveBeenCalledTimes(1);
    expect(processLead).toHaveBeenCalledWith(
      {
        type: "newsletter",
        email: "subscriber@example.com",
      },
      expect.objectContaining({
        requestId: expect.any(String),
      }),
    );
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        referenceId: "sub-ref-001",
      },
    });
  });
});
