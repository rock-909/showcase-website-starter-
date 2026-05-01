import {
  categorizeError,
  leadPipelineMetrics,
  METRIC_SERVICES,
  type PipelineSummary,
} from "@/lib/lead-pipeline/metrics";
import type { LeadInput } from "@/lib/lead-pipeline/lead-schema";
import {
  isServiceFailure,
  type ServiceResult,
} from "@/lib/lead-pipeline/service-result";
import { logger } from "@/lib/logger";

// eslint-disable-next-line max-params -- guardrail-exception GSE-20260428-pipeline-service-metrics: requestId ties route-level and pipeline-level service metrics in one correlation boundary
export function emitServiceMetrics(
  emailResult: ServiceResult,
  crmResult: ServiceResult,
  hasEmailOperation: boolean,
  requestId?: string,
): void {
  // Emit Resend metrics (only for leads with email operations)
  if (hasEmailOperation) {
    if (emailResult.success) {
      leadPipelineMetrics.recordSuccess(
        METRIC_SERVICES.RESEND,
        emailResult.latencyMs,
        requestId,
      );
    } else {
      leadPipelineMetrics.recordFailure(
        METRIC_SERVICES.RESEND,
        emailResult.latencyMs,
        emailResult.error,
        requestId,
      );
    }
  }

  // Emit Airtable metrics
  if (crmResult.success) {
    leadPipelineMetrics.recordSuccess(
      METRIC_SERVICES.AIRTABLE,
      crmResult.latencyMs,
      requestId,
    );
  } else {
    leadPipelineMetrics.recordFailure(
      METRIC_SERVICES.AIRTABLE,
      crmResult.latencyMs,
      crmResult.error,
      requestId,
    );
  }
}

interface LogPipelineSummaryParams {
  referenceId: string;
  leadType: string;
  requestId?: string;
  emailResult: ServiceResult;
  crmResult: ServiceResult;
  totalLatencyMs: number;
  overallSuccess: boolean;
}

export function logPipelineSummary(params: LogPipelineSummaryParams): void {
  const {
    referenceId,
    leadType,
    requestId,
    emailResult,
    crmResult,
    totalLatencyMs,
    overallSuccess,
  } = params;

  const summary: PipelineSummary = {
    leadId: referenceId,
    leadType,
    totalLatencyMs,
    ...(requestId !== undefined ? { requestId } : {}),
    resend: {
      success: emailResult.success,
      latencyMs: emailResult.latencyMs,
      ...(isServiceFailure(emailResult)
        ? { errorType: categorizeError(emailResult.error) }
        : {}),
    },
    airtable: {
      success: crmResult.success,
      latencyMs: crmResult.latencyMs,
      ...(isServiceFailure(crmResult)
        ? { errorType: categorizeError(crmResult.error) }
        : {}),
    },
    overallSuccess,
    timestamp: new Date().toISOString(),
  };

  leadPipelineMetrics.logPipelineSummary(summary);
}

export interface PipelineObservabilityOutcome {
  success: boolean;
  partialSuccess: boolean;
}

interface RecordPipelineObservabilityParams {
  lead: LeadInput;
  referenceId: string;
  emailResult: ServiceResult;
  crmResult: ServiceResult;
  hasEmailOperation: boolean;
  totalLatencyMs: number;
  requestId?: string;
}

function withRequestId(
  requestId?: string,
): { requestId: string } | Record<string, never> {
  return requestId ? { requestId } : {};
}

function calculatePipelineOutcome(
  hasEmailOperation: boolean,
  emailResult: ServiceResult,
  crmResult: ServiceResult,
): PipelineObservabilityOutcome {
  const success = hasEmailOperation
    ? emailResult.success && crmResult.success
    : crmResult.success;

  return {
    success,
    partialSuccess: hasEmailOperation
      ? !success && (emailResult.success || crmResult.success)
      : false,
  };
}

function logServiceFailures(params: RecordPipelineObservabilityParams): void {
  const {
    lead,
    referenceId,
    hasEmailOperation,
    emailResult,
    crmResult,
    requestId,
  } = params;

  if (hasEmailOperation && !emailResult.success) {
    logger.error("Lead email send failed", {
      type: lead.type,
      referenceId,
      error: emailResult.error.message,
      ...withRequestId(requestId),
    });
  }

  if (!crmResult.success) {
    logger.error("Lead CRM record failed", {
      type: lead.type,
      referenceId,
      error: crmResult.error.message,
      ...withRequestId(requestId),
    });
  }
}

function logLeadOutcome(
  params: RecordPipelineObservabilityParams & {
    outcome: PipelineObservabilityOutcome;
  },
): void {
  const { lead, referenceId, emailResult, crmResult, outcome, requestId } =
    params;

  if (outcome.success) {
    logger.info("Lead processed successfully", {
      type: lead.type,
      referenceId,
      emailSent: emailResult.success,
      recordCreated: crmResult.success,
      ...withRequestId(requestId),
    });
    return;
  }

  if (outcome.partialSuccess) {
    logger.warn("Lead processed partially", {
      type: lead.type,
      referenceId,
      emailSent: emailResult.success,
      recordCreated: crmResult.success,
      ...withRequestId(requestId),
    });
    return;
  }

  logger.error("Lead processing failed completely", {
    type: lead.type,
    referenceId,
    emailError: isServiceFailure(emailResult)
      ? emailResult.error.message
      : undefined,
    crmError: isServiceFailure(crmResult) ? crmResult.error.message : undefined,
    ...withRequestId(requestId),
  });
}

export function recordPipelineObservability(
  params: RecordPipelineObservabilityParams,
): PipelineObservabilityOutcome {
  const {
    lead,
    referenceId,
    emailResult,
    crmResult,
    hasEmailOperation,
    totalLatencyMs,
    requestId,
  } = params;

  emitServiceMetrics(emailResult, crmResult, hasEmailOperation, requestId);
  logServiceFailures(params);

  const outcome = calculatePipelineOutcome(
    hasEmailOperation,
    emailResult,
    crmResult,
  );

  logPipelineSummary({
    referenceId,
    leadType: lead.type,
    emailResult,
    crmResult,
    totalLatencyMs,
    overallSuccess: outcome.success,
    ...withRequestId(requestId),
  });
  logLeadOutcome({
    ...params,
    outcome,
  });

  return outcome;
}
