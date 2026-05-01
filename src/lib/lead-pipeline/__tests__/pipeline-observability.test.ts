/**
 * Pipeline Observability Tests
 * Tests for emitServiceMetrics and logPipelineSummary functions
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceResult } from "../service-result";
import { CONTACT_SUBJECTS, LEAD_TYPES } from "../lead-schema";

const mockLoggerInfo = vi.hoisted(() => vi.fn());
const mockLoggerWarn = vi.hoisted(() => vi.fn());
const mockLoggerError = vi.hoisted(() => vi.fn());

// Mock leadPipelineMetrics before importing the module under test
vi.mock("@/lib/lead-pipeline/metrics", () => ({
  leadPipelineMetrics: {
    recordSuccess: vi.fn(),
    recordFailure: vi.fn(),
    logPipelineSummary: vi.fn(),
  },
  categorizeError: vi.fn((error: Error) => {
    const message = error.message.toLowerCase();
    if (message.includes("timeout")) return "timeout";
    if (message.includes("network")) return "network";
    return "unknown";
  }),
  METRIC_SERVICES: {
    RESEND: "resend",
    AIRTABLE: "airtable",
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: mockLoggerInfo,
    warn: mockLoggerWarn,
    error: mockLoggerError,
  },
}));

describe("pipeline-observability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("emitServiceMetrics", () => {
    it("should skip Resend metrics when hasEmailOperation is false", async () => {
      const { emitServiceMetrics } = await import("../pipeline-observability");
      const { leadPipelineMetrics, METRIC_SERVICES } =
        await import("@/lib/lead-pipeline/metrics");

      const emailResult: ServiceResult = {
        success: true,
        latencyMs: 100,
      };
      const crmResult: ServiceResult = {
        success: true,
        latencyMs: 200,
      };

      emitServiceMetrics(emailResult, crmResult, false);

      // Should only record Airtable metrics.
      expect(leadPipelineMetrics.recordSuccess).toHaveBeenCalledTimes(1);
      expect(leadPipelineMetrics.recordSuccess).toHaveBeenCalledWith(
        METRIC_SERVICES.AIRTABLE,
        200,
        undefined,
      );
      expect(leadPipelineMetrics.recordFailure).not.toHaveBeenCalled();
    });

    it("should emit Resend success metrics when hasEmailOperation is true", async () => {
      const { emitServiceMetrics } = await import("../pipeline-observability");
      const { leadPipelineMetrics, METRIC_SERVICES } =
        await import("@/lib/lead-pipeline/metrics");

      const emailResult: ServiceResult = {
        success: true,
        latencyMs: 150,
      };
      const crmResult: ServiceResult = {
        success: true,
        latencyMs: 200,
      };

      emitServiceMetrics(emailResult, crmResult, true);

      expect(leadPipelineMetrics.recordSuccess).toHaveBeenCalledWith(
        METRIC_SERVICES.RESEND,
        150,
        undefined,
      );
      expect(leadPipelineMetrics.recordFailure).not.toHaveBeenCalledWith(
        METRIC_SERVICES.RESEND,
        expect.anything(),
        expect.anything(),
      );
    });

    it("should forward requestId to both services when provided", async () => {
      const { emitServiceMetrics } = await import("../pipeline-observability");
      const { leadPipelineMetrics, METRIC_SERVICES } =
        await import("@/lib/lead-pipeline/metrics");

      emitServiceMetrics(
        { success: true, latencyMs: 120 },
        { success: true, latencyMs: 180 },
        true,
        "req-123",
      );

      expect(leadPipelineMetrics.recordSuccess).toHaveBeenCalledWith(
        METRIC_SERVICES.RESEND,
        120,
        "req-123",
      );
      expect(leadPipelineMetrics.recordSuccess).toHaveBeenCalledWith(
        METRIC_SERVICES.AIRTABLE,
        180,
        "req-123",
      );
    });

    it("should emit Resend failure metrics when hasEmailOperation is true", async () => {
      const { emitServiceMetrics } = await import("../pipeline-observability");
      const { leadPipelineMetrics, METRIC_SERVICES } =
        await import("@/lib/lead-pipeline/metrics");

      const emailError = new Error("Email timeout");
      const emailResult: ServiceResult = {
        success: false,
        latencyMs: 150,
        error: emailError,
      };
      const crmResult: ServiceResult = {
        success: true,
        latencyMs: 200,
      };

      emitServiceMetrics(emailResult, crmResult, true);

      expect(leadPipelineMetrics.recordFailure).toHaveBeenCalledWith(
        METRIC_SERVICES.RESEND,
        150,
        emailError,
        undefined,
      );
      expect(leadPipelineMetrics.recordSuccess).not.toHaveBeenCalledWith(
        METRIC_SERVICES.RESEND,
        expect.anything(),
      );
    });

    it("should always emit Airtable metrics", async () => {
      const { emitServiceMetrics } = await import("../pipeline-observability");
      const { leadPipelineMetrics, METRIC_SERVICES } =
        await import("@/lib/lead-pipeline/metrics");

      const airtableError = new Error("Network error");

      // Test case 1: Airtable success
      const emailResult1: ServiceResult = {
        success: true,
        latencyMs: 100,
      };
      const crmResult1: ServiceResult = {
        success: true,
        latencyMs: 200,
      };

      emitServiceMetrics(emailResult1, crmResult1, false);

      expect(leadPipelineMetrics.recordSuccess).toHaveBeenCalledWith(
        METRIC_SERVICES.AIRTABLE,
        200,
        undefined,
      );

      vi.clearAllMocks();

      // Test case 2: Airtable failure
      const emailResult2: ServiceResult = {
        success: true,
        latencyMs: 100,
      };
      const crmResult2: ServiceResult = {
        success: false,
        latencyMs: 300,
        error: airtableError,
      };

      emitServiceMetrics(emailResult2, crmResult2, false);

      expect(leadPipelineMetrics.recordFailure).toHaveBeenCalledWith(
        METRIC_SERVICES.AIRTABLE,
        300,
        airtableError,
        undefined,
      );
    });
  });

  describe("logPipelineSummary", () => {
    it("should build summary object with optional error types", async () => {
      const { logPipelineSummary } = await import("../pipeline-observability");
      const { leadPipelineMetrics } =
        await import("@/lib/lead-pipeline/metrics");

      const emailError = new Error("timeout error");
      const crmError = new Error("network error");

      logPipelineSummary({
        referenceId: "CON-123",
        leadType: "contact",
        emailResult: {
          success: false,
          latencyMs: 100,
          error: emailError,
        },
        crmResult: {
          success: false,
          latencyMs: 200,
          error: crmError,
        },
        totalLatencyMs: 300,
        overallSuccess: false,
      });

      expect(leadPipelineMetrics.logPipelineSummary).toHaveBeenCalledWith(
        expect.objectContaining({
          leadId: "CON-123",
          leadType: "contact",
          totalLatencyMs: 300,
          overallSuccess: false,
          resend: expect.objectContaining({
            success: false,
            latencyMs: 100,
            errorType: "timeout",
          }),
          airtable: expect.objectContaining({
            success: false,
            latencyMs: 200,
            errorType: "network",
          }),
          timestamp: expect.any(String),
        }),
      );
    });

    it("should handle mixed results (one success, one failure)", async () => {
      const { logPipelineSummary } = await import("../pipeline-observability");
      const { leadPipelineMetrics } =
        await import("@/lib/lead-pipeline/metrics");

      const crmError = new Error("network failure");

      logPipelineSummary({
        referenceId: "QUO-456",
        leadType: "quote",
        emailResult: {
          success: true,
          latencyMs: 150,
        },
        crmResult: {
          success: false,
          latencyMs: 250,
          error: crmError,
        },
        totalLatencyMs: 400,
        overallSuccess: false,
      });

      expect(leadPipelineMetrics.logPipelineSummary).toHaveBeenCalledWith(
        expect.objectContaining({
          leadId: "QUO-456",
          leadType: "quote",
          totalLatencyMs: 400,
          overallSuccess: false,
          resend: {
            success: true,
            latencyMs: 150,
          },
          airtable: expect.objectContaining({
            success: false,
            latencyMs: 250,
            errorType: "network",
          }),
          timestamp: expect.any(String),
        }),
      );

      // Verify resend does NOT have errorType when success
      const callArg = vi.mocked(leadPipelineMetrics.logPipelineSummary).mock
        .calls[0]![0];
      expect(callArg.resend).not.toHaveProperty("errorType");
    });

    it("should exclude errorType when no error present", async () => {
      const { logPipelineSummary } = await import("../pipeline-observability");
      const { leadPipelineMetrics } =
        await import("@/lib/lead-pipeline/metrics");

      logPipelineSummary({
        referenceId: "CON-789",
        leadType: "contact",
        emailResult: {
          success: true,
          latencyMs: 100,
        },
        crmResult: {
          success: true,
          latencyMs: 200,
        },
        totalLatencyMs: 300,
        overallSuccess: true,
      });

      const callArg = vi.mocked(leadPipelineMetrics.logPipelineSummary).mock
        .calls[0]![0];

      expect(callArg.resend).not.toHaveProperty("errorType");
      expect(callArg.airtable).not.toHaveProperty("errorType");
      expect(callArg.overallSuccess).toBe(true);
    });

    it("should omit requestId when one was not provided", async () => {
      const { logPipelineSummary } = await import("../pipeline-observability");
      const { leadPipelineMetrics } =
        await import("@/lib/lead-pipeline/metrics");

      logPipelineSummary({
        referenceId: "CON-101",
        leadType: "contact",
        emailResult: {
          success: true,
          latencyMs: 90,
        },
        crmResult: {
          success: true,
          latencyMs: 110,
        },
        totalLatencyMs: 200,
        overallSuccess: true,
      });

      const callArg = vi.mocked(leadPipelineMetrics.logPipelineSummary).mock
        .calls[0]![0];
      expect(callArg).not.toHaveProperty("requestId");
    });

    it("should include requestId when provided", async () => {
      const { logPipelineSummary } = await import("../pipeline-observability");
      const { leadPipelineMetrics } =
        await import("@/lib/lead-pipeline/metrics");

      logPipelineSummary({
        referenceId: "CON-999",
        leadType: "contact",
        requestId: "req-999",
        emailResult: {
          success: true,
          latencyMs: 80,
        },
        crmResult: {
          success: true,
          latencyMs: 90,
        },
        totalLatencyMs: 170,
        overallSuccess: true,
      });

      expect(leadPipelineMetrics.logPipelineSummary).toHaveBeenCalledWith(
        expect.objectContaining({
          leadId: "CON-999",
          requestId: "req-999",
        }),
      );
    });
  });

  describe("recordPipelineObservability", () => {
    it("returns success and logs only the success outcome when both services succeed", async () => {
      const { recordPipelineObservability } =
        await import("../pipeline-observability");
      const { leadPipelineMetrics } =
        await import("@/lib/lead-pipeline/metrics");

      const outcome = recordPipelineObservability({
        lead: {
          type: LEAD_TYPES.CONTACT,
          fullName: "Alice Doe",
          email: "alice@example.com",
          marketingConsent: false,
          subject: CONTACT_SUBJECTS.PRODUCT_INQUIRY,
          message: "hello world with enough characters",
          turnstileToken: "token",
        },
        referenceId: "CON-123",
        emailResult: {
          success: true,
          latencyMs: 100,
        },
        crmResult: {
          success: true,
          latencyMs: 150,
        },
        hasEmailOperation: true,
        totalLatencyMs: 250,
        requestId: "req-success",
      });

      expect(outcome).toEqual({ success: true, partialSuccess: false });
      expect(leadPipelineMetrics.recordSuccess).toHaveBeenCalledWith(
        "resend",
        100,
        "req-success",
      );
      expect(leadPipelineMetrics.recordSuccess).toHaveBeenCalledWith(
        "airtable",
        150,
        "req-success",
      );
      expect(mockLoggerError).not.toHaveBeenCalledWith(
        "Lead email send failed",
        expect.anything(),
      );
      expect(mockLoggerWarn).not.toHaveBeenCalledWith(
        "Lead processed partially",
        expect.anything(),
      );
      expect(mockLoggerInfo).toHaveBeenCalledWith(
        "Lead processed successfully",
        expect.objectContaining({
          referenceId: "CON-123",
          requestId: "req-success",
        }),
      );
    });

    it("returns partial success and avoids CRM failure logging when only email succeeds", async () => {
      const { recordPipelineObservability } =
        await import("../pipeline-observability");

      const outcome = recordPipelineObservability({
        lead: {
          type: LEAD_TYPES.CONTACT,
          fullName: "Alice Doe",
          email: "alice@example.com",
          marketingConsent: false,
          subject: CONTACT_SUBJECTS.PRODUCT_INQUIRY,
          message: "hello world with enough characters",
          turnstileToken: "token",
        },
        referenceId: "CON-456",
        emailResult: {
          success: true,
          latencyMs: 100,
        },
        crmResult: {
          success: false,
          latencyMs: 150,
          error: new Error("CRM failed"),
        },
        hasEmailOperation: true,
        totalLatencyMs: 250,
        requestId: "req-partial",
      });

      expect(outcome).toEqual({ success: false, partialSuccess: true });
      expect(mockLoggerError).toHaveBeenCalledWith(
        "Lead CRM record failed",
        expect.objectContaining({
          referenceId: "CON-456",
          requestId: "req-partial",
        }),
      );
      expect(mockLoggerError).not.toHaveBeenCalledWith(
        "Lead email send failed",
        expect.anything(),
      );
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        "Lead processed partially",
        expect.objectContaining({
          emailSent: true,
          recordCreated: false,
          requestId: "req-partial",
        }),
      );
    });

    it("returns partial success and logs the email failure when only CRM succeeds", async () => {
      const { recordPipelineObservability } =
        await import("../pipeline-observability");

      const outcome = recordPipelineObservability({
        lead: {
          type: LEAD_TYPES.CONTACT,
          fullName: "Alice Doe",
          email: "alice@example.com",
          marketingConsent: false,
          subject: CONTACT_SUBJECTS.PRODUCT_INQUIRY,
          message: "hello world with enough characters",
          turnstileToken: "token",
        },
        referenceId: "CON-789",
        emailResult: {
          success: false,
          latencyMs: 80,
          error: new Error("SMTP failed"),
        },
        crmResult: {
          success: true,
          latencyMs: 140,
        },
        hasEmailOperation: true,
        totalLatencyMs: 220,
        requestId: "req-email-failed",
      });

      expect(outcome).toEqual({ success: false, partialSuccess: true });
      expect(mockLoggerError).toHaveBeenCalledWith(
        "Lead email send failed",
        expect.objectContaining({
          type: LEAD_TYPES.CONTACT,
          referenceId: "CON-789",
          error: "SMTP failed",
          requestId: "req-email-failed",
        }),
      );
      expect(mockLoggerError).not.toHaveBeenCalledWith(
        "Lead CRM record failed",
        expect.anything(),
      );
      expect(mockLoggerError).not.toHaveBeenCalledWith(
        "Lead processing failed completely",
        expect.anything(),
      );
      expect(mockLoggerWarn).toHaveBeenCalledTimes(1);
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        "Lead processed partially",
        expect.objectContaining({
          emailSent: false,
          recordCreated: true,
          requestId: "req-email-failed",
        }),
      );
    });

    it("logs the full failure path when both services fail", async () => {
      const { recordPipelineObservability } =
        await import("../pipeline-observability");

      const outcome = recordPipelineObservability({
        lead: {
          type: LEAD_TYPES.CONTACT,
          fullName: "Alice Doe",
          email: "alice@example.com",
          marketingConsent: false,
          subject: CONTACT_SUBJECTS.PRODUCT_INQUIRY,
          message: "hello world with enough characters",
          turnstileToken: "token",
        },
        referenceId: "CON-999",
        emailResult: {
          success: false,
          latencyMs: 90,
          error: new Error("Email gateway down"),
        },
        crmResult: {
          success: false,
          latencyMs: 120,
          error: new Error("CRM unavailable"),
        },
        hasEmailOperation: true,
        totalLatencyMs: 210,
        requestId: "req-total-failure",
      });

      expect(outcome).toEqual({ success: false, partialSuccess: false });
      expect(mockLoggerWarn).not.toHaveBeenCalledWith(
        "Lead processed partially",
        expect.anything(),
      );
      expect(mockLoggerInfo).not.toHaveBeenCalledWith(
        "Lead processed successfully",
        expect.anything(),
      );
      expect(mockLoggerError).toHaveBeenCalledWith(
        "Lead email send failed",
        expect.objectContaining({
          referenceId: "CON-999",
          error: "Email gateway down",
          requestId: "req-total-failure",
        }),
      );
      expect(mockLoggerError).toHaveBeenCalledWith(
        "Lead CRM record failed",
        expect.objectContaining({
          referenceId: "CON-999",
          error: "CRM unavailable",
          requestId: "req-total-failure",
        }),
      );
      expect(mockLoggerError).toHaveBeenCalledWith(
        "Lead processing failed completely",
        {
          type: LEAD_TYPES.CONTACT,
          referenceId: "CON-999",
          emailError: "Email gateway down",
          crmError: "CRM unavailable",
          requestId: "req-total-failure",
        },
      );
    });

    it("skips resend metrics and logs for newsletter leads with no email operation", async () => {
      const { recordPipelineObservability } =
        await import("../pipeline-observability");
      const { leadPipelineMetrics } =
        await import("@/lib/lead-pipeline/metrics");

      recordPipelineObservability({
        lead: {
          type: LEAD_TYPES.NEWSLETTER,
          email: "subscriber@example.com",
        },
        referenceId: "NEW-123",
        emailResult: {
          success: false,
          latencyMs: 0,
          error: new Error("Not applicable"),
        },
        crmResult: {
          success: false,
          latencyMs: 50,
          error: new Error("CRM failed"),
        },
        hasEmailOperation: false,
        totalLatencyMs: 50,
        requestId: "req-newsletter",
      });

      expect(leadPipelineMetrics.recordFailure).toHaveBeenCalledTimes(1);
      expect(leadPipelineMetrics.recordFailure).toHaveBeenCalledWith(
        "airtable",
        50,
        expect.any(Error),
        "req-newsletter",
      );
      expect(mockLoggerError).not.toHaveBeenCalledWith(
        "Lead email send failed",
        expect.anything(),
      );
    });

    it("does not report partial success when the email branch is skipped", async () => {
      const { recordPipelineObservability } =
        await import("../pipeline-observability");

      const outcome = recordPipelineObservability({
        lead: {
          type: LEAD_TYPES.NEWSLETTER,
          email: "subscriber@example.com",
        },
        referenceId: "NEW-456",
        emailResult: {
          success: true,
          latencyMs: 0,
        },
        crmResult: {
          success: false,
          latencyMs: 30,
          error: new Error("CRM failed"),
        },
        hasEmailOperation: false,
        totalLatencyMs: 30,
        requestId: "req-newsletter-no-email",
      });

      expect(outcome).toEqual({ success: false, partialSuccess: false });
      expect(mockLoggerWarn).not.toHaveBeenCalledWith(
        "Lead processed partially",
        expect.anything(),
      );
    });
  });
});
