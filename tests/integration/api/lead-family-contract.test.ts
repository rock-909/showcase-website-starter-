import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetIdempotencyState } from "@/lib/idempotency";
import { API_ERROR_CODES } from "@/constants/api-error-codes";
import {
  OBSERVABILITY_SURFACE_HEADER,
  REQUEST_ID_HEADER,
} from "@/lib/api/request-observability";
import {
  getSystemObservabilitySnapshot,
  resetSystemObservability,
} from "@/lib/observability/system-observability";
import * as inquiryRoute from "@/app/api/inquiry/route";
import * as subscribeRoute from "@/app/api/subscribe/route";

/**
 * Auxiliary contract surface checks only.
 *
 * This suite intentionally mocks the core protection and submission pipeline so
 * it can verify response shape and observability headers. It is not the primary
 * proof for runtime protection semantics.
 */
vi.mock("@/lib/security/distributed-rate-limit", () => ({
  checkDistributedRateLimit: vi.fn(async () => ({
    allowed: true,
    remaining: 5,
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
    emailSent: true,
    recordCreated: true,
    referenceId: "lead-ref-001",
  })),
  LEAD_TYPES: {
    PRODUCT: "product",
    CONTACT: "contact",
    NEWSLETTER: "newsletter",
  },
}));

vi.mock("@/lib/lead-pipeline/lead-schema", () => ({
  LEAD_TYPES: {
    PRODUCT: "product",
    CONTACT: "contact",
    NEWSLETTER: "newsletter",
  },
  productLeadSchema: {
    safeParse: vi.fn((input: Record<string, unknown>) => ({
      success: true,
      data: {
        ...input,
        type: "product",
      },
    })),
  },
  newsletterLeadSchema: {
    safeParse: vi.fn((input: Record<string, unknown>) => ({
      success: true,
      data: {
        ...input,
        type: "newsletter",
      },
    })),
  },
}));

function makeRequest(
  pathname: string,
  body: unknown,
  extraHeaders: HeadersInit = {},
) {
  return new NextRequest(
    new Request(`http://localhost${pathname}`, {
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": `${pathname}-key`,
        ...(extraHeaders as Record<string, string>),
      },
    }),
  );
}

function expectLeadObservabilityHeaders(
  response: Response,
  expectedRequestId?: string,
) {
  expect(response.headers.get(OBSERVABILITY_SURFACE_HEADER)).toBe(
    "lead-family",
  );
  if (expectedRequestId) {
    expect(response.headers.get(REQUEST_ID_HEADER)).toBe(expectedRequestId);
    return;
  }
  expect(response.headers.get(REQUEST_ID_HEADER)).toBeTruthy();
}

describe("lead API family response contract (auxiliary)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetIdempotencyState();
    resetSystemObservability();
  });

  it("inquiry success uses the family success contract", async () => {
    const response = await inquiryRoute.POST(
      makeRequest(
        "/api/inquiry",
        {
          turnstileToken: "valid-token",
          email: "buyer@example.com",
          fullName: "Buyer",
          company: "Buyer Co",
          productSlug: "north-america",
          productName: "North America",
        },
        {
          [REQUEST_ID_HEADER]: "lead-inquiry-request",
        },
      ),
    );

    expect(response.status).toBe(200);
    expectLeadObservabilityHeaders(response, "lead-inquiry-request");
    const body = await response.json();
    expect(body).toEqual({
      success: true,
      data: {
        referenceId: "lead-ref-001",
      },
    });
    expect(getSystemObservabilitySnapshot().aggregates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          surface: "lead-family",
          kind: "api_request",
          name: "inquiry.post",
          success: 1,
          lastRequestId: "lead-inquiry-request",
        }),
      ]),
    );
  });

  it("subscribe success uses the family success contract", async () => {
    const response = await subscribeRoute.POST(
      makeRequest(
        "/api/subscribe",
        {
          email: "newsletter@example.com",
          turnstileToken: "valid-token",
        },
        {
          [REQUEST_ID_HEADER]: "lead-subscribe-request",
        },
      ),
    );

    expect(response.status).toBe(200);
    expectLeadObservabilityHeaders(response, "lead-subscribe-request");
    const body = await response.json();
    expect(body).toEqual({
      success: true,
      data: {
        referenceId: "lead-ref-001",
      },
    });
    expect(getSystemObservabilitySnapshot().aggregates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          surface: "lead-family",
          kind: "api_request",
          name: "subscribe.post",
          success: 1,
          lastRequestId: "lead-subscribe-request",
        }),
      ]),
    );
  });

  it("inquiry missing turnstile uses the family error contract", async () => {
    const response = await inquiryRoute.POST(
      makeRequest("/api/inquiry", {
        email: "buyer@example.com",
        fullName: "Buyer",
        company: "Buyer Co",
        productSlug: "north-america",
        productName: "North America",
      }),
    );

    expect(response.status).toBe(400);
    expectLeadObservabilityHeaders(response);
    const body = await response.json();
    expect(body).toEqual({
      success: false,
      errorCode: API_ERROR_CODES.INQUIRY_SECURITY_REQUIRED,
    });
  });

  it("subscribe missing email uses the family error contract", async () => {
    const response = await subscribeRoute.POST(
      makeRequest("/api/subscribe", {
        turnstileToken: "valid-token",
      }),
    );

    expect(response.status).toBe(400);
    expectLeadObservabilityHeaders(response);
    const body = await response.json();
    expect(body).toEqual({
      success: false,
      errorCode: API_ERROR_CODES.SUBSCRIBE_VALIDATION_EMAIL_REQUIRED,
    });
  });

  it("inquiry invalid JSON uses the family error contract", async () => {
    const response = await inquiryRoute.POST(
      new NextRequest(
        new Request("http://localhost/api/inquiry", {
          method: "POST",
          body: "not-json",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": "inquiry-invalid-json",
          },
        }),
      ),
    );

    expect(response.status).toBe(400);
    expectLeadObservabilityHeaders(response);
    const body = await response.json();
    expect(body).toEqual({
      success: false,
      errorCode: API_ERROR_CODES.INVALID_JSON_BODY,
    });
  });
});
