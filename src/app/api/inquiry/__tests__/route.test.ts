import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { API_ERROR_CODES } from "@/constants/api-error-codes";
import { processLead } from "@/lib/lead-pipeline";
import { verifyTurnstile, verifyTurnstileDetailed } from "@/lib/turnstile";
import { OPTIONS, POST } from "../route";

vi.unmock("zod");

// Mock dependencies before imports
vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  sanitizeIP: (ip: string | undefined | null) =>
    ip ? "[REDACTED_IP]" : "[NO_IP]",
  sanitizeEmail: (email: string | undefined | null) =>
    email ? "[REDACTED_EMAIL]" : "[NO_EMAIL]",
}));

vi.mock("@/lib/security/distributed-rate-limit", () => ({
  checkDistributedRateLimit: vi.fn(async () => ({
    allowed: true,
    remaining: 5,
    resetTime: Date.now() + 60000,
    retryAfter: null,
  })),
  createRateLimitHeaders: vi.fn(() => new Headers()),
}));

vi.mock("@/lib/lead-pipeline", () => ({
  processLead: vi.fn(() =>
    Promise.resolve({
      success: true,
      partialSuccess: false,
      emailSent: true,
      recordCreated: true,
      referenceId: "ref-123",
    }),
  ),
  LEAD_TYPES: {
    PRODUCT: "product",
    CONTACT: "contact",
  },
}));

vi.mock("@/lib/turnstile", () => ({
  verifyTurnstile: vi.fn(() => Promise.resolve(true)),
  verifyTurnstileDetailed: vi.fn(() => Promise.resolve({ success: true })),
}));

// Mock CORS utilities
vi.mock("@/lib/api/cors-utils", () => ({
  applyCorsHeaders: vi.fn(
    ({ response, request }: { response: any; request: NextRequest }) => {
      const origin = request.headers.get("origin");
      if (origin) {
        response.headers.set("Access-Control-Allow-Origin", origin);
      }
      return response;
    },
  ),
  createCorsPreflightResponse: vi.fn((request: NextRequest) => {
    const origin = request.headers.get("origin");
    const headers: Record<string, string> = {
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Idempotency-Key",
    };
    if (origin) {
      headers["Access-Control-Allow-Origin"] = origin;
    }
    return new (require("next/server").NextResponse)(null, {
      status: 200,
      headers,
    });
  }),
}));

