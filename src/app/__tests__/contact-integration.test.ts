/**
 * Contact Form Submission — Integration Tests
 *
 * Tests the full contactFormAction chain with only external services mocked:
 * - Turnstile verification (Cloudflare API)
 * - Lead pipeline (Resend email + Airtable CRM)
 *
 * Internal protection chain runs as real code:
 * - Rate limiting (distributed-rate-limit)
 * - Honeypot detection
 * - Zod schema validation
 * - submittedAt time window check
 * - Turnstile token presence check
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { API_ERROR_CODES } from "@/constants/api-error-codes";
import { resetIdempotencyState } from "@/lib/idempotency";
import { checkDistributedRateLimit } from "@/lib/security/distributed-rate-limit";
import { INTERNAL_TRUSTED_CLIENT_IP_HEADER } from "@/lib/security/client-ip-headers";
import { verifyTurnstile, verifyTurnstileDetailed } from "@/lib/turnstile";
import { processFormSubmission } from "@/lib/contact-form-processing";
import { contactFormAction } from "../actions";

// ── External service mocks ──────────────────────────────────────────

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

const mockHeadersGet = vi.fn<(key: string) => string | null>((key) => {
  if (key === "x-forwarded-for") return "203.0.113.50";
  return null;
});

vi.mock("next/headers", () => ({
  headers: vi.fn(() =>
    Promise.resolve({
      get: mockHeadersGet,
    }),
  ),
}));

// Rate limiting — allow by default (internal module, but backed by external KV)
vi.mock("@/lib/security/distributed-rate-limit", () => ({
  checkDistributedRateLimit: vi.fn(() =>
    Promise.resolve({
      allowed: true,
      remaining: 10,
      resetTime: Date.now() + 60000,
    }),
  ),
}));

// Turnstile — external Cloudflare API
vi.mock("@/lib/turnstile", () => ({
  verifyTurnstile: vi.fn(() => Promise.resolve(true)),
  verifyTurnstileDetailed: vi.fn(() => Promise.resolve({ success: true })),
}));

// Lead pipeline — external services (Resend + Airtable)
vi.mock("@/lib/contact-form-processing", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/lib/contact-form-processing")>();

  return {
    ...original,
    processFormSubmission: vi.fn(() =>
      Promise.resolve({
        emailSent: true,
        recordCreated: true,
        referenceId: "ref-integration-001",
      }),
    ),
  };
});

// ── Helpers ─────────────────────────────────────────────────────────

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

function validContactFields(): Record<string, string> {
  return {
    fullName: "Alice Zhang",
    email: "alice@example.com",
    company: "Example Showcase Company Co.",
    phone: "+8613800138000",
    subject: "Product inquiry",
    message: "I need an example offer scoped for a large project.",
    acceptPrivacy: "true",
    marketingConsent: "false",
    turnstileToken: "valid-turnstile-token",
    submittedAt: new Date().toISOString(),
    idempotencyKey: "contact-integration-key",
  };
}

// ── Tests ───────────────────────────────────────────────────────────

describe("Contact form — integration (happy path chain)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetIdempotencyState();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-03T12:00:00Z"));
    vi.stubEnv("VERCEL", "1");
    mockHeadersGet.mockImplementation((key: string) => {
      if (key === "x-forwarded-for") return "203.0.113.50";
      return null;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Happy path — full chain succeeds", () => {
    it("rate limit → honeypot → validation → time check → turnstile → process lead", async () => {
      const formData = createFormData(validContactFields());

      const result = await contactFormAction(null, formData);

      // Full chain completed successfully
      expect(result.success).toBe(true);
      expect(result.data?.emailSent).toBe(true);
      expect(result.data?.recordCreated).toBe(true);

      // Protection chain was invoked in order
      expect(checkDistributedRateLimit).toHaveBeenCalledTimes(1);
      expect(verifyTurnstileDetailed).toHaveBeenCalledWith(
        "valid-turnstile-token",
        expect.any(String),
      );
      expect(processFormSubmission).toHaveBeenCalledTimes(1);
    });

    it("dedupes duplicate successful submissions with the same idempotency key", async () => {
      const firstFormData = createFormData(validContactFields());
      const secondFormData = createFormData(validContactFields());

      const firstResult = await contactFormAction(null, firstFormData);
      const secondResult = await settleDuplicateReplay(
        contactFormAction(null, secondFormData),
      );

      expect(firstResult.success).toBe(true);
      expect(secondResult.success).toBe(true);
      expect(processFormSubmission).toHaveBeenCalledTimes(1);
    });

    it("uses the middleware-derived client identity on Cloudflare", async () => {
      vi.stubEnv("VERCEL", undefined);
      vi.stubEnv("CF_PAGES", "1");
      mockHeadersGet.mockImplementation((key: string) => {
        if (key === INTERNAL_TRUSTED_CLIENT_IP_HEADER) {
          return "198.51.100.77";
        }
        if (key === "cf-connecting-ip") return "192.0.2.100";
        return null;
      });

      const formData = createFormData(validContactFields());
      const result = await contactFormAction(null, formData);

      expect(result.success).toBe(true);
      expect(verifyTurnstileDetailed).toHaveBeenCalledWith(
        "valid-turnstile-token",
        "198.51.100.77",
      );
    });
  });

  describe("Protection chain — each gate blocks when triggered", () => {
    it("rate limit gate blocks before any other processing", async () => {
      vi.mocked(checkDistributedRateLimit).mockResolvedValueOnce({
        allowed: false,
        remaining: 0,
        resetTime: Date.now() + 60000,
        retryAfter: 60,
      });

      const formData = createFormData(validContactFields());
      const result = await contactFormAction(null, formData);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(API_ERROR_CODES.RATE_LIMIT_EXCEEDED);
      // Turnstile and processLead should NOT be called
      expect(verifyTurnstileDetailed).not.toHaveBeenCalled();
      expect(processFormSubmission).not.toHaveBeenCalled();
    });

    it("honeypot gate silently accepts but does not process", async () => {
      const fields = validContactFields();
      fields.website = "http://spam-bot.example.com";
      const formData = createFormData(fields);

      const result = await contactFormAction(null, formData);

      // Silent rejection: returns success but no actual processing
      expect(result.success).toBe(true);
      expect(result.data?.emailSent).toBe(false);
      expect(result.data?.recordCreated).toBe(false);
      // Turnstile should NOT be called (blocked before validation)
      expect(verifyTurnstileDetailed).not.toHaveBeenCalled();
      expect(processFormSubmission).not.toHaveBeenCalled();
    });

    it("missing turnstile token blocks before Turnstile API call", async () => {
      const fields = validContactFields();
      delete (fields as Record<string, string | undefined>).turnstileToken;
      const formData = createFormData(fields);

      const result = await contactFormAction(null, formData);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(API_ERROR_CODES.TURNSTILE_MISSING_TOKEN);
      expect(verifyTurnstileDetailed).not.toHaveBeenCalled();
      expect(processFormSubmission).not.toHaveBeenCalled();
    });

    it("future submittedAt blocks before turnstile verification", async () => {
      const fields = validContactFields();
      // 5 minutes in the future — fails time window check (timeDiff < 0)
      fields.submittedAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      const formData = createFormData(fields);

      const result = await contactFormAction(null, formData);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(API_ERROR_CODES.CONTACT_SUBMISSION_EXPIRED);
      // Rate limit was checked (first gate)
      expect(checkDistributedRateLimit).toHaveBeenCalledTimes(1);
      // Turnstile NOT called (time check failed first)
      expect(verifyTurnstileDetailed).not.toHaveBeenCalled();
      expect(processFormSubmission).not.toHaveBeenCalled();
    });

    it("expired submittedAt blocks before turnstile verification", async () => {
      const fields = validContactFields();
      // 15 minutes ago — exceeds 10-minute window
      fields.submittedAt = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const formData = createFormData(fields);

      const result = await contactFormAction(null, formData);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(API_ERROR_CODES.CONTACT_SUBMISSION_EXPIRED);
      // Turnstile should NOT be called (time check failed first)
      expect(verifyTurnstileDetailed).not.toHaveBeenCalled();
      expect(processFormSubmission).not.toHaveBeenCalled();
    });

    it("turnstile verification failure blocks before lead processing", async () => {
      vi.mocked(verifyTurnstile).mockResolvedValueOnce(false);
      vi.mocked(verifyTurnstileDetailed).mockResolvedValueOnce({
        success: false,
      });

      const formData = createFormData(validContactFields());
      const result = await contactFormAction(null, formData);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(
        API_ERROR_CODES.TURNSTILE_VERIFICATION_FAILED,
      );
      // Rate limit was checked
      expect(checkDistributedRateLimit).toHaveBeenCalledTimes(1);
      // Turnstile was called (failed)
      expect(verifyTurnstileDetailed).toHaveBeenCalledTimes(1);
      // processLead NOT called
      expect(processFormSubmission).not.toHaveBeenCalled();
    });
  });

  describe("Protection chain ordering — earlier gates short-circuit later ones", () => {
    it("rate limit failure prevents even honeypot check from reaching turnstile", async () => {
      vi.mocked(checkDistributedRateLimit).mockResolvedValueOnce({
        allowed: false,
        remaining: 0,
        resetTime: Date.now() + 60000,
        retryAfter: 60,
      });

      // Even with honeypot filled AND invalid turnstile token
      const fields = validContactFields();
      fields.website = "http://bot.example.com";
      const formData = createFormData(fields);

      const result = await contactFormAction(null, formData);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(API_ERROR_CODES.RATE_LIMIT_EXCEEDED);
      expect(verifyTurnstileDetailed).not.toHaveBeenCalled();
    });
  });
});
