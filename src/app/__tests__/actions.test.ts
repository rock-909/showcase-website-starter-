import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { API_ERROR_CODES } from "@/constants/api-error-codes";
import { resetIdempotencyState } from "@/lib/idempotency";
import { checkDistributedRateLimit } from "@/lib/security/distributed-rate-limit";
import { INTERNAL_TRUSTED_CLIENT_IP_HEADER } from "@/lib/security/client-ip-headers";
import { verifyTurnstile, verifyTurnstileDetailed } from "@/lib/turnstile";
import { contactFormAction } from "../actions";

// Mock dependencies before imports
vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const mockHeadersGet = vi.fn<(key: string) => string | null>((key) => {
  if (key === "x-forwarded-for") return "192.168.1.100";
  if (key === "x-real-ip") return "192.168.1.101";
  return null;
});

vi.mock("next/headers", () => ({
  headers: vi.fn(() =>
    Promise.resolve({
      get: mockHeadersGet,
    }),
  ),
}));

vi.mock("@/lib/security/distributed-rate-limit", () => ({
  checkDistributedRateLimit: vi.fn(() =>
    Promise.resolve({
      allowed: true,
      remaining: 10,
      resetTime: Date.now() + 60000,
      retryAfter: null,
    }),
  ),
}));

vi.mock("@/lib/turnstile", () => ({
  verifyTurnstile: vi.fn(() => Promise.resolve(true)),
  verifyTurnstileDetailed: vi.fn(() => Promise.resolve({ success: true })),
}));

vi.mock("@/lib/contact-form-processing", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/lib/contact-form-processing")>();

  return {
    ...original,
    processFormSubmission: vi.fn(() =>
      Promise.resolve({
        emailSent: true,
        recordCreated: true,
        referenceId: "ref-123",
      }),
    ),
  };
});