describe("/api/inquiry route", () => {
  let idempotencyCounter = 0;

  function createInquiryRequest(
    body: BodyInit | null,
    headers: Record<string, string> = {},
  ): NextRequest {
    idempotencyCounter += 1;
    return new NextRequest("http://localhost:3000/api/inquiry", {
      method: "POST",
      body,
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": `test-inquiry-key-${idempotencyCounter}`,
        ...headers,
      },
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("POST", () => {
    const validInquiryData = {
      turnstileToken: "valid-token",
      type: "product",
      fullName: "John Doe",
      email: "john@example.com",
      company: "Acme Inc",
      productSlug: "example-product",
      productName: "Example Product",
      quantity: "100",
      requirements: "I am interested in your products.",
    };

    it("should process valid inquiry successfully", async () => {
      const request = createInquiryRequest(JSON.stringify(validInquiryData));

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.referenceId).toBe("ref-123");
      expect(processLead).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "product",
          email: "john@example.com",
          productSlug: "example-product",
          productName: "Example Product",
        }),
        expect.objectContaining({
          requestId: expect.any(String),
        }),
      );
    });

    it("should apply CORS headers on POST response when Origin is present", async () => {
      const origin = "http://localhost:3000";
      const request = createInquiryRequest(JSON.stringify(validInquiryData), {
        origin,
      });

      const response = await POST(request);

      expect(response.headers.get("Access-Control-Allow-Origin")).toBe(origin);
    });

    it("should return 429 when rate limited", async () => {
      const rateLimit = await import("@/lib/security/distributed-rate-limit");
      vi.mocked(rateLimit.checkDistributedRateLimit).mockResolvedValueOnce({
        allowed: false,
        remaining: 0,
        resetTime: Date.now() + 60000,
        retryAfter: 60,
      });

      const request = createInquiryRequest(JSON.stringify(validInquiryData));

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.success).toBe(false);
      expect(data.errorCode).toBe(API_ERROR_CODES.RATE_LIMIT_EXCEEDED);
    });

    it("should return 400 for invalid JSON", async () => {
      const request = createInquiryRequest("invalid json");

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it("should return 400 when Idempotency-Key is missing", async () => {
      const request = new NextRequest("http://localhost:3000/api/inquiry", {
        method: "POST",
        body: JSON.stringify(validInquiryData),
        headers: { "Content-Type": "application/json" },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.errorCode).toBe(API_ERROR_CODES.IDEMPOTENCY_KEY_REQUIRED);
    });

    it("should return 413 when payload exceeds the shared JSON body limit", async () => {
      const request = createInquiryRequest(JSON.stringify(validInquiryData), {
        "Content-Length": "70000",
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(413);
      expect(data.success).toBe(false);
      expect(data.errorCode).toBe(API_ERROR_CODES.PAYLOAD_TOO_LARGE);
    });

    it("should replay cached response for duplicate idempotency key", async () => {
      const sharedKey = "duplicate-key";
      const firstRequest = createInquiryRequest(
        JSON.stringify(validInquiryData),
        {
          "Idempotency-Key": sharedKey,
        },
      );
      const secondRequest = createInquiryRequest(
        JSON.stringify(validInquiryData),
        {
          "Idempotency-Key": sharedKey,
        },
      );

      const firstResponse = await POST(firstRequest);
      const secondResponse = await POST(secondRequest);
      const firstData = await firstResponse.json();
      const secondData = await secondResponse.json();

      expect(firstResponse.status).toBe(200);
      expect(secondResponse.status).toBe(200);
      expect(secondData).toEqual(firstData);
      expect(processLead).toHaveBeenCalledTimes(1);
    });

    it("should return 400 when turnstile token is missing", async () => {
      const dataWithoutToken = { ...validInquiryData };
      delete (dataWithoutToken as { turnstileToken?: string }).turnstileToken;

      const request = createInquiryRequest(JSON.stringify(dataWithoutToken));

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.errorCode).toBe(API_ERROR_CODES.INQUIRY_SECURITY_REQUIRED);
    });

    it("should reject invalid email before turnstile and lead processing", async () => {
      const request = createInquiryRequest(
        JSON.stringify({ ...validInquiryData, email: "not-an-email" }),
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.errorCode).toBe(API_ERROR_CODES.INQUIRY_VALIDATION_FAILED);
      expect(verifyTurnstileDetailed).not.toHaveBeenCalled();
      expect(processLead).not.toHaveBeenCalled();
    });

    it("should reject a missing product identity before lead processing", async () => {
      const request = createInquiryRequest(
        JSON.stringify({
          ...validInquiryData,
          productSlug: "",
          productName: "",
        }),
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.errorCode).toBe(API_ERROR_CODES.INQUIRY_VALIDATION_FAILED);
      expect(processLead).not.toHaveBeenCalled();
    });

    it("should reject a non-positive numeric quantity", async () => {
      const request = createInquiryRequest(
        JSON.stringify({ ...validInquiryData, quantity: "0" }),
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.errorCode).toBe(API_ERROR_CODES.INQUIRY_VALIDATION_FAILED);
      expect(processLead).not.toHaveBeenCalled();
    });

    it("should return 400 when turnstile verification fails", async () => {
      vi.mocked(verifyTurnstile).mockResolvedValueOnce(false);
      vi.mocked(verifyTurnstileDetailed).mockResolvedValueOnce({
        success: false,
      });

      const request = createInquiryRequest(JSON.stringify(validInquiryData));

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.errorCode).toBe(API_ERROR_CODES.INQUIRY_SECURITY_FAILED);
    });

    it("should handle processLead failure", async () => {
      vi.mocked(processLead).mockResolvedValueOnce({
        success: false,
        partialSuccess: false,
        error: "PROCESSING_ERROR",
        emailSent: false,
        recordCreated: false,
      });

      const request = createInquiryRequest(JSON.stringify(validInquiryData));

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.errorCode).toBe(API_ERROR_CODES.INQUIRY_PROCESSING_ERROR);
    });

    it("should return partial-success contract when only part of the pipeline succeeds", async () => {
      vi.mocked(processLead).mockResolvedValueOnce({
        success: false,
        partialSuccess: true,
        emailSent: true,
        recordCreated: false,
        referenceId: "ref-partial-123",
      });

      const request = createInquiryRequest(JSON.stringify(validInquiryData));

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(false);
      expect(data.errorCode).toBe(API_ERROR_CODES.INQUIRY_PARTIAL_SUCCESS);
      expect(data.data).toEqual({
        partialSuccess: true,
        referenceId: "ref-partial-123",
        emailSent: true,
        recordCreated: false,
      });
    });

    it("should handle validation error from processLead", async () => {
      vi.mocked(processLead).mockResolvedValueOnce({
        success: false,
        partialSuccess: false,
        error: "VALIDATION_ERROR",
        emailSent: false,
        recordCreated: false,
      });

      const request = createInquiryRequest(JSON.stringify(validInquiryData));

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.errorCode).toBe(API_ERROR_CODES.INQUIRY_VALIDATION_FAILED);
    });

    it("should handle unexpected errors", async () => {
      vi.mocked(processLead).mockRejectedValueOnce(
        new Error("Unexpected error"),
      );

      const request = createInquiryRequest(JSON.stringify(validInquiryData));

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.errorCode).toBe(API_ERROR_CODES.INQUIRY_PROCESSING_ERROR);
    });

    it("should pass lead type product to processLead", async () => {
      const request = createInquiryRequest(JSON.stringify(validInquiryData));

      await POST(request);

      expect(processLead).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "product",
        }),
        expect.objectContaining({
          requestId: expect.any(String),
        }),
      );
    });

    it("should not allow request body to override lead type", async () => {
      const request = createInquiryRequest(
        JSON.stringify({
          ...validInquiryData,
          type: "contact",
        }),
      );

      await POST(request);

      expect(processLead).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "product",
        }),
        expect.objectContaining({
          requestId: expect.any(String),
        }),
      );
    });

    it("should exclude turnstileToken from lead data", async () => {
      const request = createInquiryRequest(JSON.stringify(validInquiryData));

      await POST(request);

      const callArgs = vi.mocked(processLead).mock.calls[0]![0];
      expect(callArgs).not.toHaveProperty("turnstileToken");
    });
  });

  describe("OPTIONS", () => {
    it("should return 200 with CORS headers for allowed origin", async () => {
      const request = new NextRequest("http://localhost:3000/api/inquiry", {
        method: "OPTIONS",
        headers: {
          Origin: "http://localhost:3000",
          Host: "localhost:3000",
        },
      });

      const response = OPTIONS(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
        "http://localhost:3000",
      );
      expect(response.headers.get("Access-Control-Allow-Methods")).toContain(
        "POST",
      );
    });

    it("should return empty body", async () => {
      const request = new NextRequest("http://localhost:3000/api/inquiry", {
        method: "OPTIONS",
        headers: { Host: "localhost:3000" },
      });

      const response = OPTIONS(request);
      const body = await response.text();

      expect(body).toBe("");
    });
  });
});
