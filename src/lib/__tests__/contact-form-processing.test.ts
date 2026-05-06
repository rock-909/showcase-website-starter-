import { describe, expect, it, vi } from "vitest";
import { CONTACT_SUBJECTS } from "@/lib/lead-pipeline/lead-schema";
import {
  processFormSubmission,
  type ContactFormWithToken,
} from "@/lib/contact-form-processing";

const mockProcessLead = vi.hoisted(() => vi.fn());

vi.mock("@/lib/lead-pipeline/process-lead", () => ({
  processLead: mockProcessLead,
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
    submittedAt: "2026-04-30T12:00:00.000Z",
  };
}

describe("processFormSubmission subject mapping", () => {
  it("maps plain custom project wording to the custom project lead subject", async () => {
    mockProcessLead.mockResolvedValueOnce({
      success: true,
      emailSent: true,
      recordCreated: true,
      referenceId: "ref-custom",
    });

    await processFormSubmission(createContactFormData("Custom project setup"));

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
      recordCreated: true,
      referenceId: "ref-other",
    });

    await processFormSubmission(
      createContactFormData(`${legacyManufacturingTerm} packaging`),
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
      recordCreated: true,
      referenceId: "ref-name",
    });

    await processFormSubmission(createContactFormData("Product inquiry"));

    expect(mockProcessLead).toHaveBeenCalledWith(
      expect.objectContaining({
        fullName: "Alice Example",
      }),
      {},
    );
  });
});