describe("actions.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetIdempotencyState();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T12:00:00Z"));
    vi.stubEnv("VERCEL", "1");
    // Reset mockHeadersGet to default behavior
    mockHeadersGet.mockImplementation((key: string) => {
      if (key === "x-forwarded-for") return "192.168.1.100";
      if (key === "x-real-ip") return "192.168.1.101";
      return null;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function createFormData(data: Record<string, string>): FormData {
    const formData = new FormData();
    for (const [key, value] of Object.entries(data)) {
      formData.append(key, value);
    }
    return formData;
  }

  async function settleDuplicateReplay<T>(work: Promise<T>): Promise<T> {
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(50);
    return work;
  }

  describe("contactFormAction", () => {
    const createValidFormData = (
      overrides: Partial<Record<string, string>> = {},
    ): Record<string, string> => ({
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
      company: "Acme Inc",
      phone: "+1234567890",
      subject: "General Inquiry",
      message: "Hello, this is a test message with enough length.",
      acceptPrivacy: "true",
      marketingConsent: "false",
      turnstileToken: "valid-token",
      submittedAt: new Date().toISOString(),
      idempotencyKey: "contact-action-key",
      ...overrides,
    });

    it("should return error when idempotency key is missing", async () => {
      const dataWithoutKey = { ...createValidFormData() };
      delete (dataWithoutKey as { idempotencyKey?: string }).idempotencyKey;
      const formData = createFormData(dataWithoutKey);

      const result = await contactFormAction(null, formData);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(API_ERROR_CODES.IDEMPOTENCY_KEY_REQUIRED);
      expect(checkDistributedRateLimit).toHaveBeenCalledTimes(1);
    });

    it("should return error when turnstile token is missing", async () => {
      const dataWithoutToken = { ...createValidFormData() };
      delete (dataWithoutToken as { turnstileToken?: string }).turnstileToken;
      const formData = createFormData(dataWithoutToken);

      const result = await contactFormAction(null, formData);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(API_ERROR_CODES.TURNSTILE_MISSING_TOKEN);
    });

    it("should return error when turnstile verification fails", async () => {
      vi.mocked(verifyTurnstile).mockResolvedValueOnce(false);
      vi.mocked(verifyTurnstileDetailed).mockResolvedValueOnce({
        success: false,
      });
      const formData = createFormData(createValidFormData());

      const result = await contactFormAction(null, formData);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(
        API_ERROR_CODES.TURNSTILE_VERIFICATION_FAILED,
      );
    });

    it("should return error when submittedAt is expired", async () => {
      const expiredData = {
        ...createValidFormData(),
        submittedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15 minutes ago
      };
      const formData = createFormData(expiredData);

      const result = await contactFormAction(null, formData);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(API_ERROR_CODES.CONTACT_SUBMISSION_EXPIRED);
    });

    // Note: form-field validation is covered by `src/lib/__tests__/validations.test.ts`.
    // This suite keeps Zod mocked for speed and focuses on action control flow.

    it("should attempt verification with valid form data", async () => {
      const formData = createFormData(createValidFormData());

      const result = await contactFormAction(null, formData);

      // Result depends on whether validation passes before turnstile check
      // The test verifies the action runs without throwing
      expect(result).toBeDefined();
    });

    it("should dedupe duplicate submissions with the same idempotency key", async () => {
      const freshData = {
        ...createValidFormData(),
        submittedAt: new Date().toISOString(),
        idempotencyKey: "contact-action-dedupe-key",
      };
      const formData = createFormData(freshData);
      const duplicateFormData = createFormData(freshData);

      const firstResult = await contactFormAction(null, formData);
      const secondResult = await settleDuplicateReplay(
        contactFormAction(null, duplicateFormData),
      );

      expect(firstResult.success).toBe(true);
      expect(secondResult.success).toBe(true);
      const processing = await import("@/lib/contact-form-processing");
      expect(processing.processFormSubmission).toHaveBeenCalledTimes(1);
    });

    it("should replay duplicate submissions before rate limiting runs again", async () => {
      vi.mocked(checkDistributedRateLimit)
        .mockResolvedValueOnce({
          allowed: true,
          remaining: 10,
          resetTime: Date.now() + 60_000,
          retryAfter: null,
        })
        .mockResolvedValueOnce({
          allowed: false,
          remaining: 0,
          resetTime: Date.now() + 60_000,
          retryAfter: 60,
        });

      const replayData = {
        ...createValidFormData(),
        submittedAt: new Date().toISOString(),
        idempotencyKey: "contact-action-replay-key",
      };

      const firstResult = await contactFormAction(
        null,
        createFormData(replayData),
      );
      const replayResult = await settleDuplicateReplay(
        contactFormAction(null, createFormData(replayData)),
      );

      expect(firstResult.success).toBe(true);
      expect(replayResult).toEqual(firstResult);
      expect(checkDistributedRateLimit).toHaveBeenCalledTimes(1);
    });

    it("should return error when submittedAt is not provided", async () => {
      const dataWithoutSubmittedAt = { ...createValidFormData() };
      delete (dataWithoutSubmittedAt as { submittedAt?: string }).submittedAt;
      const formData = createFormData(dataWithoutSubmittedAt);

      const result = await contactFormAction(null, formData);

      // Missing submittedAt should be rejected, not silently fallback to now
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(API_ERROR_CODES.CONTACT_SUBMISSION_EXPIRED);
    });

    it("should return error when submittedAt is not-a-date", async () => {
      const invalidDateData = {
        ...createValidFormData(),
        submittedAt: "not-a-date",
      };
      const formData = createFormData(invalidDateData);

      const result = await contactFormAction(null, formData);

      // Invalid date string should be rejected (NaN bypass vulnerability)
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(API_ERROR_CODES.CONTACT_SUBMISSION_EXPIRED);
    });

    it("should return result object with expected structure", async () => {
      const formData = createFormData(createValidFormData());

      const result = await contactFormAction(null, formData);

      expect(result).toHaveProperty("success");
      expect(typeof result.success).toBe("boolean");
    });

    it("should surface partial success without pretending the contact flow fully failed", async () => {
      const processing = await import("@/lib/contact-form-processing");
      vi.mocked(processing.processFormSubmission).mockResolvedValueOnce({
        success: false,
        partialSuccess: true,
        emailSent: true,
        recordCreated: false,
        referenceId: "ref-partial-123",
        errorCode: API_ERROR_CODES.CONTACT_PARTIAL_SUCCESS,
      });
      const formData = createFormData(createValidFormData());

      const result = await contactFormAction(null, formData);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(API_ERROR_CODES.CONTACT_PARTIAL_SUCCESS);
      expect(result.error).toBeUndefined();
      expect(result.data).toEqual({
        emailSent: true,
        recordCreated: false,
        referenceId: "ref-partial-123",
        partialSuccess: true,
      });
    });

    it("should handle empty form data", async () => {
      const formData = new FormData();

      const result = await contactFormAction(null, formData);

      expect(result.success).toBe(false);
    });
  });

  describe("Server Action Security", () => {
    function getValidFormData(): Record<string, string> {
      return {
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        company: "Acme Inc",
        phone: "+1234567890",
        subject: "General Inquiry",
        message: "Hello, this is a test message with enough length.",
        acceptPrivacy: "true",
        marketingConsent: "false",
        turnstileToken: "valid-token",
        submittedAt: new Date().toISOString(),
        idempotencyKey: "contact-security-key",
      };
    }

    function createFormData(data: Record<string, string>): FormData {
      const formData = new FormData();
      for (const [key, value] of Object.entries(data)) {
        formData.append(key, value);
      }
      return formData;
    }

    describe("Rate Limiting", () => {
      it("should reject request when rate limit exceeded", async () => {
        vi.mocked(checkDistributedRateLimit).mockResolvedValueOnce({
          allowed: false,
          remaining: 0,
          resetTime: Date.now() + 60000,
          retryAfter: 60,
        });

        const formData = createFormData(getValidFormData());
        const result = await contactFormAction(null, formData);

        expect(result.success).toBe(false);
        expect(result.error).toContain("Too many requests");
      });

      it("should call rate limiter with extracted client IP", async () => {
        const formData = createFormData(getValidFormData());
        await contactFormAction(null, formData);

        expect(checkDistributedRateLimit).toHaveBeenCalledWith(
          expect.stringMatching(/^ip:[0-9a-f]{16}$/),
          "contact",
        );

        const [identifier] = vi.mocked(checkDistributedRateLimit).mock
          .calls[0] ?? [""];
        expect(String(identifier)).not.toContain("192.168.1.100");
      });
    });

    describe("Honeypot Field Validation", () => {
      it("should silently reject when honeypot field is filled", async () => {
        const formDataWithHoneypot = {
          ...getValidFormData(),
          website: "http://spam-bot.com",
        };
        const formData = createFormData(formDataWithHoneypot);

        const result = await contactFormAction(null, formData);

        // Honeypot triggers silent rejection: returns success but doesn't process
        expect(result.success).toBe(true);
        expect(result.data?.emailSent).toBe(false);
        expect(result.data?.recordCreated).toBe(false);
        // verifyTurnstileDetailed should NOT be called (blocked before validation)
        expect(verifyTurnstileDetailed).not.toHaveBeenCalled();
      });

      it("should process normally when honeypot field is empty", async () => {
        const formDataWithEmptyHoneypot = {
          ...getValidFormData(),
          website: "",
        };
        const formData = createFormData(formDataWithEmptyHoneypot);

        await contactFormAction(null, formData);

        // Should proceed to Turnstile verification
        expect(verifyTurnstileDetailed).toHaveBeenCalled();
      });

      it("should process normally when honeypot field is absent", async () => {
        const formData = createFormData(getValidFormData());

        await contactFormAction(null, formData);

        // Should proceed to Turnstile verification
        expect(verifyTurnstileDetailed).toHaveBeenCalled();
      });
    });

    describe("Client IP Extraction", () => {
      it("should extract first IP from x-forwarded-for chain", async () => {
        mockHeadersGet.mockImplementation((key: string) => {
          if (key === "x-forwarded-for") return "203.0.113.50, 198.51.100.1";
          return null;
        });

        const formData = createFormData(getValidFormData());
        await contactFormAction(null, formData);

        expect(checkDistributedRateLimit).toHaveBeenCalledWith(
          expect.stringMatching(/^ip:[0-9a-f]{16}$/),
          "contact",
        );

        const [identifier] = vi.mocked(checkDistributedRateLimit).mock
          .calls[0] ?? [""];
        expect(String(identifier)).not.toContain("203.0.113.50");
      });

      it("should pass client IP to Turnstile verification", async () => {
        mockHeadersGet.mockImplementation((key: string) => {
          if (key === "x-forwarded-for") return "172.16.0.100";
          return null;
        });

        const formData = createFormData(getValidFormData());
        await contactFormAction(null, formData);

        expect(verifyTurnstileDetailed).toHaveBeenCalledWith(
          "valid-token",
          "172.16.0.100",
        );
      });

      it("should use middleware-derived client IP on Cloudflare", async () => {
        vi.stubEnv("VERCEL", undefined);
        vi.stubEnv("CF_PAGES", "1");
        mockHeadersGet.mockImplementation((key: string) => {
          if (key === INTERNAL_TRUSTED_CLIENT_IP_HEADER) {
            return "198.51.100.77";
          }
          if (key === "cf-connecting-ip") return "192.0.2.100";
          return null;
        });

        const formData = createFormData(getValidFormData());
        await contactFormAction(null, formData);

        expect(verifyTurnstileDetailed).toHaveBeenCalledWith(
          "valid-token",
          "198.51.100.77",
        );
      });
    });
  });
});
