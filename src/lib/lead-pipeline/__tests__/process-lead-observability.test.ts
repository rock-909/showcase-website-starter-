import { beforeEach, describe, expect, it, vi } from "vitest";

import { CONTACT_SUBJECTS, LEAD_TYPES } from "../lead-schema";
import { processLead } from "../process-lead";

vi.unmock("zod");

const mockProcessContactLead = vi.hoisted(() => vi.fn());
const mockProcessProductLead = vi.hoisted(() => vi.fn());
const mockProcessNewsletterLead = vi.hoisted(() => vi.fn());
const mockLoggerInfo = vi.hoisted(() => vi.fn());
const mockLoggerWarn = vi.hoisted(() => vi.fn());
const mockLoggerError = vi.hoisted(() => vi.fn());
const mockRecordPipelineObservability = vi.hoisted(() => vi.fn());
const mockTimerStop = vi.hoisted(() => vi.fn(() => 321));

vi.mock("@/lib/lead-pipeline/processors/contact", () => ({
  processContactLead: mockProcessContactLead,
}));

vi.mock("@/lib/lead-pipeline/processors/product", () => ({
  processProductLead: mockProcessProductLead,
}));

vi.mock("@/lib/lead-pipeline/processors/newsletter", () => ({
  processNewsletterLead: mockProcessNewsletterLead,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: mockLoggerInfo,
    warn: mockLoggerWarn,
    error: mockLoggerError,
  },
  sanitizeEmail: (email: string | undefined | null) =>
    email ? "[REDACTED_EMAIL]" : "[NO_EMAIL]",
}));

vi.mock("@/lib/lead-pipeline/pipeline-observability", () => ({
  recordPipelineObservability: mockRecordPipelineObservability,
}));

vi.mock("@/lib/lead-pipeline/metrics", () => ({
  createLatencyTimer: () => ({
    stop: mockTimerStop,
  }),
}));

const VALID_CONTACT_LEAD = {
  type: LEAD_TYPES.CONTACT,
  fullName: "John Doe",
  email: "john@example.com",
  subject: CONTACT_SUBJECTS.PRODUCT_INQUIRY,
  message: "This is a test message with enough characters.",
  turnstileToken: "valid-token",
  company: "Test Company",
  marketingConsent: true,
};

const VALID_NEWSLETTER_LEAD = {
  type: LEAD_TYPES.NEWSLETTER,
  email: "subscriber@example.com",
};

describe("processLead observability contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTimerStop.mockReturnValue(321);
    mockRecordPipelineObservability.mockReturnValue({
      success: true,
      partialSuccess: false,
    });
  });

  it("logs validation failures with requestId context", async () => {
    const result = await processLead(null, { requestId: "req-validation" });

    expect(result).toEqual({
      success: false,
      partialSuccess: false,
      emailSent: false,
      recordCreated: false,
      error: "VALIDATION_ERROR",
    });
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      "Lead validation failed",
      expect.objectContaining({
        errors: expect.any(Array),
        requestId: "req-validation",
      }),
    );
    expect(mockRecordPipelineObservability).not.toHaveBeenCalled();
  });

  it("forwards success flow inputs into the consolidated observability helper", async () => {
    const emailResult = {
      success: true as const,
      id: "email-123",
      latencyMs: 10,
    };
    const crmResult = {
      success: true as const,
      id: "record-123",
      latencyMs: 20,
    };
    mockProcessContactLead.mockResolvedValue({ emailResult, crmResult });
    mockRecordPipelineObservability.mockReturnValue({
      success: true,
      partialSuccess: false,
    });

    const result = await processLead(VALID_CONTACT_LEAD, {
      requestId: "req-success",
    });

    expect(result.success).toBe(true);
    expect(mockLoggerInfo).toHaveBeenCalledWith(
      "Processing lead",
      expect.objectContaining({
        type: LEAD_TYPES.CONTACT,
        email: "[REDACTED_EMAIL]",
        referenceId: expect.stringMatching(/^CON-/),
        requestId: "req-success",
      }),
    );
    expect(mockRecordPipelineObservability).toHaveBeenCalledWith(
      expect.objectContaining({
        lead: expect.objectContaining({ type: LEAD_TYPES.CONTACT }),
        emailResult,
        crmResult,
        hasEmailOperation: true,
        totalLatencyMs: 321,
        requestId: "req-success",
      }),
    );
  });

  it("uses the consolidated helper outcome for partial successes", async () => {
    const emailResult = {
      success: false as const,
      error: new Error("Email failed"),
      latencyMs: 10,
    };
    const crmResult = {
      success: true as const,
      id: "record-123",
      latencyMs: 20,
    };
    mockProcessContactLead.mockResolvedValue({ emailResult, crmResult });
    mockRecordPipelineObservability.mockReturnValue({
      success: false,
      partialSuccess: true,
    });

    const result = await processLead(VALID_CONTACT_LEAD, {
      requestId: "req-partial",
    });

    expect(result).toEqual({
      success: false,
      partialSuccess: true,
      emailSent: false,
      recordCreated: true,
      referenceId: expect.stringMatching(/^CON-/),
      error: undefined,
    });
    expect(mockRecordPipelineObservability).toHaveBeenCalledWith(
      expect.objectContaining({
        hasEmailOperation: true,
        requestId: "req-partial",
      }),
    );
  });

  it("treats newsletter leads as no-email-operation in the consolidated helper", async () => {
    const emailResult = {
      success: false as const,
      error: new Error("Not applicable"),
      latencyMs: 0,
    };
    const crmResult = {
      success: false as const,
      error: new Error("CRM failed"),
      latencyMs: 15,
    };
    mockProcessNewsletterLead.mockResolvedValue({ emailResult, crmResult });
    mockRecordPipelineObservability.mockReturnValue({
      success: false,
      partialSuccess: false,
    });

    const result = await processLead(VALID_NEWSLETTER_LEAD, {
      requestId: "req-newsletter",
    });

    expect(result.success).toBe(false);
    expect(result.partialSuccess).toBe(false);
    expect(mockRecordPipelineObservability).toHaveBeenCalledWith(
      expect.objectContaining({
        lead: expect.objectContaining({ type: LEAD_TYPES.NEWSLETTER }),
        hasEmailOperation: false,
        requestId: "req-newsletter",
      }),
    );
  });

  it("logs unexpected non-Error rejections as Unknown error with latency and requestId", async () => {
    mockProcessContactLead.mockRejectedValue("boom");

    const result = await processLead(VALID_CONTACT_LEAD, {
      requestId: "req-unexpected",
    });

    expect(result.error).toBe("PROCESSING_FAILED");
    expect(mockLoggerError).toHaveBeenCalledWith(
      "Lead processing unexpected error",
      expect.objectContaining({
        type: LEAD_TYPES.CONTACT,
        error: "Unknown error",
        totalLatencyMs: 321,
        requestId: "req-unexpected",
      }),
    );
    expect(mockRecordPipelineObservability).not.toHaveBeenCalled();
  });
});
