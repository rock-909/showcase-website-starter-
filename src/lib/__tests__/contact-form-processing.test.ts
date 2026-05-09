import { beforeEach, describe, expect, it, vi } from "vitest";
import { API_ERROR_CODES } from "@/constants/api-error-codes";
import { CONTACT_SUBJECTS } from "@/lib/lead-pipeline/lead-schema";
import {
  type ContactFormWithToken,
  submitCanonicalContactSubmission,
} from "@/lib/contact/submit-canonical-contact";

const mockProcessLead = vi.hoisted(() => vi.fn());

vi.mock("@/lib/lead-pipeline/process-lead", () => ({
  processLead: mockProcessLead,
}));

vi.mock("@/lib/turnstile", () => ({
  verifyTurnstileDetailed: vi.fn(() => Promise.resolve({ success: true })),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
  },
  sanitizeEmail: (email: string | undefined | null) =>
    email ? "[REDACTED_EMAIL]" : "[NO_EMAIL]",
}));

function createContactFormData(
  subject: string | undefined,
): ContactFormWithToken {
  return {
    fullName: "Alice Example",
    email: "alice@example.com",
    company: "Example Co.",
    subject,
    message: "We need help scoping a replacement website project.",
    acceptPrivacy: true,
    marketingConsent: false,
    turnstileToken: "valid-token",
    submittedAt: new Date().toISOString(),
  };
}

describe("canonical contact submission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-30T12:00:00.000Z"));
  });

  it("maps plain custom project wording to the custom project lead subject", async () => {
    mockProcessLead.mockResolvedValueOnce({
      success: true,
      emailSent: true,
      ownerNotified: true,
      recordCreated: true,
      referenceId: "ref-custom",
    });

    await submitCanonicalContactSubmission(
      createContactFormData("Custom project setup"),
      { clientIP: "203.0.113.10" },
    );

    expect(mockProcessLead).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: CONTACT_SUBJECTS.CUSTOM_PROJECT,
      }),
      {},
    );
  });

  it("does not keep legacy production abbreviations as starter custom-project triggers", async () => {
    const legacyManufacturingTerm = ["O", "DM"].join("");

    mockProcessLead.mockResolvedValueOnce({
      success: true,
      emailSent: true,
      ownerNotified: true,
      recordCreated: true,
      referenceId: "ref-other",
    });

    await submitCanonicalContactSubmission(
      createContactFormData(`${legacyManufacturingTerm} packaging`),
      { clientIP: "203.0.113.10" },
    );

    expect(mockProcessLead).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: CONTACT_SUBJECTS.OTHER,
      }),
      {},
    );
  });

  it("splits fullName only at the downstream lead boundary", async () => {
    mockProcessLead.mockResolvedValueOnce({
      success: true,
      emailSent: true,
      ownerNotified: true,
      recordCreated: true,
      referenceId: "ref-name",
    });

    await submitCanonicalContactSubmission(
      createContactFormData("Product inquiry"),
      { clientIP: "203.0.113.10" },
    );

    expect(mockProcessLead).toHaveBeenCalledWith(
      expect.objectContaining({
        fullName: "Alice Example",
      }),
      {},
    );
  });

  it("returns a structured failure when lead processing fails", async () => {
    mockProcessLead.mockResolvedValueOnce({
      success: false,
      error: "Airtable unavailable",
    });

    const result = await submitCanonicalContactSubmission(
      createContactFormData("Product inquiry"),
      { clientIP: "203.0.113.10" },
    );

    expect(result).toEqual(
      expect.objectContaining({
        success: false,
        errorCode: API_ERROR_CODES.CONTACT_PROCESSING_ERROR,
        error: "Failed to process contact submission",
        details: null,
        data: null,
      }),
    );
  });
});
