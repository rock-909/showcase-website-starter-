/**
 * Contact Processor Tests — Confirmation Email Retry Behavior
 *
 * Tests confirmation email retry mechanism with exponential backoff.
 * Uses next/server after() for serverless-safe fire-and-forget execution.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type ContactLeadInput,
  CONTACT_SUBJECTS,
  LEAD_TYPES,
} from "@/lib/lead-pipeline/lead-schema";
import type { ServiceResult } from "@/lib/lead-pipeline/service-result";

// Ensure real Zod is used
vi.unmock("zod");

const pendingAfterCallbacks = vi.hoisted(
  () => [] as Array<() => void | Promise<void>>,
);

// Mock next/server after() to collect callbacks so tests can explicitly drain them
vi.mock("next/server", () => ({
  after: vi.fn((callback: () => void | Promise<void>) => {
    pendingAfterCallbacks.push(callback);
  }),
}));

// Hoist mock functions for dynamic import compatibility
const mockSendContactFormEmail = vi.hoisted(() => vi.fn());
const mockSendConfirmationEmail = vi.hoisted(() => vi.fn());
const mockCreateLead = vi.hoisted(() => vi.fn());
const mockLoggerWarn = vi.hoisted(() => vi.fn());
const mockLoggerError = vi.hoisted(() => vi.fn());
const mockLoggerInfo = vi.hoisted(() => vi.fn());
const mockRetryAsync = vi.hoisted(() => vi.fn());
const mockSettleService = vi.hoisted(() => vi.fn());

// Mock external services with hoisted functions
vi.mock("@/lib/resend", () => ({
  resendService: {
    sendContactFormEmail: mockSendContactFormEmail,
    sendConfirmationEmail: mockSendConfirmationEmail,
  },
}));

vi.mock("@/lib/airtable", () => ({
  airtableService: {
    createLead: mockCreateLead,
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: mockLoggerInfo,
    warn: mockLoggerWarn,
    error: mockLoggerError,
  },
  sanitizeEmail: (email: string | undefined | null) =>
    email ? "[REDACTED_EMAIL]" : "[NO_EMAIL]",
  sanitizeIP: (ip: string | undefined | null) =>
    ip ? "[REDACTED_IP]" : "[NO_IP]",
  sanitizeCompany: (company: string | undefined | null) =>
    company ? "[REDACTED]" : "[NO_COMPANY]",
}));

// Mock contact form config to enable confirmation email feature
vi.mock("@/config/contact-form-config", () => ({
  CONTACT_FORM_CONFIG: {
    features: {
      sendConfirmationEmail: true,
    },
  },
}));

vi.mock("@/lib/lead-pipeline/retry-async", () => ({
  retryAsync: mockRetryAsync,
}));

vi.mock("@/lib/lead-pipeline/settle-service", () => ({
  settleService: mockSettleService,
}));

async function flushScheduledConfirmationWork(): Promise<void> {
  const callbacks = pendingAfterCallbacks.splice(0);
  for (const callback of callbacks) {
    await Promise.resolve()
      .then(callback)
      .catch(() => undefined);
  }
}

const VALID_CONTACT_LEAD: ContactLeadInput = {
  type: LEAD_TYPES.CONTACT,
  fullName: "John Doe",
  email: "john@example.com",
  subject: CONTACT_SUBJECTS.PRODUCT_INQUIRY,
  message: "This is a test message with enough characters for validation.",
  turnstileToken: "valid-token",
  company: "Test Company",
  marketingConsent: true,
};

const REFERENCE_ID = "CON-test-ref-001";

describe("processContactLead — confirmation email retry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pendingAfterCallbacks.length = 0;

    // Default: main pipeline services succeed
    mockSendContactFormEmail.mockResolvedValue("email-id-123");
    mockCreateLead.mockResolvedValue({ id: "record-123" });
    mockRetryAsync.mockImplementation(async (fn, { maxRetries }) => {
      let lastError: Error | undefined;

      for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        try {
          return await fn();
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
        }
      }

      throw lastError ?? new Error("retryAsync exhausted without an error");
    });
    mockSettleService.mockImplementation(
      async (
        _promise: Promise<unknown>,
        options: {
          operationName: string;
          mapId?: (result: unknown) => string | undefined;
        },
      ): Promise<ServiceResult> => {
        if (options.operationName === "Email send") {
          return {
            success: true,
            id: options.mapId?.("email-id-123"),
            latencyMs: 100,
          };
        }

        return {
          success: true,
          id: options.mapId?.({ id: "record-123" }),
          latencyMs: 100,
        };
      },
    );
  });

  describe("Scenario 1: Confirmation email succeeds on first attempt", () => {
    it("calls sendConfirmationEmail exactly 1 time when it succeeds immediately", async () => {
      mockSendConfirmationEmail.mockResolvedValue("confirmation-id-001");

      const { processContactLead } =
        await import("@/lib/lead-pipeline/processors/contact");
      await processContactLead(VALID_CONTACT_LEAD, REFERENCE_ID);
      await flushScheduledConfirmationWork();

      expect(mockSendConfirmationEmail).toHaveBeenCalledTimes(1);
    });
  });

  describe("Scenario 2: Confirmation email retries after first failure", () => {
    it("retries sendConfirmationEmail after first failure and succeeds on second attempt", async () => {
      mockSendConfirmationEmail
        .mockRejectedValueOnce(new Error("Transient network error"))
        .mockResolvedValueOnce("confirmation-id-retry");

      const { processContactLead } =
        await import("@/lib/lead-pipeline/processors/contact");
      await processContactLead(VALID_CONTACT_LEAD, REFERENCE_ID);
      await flushScheduledConfirmationWork();

      // Should have been called twice: initial attempt + 1 retry
      expect(mockSendConfirmationEmail).toHaveBeenCalledTimes(2);
    });

    it("does not log permanent failure when retry succeeds", async () => {
      mockSendConfirmationEmail
        .mockRejectedValueOnce(new Error("Transient network error"))
        .mockResolvedValueOnce("confirmation-id-retry");

      const { processContactLead } =
        await import("@/lib/lead-pipeline/processors/contact");
      await processContactLead(VALID_CONTACT_LEAD, REFERENCE_ID);
      await flushScheduledConfirmationWork();

      // Should NOT log error-level when retry eventually succeeds
      expect(mockLoggerError).not.toHaveBeenCalledWith(
        expect.stringContaining("Confirmation email"),
        expect.anything(),
      );
    });
  });

  describe("Scenario 3: Confirmation email fails after all retries exhausted", () => {
    it("logs error-level message with retry count after all retries fail", async () => {
      const persistentError = new Error("Resend API permanently down");
      mockSendConfirmationEmail.mockRejectedValue(persistentError);

      const { processContactLead } =
        await import("@/lib/lead-pipeline/processors/contact");
      await processContactLead(VALID_CONTACT_LEAD, REFERENCE_ID);
      await flushScheduledConfirmationWork();

      // After all retries exhausted, should log at error level (not just warn)
      expect(mockLoggerError).toHaveBeenCalledWith(
        expect.stringContaining("Confirmation email"),
        expect.objectContaining({
          email: "[REDACTED_EMAIL]",
        }),
      );
    });

    it("attempts sendConfirmationEmail at least 3 times before giving up", async () => {
      mockSendConfirmationEmail.mockRejectedValue(
        new Error("Persistent failure"),
      );

      const { processContactLead } =
        await import("@/lib/lead-pipeline/processors/contact");
      await processContactLead(VALID_CONTACT_LEAD, REFERENCE_ID);
      await flushScheduledConfirmationWork();

      // Should attempt at least 3 times (1 initial + 2 retries)
      expect(
        mockSendConfirmationEmail.mock.calls.length,
      ).toBeGreaterThanOrEqual(3);
    });
  });

  describe("Scenario 4: Email failure does not affect main pipeline", () => {
    it("returns successful emailResult and crmResult even when confirmation email fails completely", async () => {
      mockSendConfirmationEmail.mockRejectedValue(
        new Error("All retries exhausted"),
      );

      const { processContactLead } =
        await import("@/lib/lead-pipeline/processors/contact");
      const result = await processContactLead(VALID_CONTACT_LEAD, REFERENCE_ID);
      await flushScheduledConfirmationWork();

      // Main pipeline email (to admin) should succeed
      expect(result.emailResult.success).toBe(true);
      // CRM record should succeed
      expect(result.crmResult.success).toBe(true);
    });

    it("returns normally without throwing when confirmation email fails", async () => {
      mockSendConfirmationEmail.mockRejectedValue(
        new Error("Complete failure"),
      );

      const { processContactLead } =
        await import("@/lib/lead-pipeline/processors/contact");

      // processContactLead should not throw, even if confirmation fails
      await expect(
        processContactLead(VALID_CONTACT_LEAD, REFERENCE_ID),
      ).resolves.toEqual(
        expect.objectContaining({
          emailResult: expect.objectContaining({ success: true }),
          crmResult: expect.objectContaining({ success: true }),
        }),
      );
      await flushScheduledConfirmationWork();
    });
  });

  describe("main pipeline contracts", () => {
    it("builds email and CRM payloads with fallback company and generated submittedAt", async () => {
      mockSendConfirmationEmail.mockResolvedValue("confirmation-id-001");

      const { processContactLead } =
        await import("@/lib/lead-pipeline/processors/contact");

      await processContactLead(
        {
          ...VALID_CONTACT_LEAD,
          company: undefined,
          submittedAt: undefined,
        },
        REFERENCE_ID,
      );
      await flushScheduledConfirmationWork();

      expect(mockSendContactFormEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
          company: "",
          subject: CONTACT_SUBJECTS.PRODUCT_INQUIRY,
          message: VALID_CONTACT_LEAD.message,
          marketingConsent: true,
          submittedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        }),
      );

      expect(mockCreateLead).toHaveBeenCalledWith(
        LEAD_TYPES.CONTACT,
        expect.objectContaining({
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
          company: undefined,
          subject: CONTACT_SUBJECTS.PRODUCT_INQUIRY,
          message: VALID_CONTACT_LEAD.message,
          marketingConsent: true,
          referenceId: REFERENCE_ID,
        }),
      );
    });

    it("passes settleService metadata that preserves service ids", async () => {
      mockSendConfirmationEmail.mockResolvedValue("confirmation-id-001");

      const { processContactLead } =
        await import("@/lib/lead-pipeline/processors/contact");
      const { settleService } =
        await import("@/lib/lead-pipeline/settle-service");

      await processContactLead(VALID_CONTACT_LEAD, REFERENCE_ID);
      await flushScheduledConfirmationWork();

      const settleCalls = vi.mocked(settleService).mock.calls;
      expect(settleCalls).toHaveLength(2);

      const [, emailOptions] = settleCalls[0]!;
      const [, crmOptions] = settleCalls[1]!;

      expect(emailOptions).toEqual(
        expect.objectContaining({
          operationName: "Email send",
        }),
      );
      expect(emailOptions?.mapId?.("email-id-123")).toBe("email-id-123");

      expect(crmOptions).toEqual(
        expect.objectContaining({
          operationName: "CRM record",
        }),
      );
      expect(crmOptions?.mapId?.({ id: "record-123" })).toBe("record-123");
      expect(
        crmOptions?.mapId?.(undefined as unknown as { id?: string }),
      ).toBeUndefined();
      expect(crmOptions?.mapId?.({})).toBeUndefined();
    });

    it("logs the normalized rejection reason when confirmation retries reject with a non-Error value", async () => {
      mockSendConfirmationEmail.mockRejectedValue("non-error rejection");

      const { processContactLead } =
        await import("@/lib/lead-pipeline/processors/contact");
      await processContactLead(VALID_CONTACT_LEAD, REFERENCE_ID);
      await flushScheduledConfirmationWork();

      expect(mockLoggerError).toHaveBeenCalledWith(
        expect.stringContaining("Confirmation email failed after retries"),
        expect.objectContaining({
          error: "non-error rejection",
          retries: 2,
        }),
      );
    });
  });
});
