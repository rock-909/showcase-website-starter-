/**
 * Lead Pipeline Metrics and Observability
 * Provides structured metrics, latency tracking, and failure alerting
 */

import { logger } from "@/lib/logger";
import {
  createSystemSignal,
  recordSystemSignal,
} from "@/lib/observability/system-observability";
import {
  DEFAULT_ALERT_CONFIG,
  createInitialFailureState,
  shouldTriggerAlert,
  type AlertConfig,
  type FailureState,
} from "@/lib/lead-pipeline/failure-alert-policy";

/**
 * Service identifiers for metrics
 */
export const METRIC_SERVICES = {
  RESEND: "resend",
  AIRTABLE: "airtable",
} as const;

export type MetricService =
  (typeof METRIC_SERVICES)[keyof typeof METRIC_SERVICES];

/**
 * Metric event types
 */
export const METRIC_TYPES = {
  SUCCESS: "success",
  FAILURE: "failure",
} as const;

export type MetricType = (typeof METRIC_TYPES)[keyof typeof METRIC_TYPES];

/**
 * Error categories for failure metrics
 */
export const ERROR_TYPES = {
  TIMEOUT: "timeout",
  NETWORK: "network",
  VALIDATION: "validation",
  RATE_LIMIT: "rate_limit",
  AUTH: "auth",
  UNKNOWN: "unknown",
} as const;

export type ErrorType = (typeof ERROR_TYPES)[keyof typeof ERROR_TYPES];

/**
 * Service metric data structure
 */
export interface ServiceMetric {
  service: MetricService;
  type: MetricType;
  latencyMs: number;
  timestamp: string;
  requestId?: string;
  errorType?: ErrorType;
  errorMessage?: string;
}

/**
 * Pipeline processing summary log structure
 */
export interface PipelineSummary {
  leadId: string;
  leadType: string;
  totalLatencyMs: number;
  requestId?: string;
  resend: { success: boolean; latencyMs: number; errorType?: ErrorType };
  airtable: { success: boolean; latencyMs: number; errorType?: ErrorType };
  overallSuccess: boolean;
  timestamp: string;
}

/**
 * Type-safe failure state storage using Map
 */
type FailureStateMap = Map<MetricService, FailureState>;

/**
 * Categorize error into known error types
 */
export function categorizeError(error: Error | unknown): ErrorType {
  if (!(error instanceof Error)) {
    return ERROR_TYPES.UNKNOWN;
  }

  const message = error.message.toLowerCase();

  if (message.includes("timeout") || message.includes("timed out")) {
    return ERROR_TYPES.TIMEOUT;
  }

  if (
    message.includes("network") ||
    message.includes("econnrefused") ||
    message.includes("enotfound") ||
    message.includes("fetch failed")
  ) {
    return ERROR_TYPES.NETWORK;
  }

  if (message.includes("rate limit") || message.includes("too many")) {
    return ERROR_TYPES.RATE_LIMIT;
  }

  if (
    message.includes("unauthorized") ||
    message.includes("authentication") ||
    message.includes("api key")
  ) {
    return ERROR_TYPES.AUTH;
  }

  if (message.includes("validation") || message.includes("invalid")) {
    return ERROR_TYPES.VALIDATION;
  }

  return ERROR_TYPES.UNKNOWN;
}

/**
 * Lead Pipeline Metrics Collector
 * Handles metric emission, latency tracking, and failure alerting
 */
export class LeadPipelineMetrics {
  private failureState: FailureStateMap;
  private alertConfig: AlertConfig;

  constructor(config?: Partial<AlertConfig>) {
    this.alertConfig = { ...DEFAULT_ALERT_CONFIG, ...config };
    this.failureState = new Map<MetricService, FailureState>();
  }

  private getMutableFailureState(service: MetricService): FailureState {
    const existing = this.failureState.get(service);
    if (existing) {
      return existing;
    }

    const created = createInitialFailureState();
    this.failureState.set(service, created);
    return created;
  }

  /**
   * Emit a service metric
   */
  emitMetric(metric: ServiceMetric): void {
    const metricLog = {
      event: "lead_pipeline_metric",
      ...metric,
    };

    recordSystemSignal(
      createSystemSignal({
        kind: "pipeline_metric",
        surface: "lead-pipeline",
        name: metric.service,
        outcome: metric.type === METRIC_TYPES.SUCCESS ? "success" : "failure",
        ...(metric.requestId !== undefined
          ? { requestId: metric.requestId }
          : {}),
        latencyMs: metric.latencyMs,
        ...(metric.errorType !== undefined
          ? { errorType: metric.errorType }
          : {}),
        meta: {
          metricType: metric.type,
          errorMessage: metric.errorMessage,
        },
      }),
    );

    if (metric.type === METRIC_TYPES.SUCCESS) {
      logger.info("Lead pipeline metric", metricLog);
      this.resetFailureCount(metric.service);
    } else {
      logger.error("Lead pipeline metric", metricLog);
      this.incrementFailureCount(metric.service, metric.errorType);
    }
  }

  /**
   * Record a success metric with latency
   */
  recordSuccess(
    service: MetricService,
    latencyMs: number,
    requestId?: string,
  ): void {
    this.emitMetric({
      service,
      type: METRIC_TYPES.SUCCESS,
      latencyMs,
      timestamp: new Date().toISOString(),
      ...(requestId !== undefined ? { requestId } : {}),
    });
  }

  /**
   * Record a failure metric with error details
   */
  // eslint-disable-next-line max-params -- guardrail-exception GSE-20260428-lead-failure-metric: requestId stays in the failure metric correlation boundary
  recordFailure(
    service: MetricService,
    latencyMs: number,
    error: Error | unknown,
    requestId?: string,
  ): void {
    const errorType = categorizeError(error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    this.emitMetric({
      service,
      type: METRIC_TYPES.FAILURE,
      latencyMs,
      timestamp: new Date().toISOString(),
      ...(requestId !== undefined ? { requestId } : {}),
      errorType,
      errorMessage,
    });
  }

  /**
   * Log pipeline processing summary
   */
  logPipelineSummary(summary: PipelineSummary): void {
    const logData = {
      event: "lead_pipeline_summary",
      ...summary,
    };

    recordSystemSignal(
      createSystemSignal({
        kind: "pipeline_summary",
        surface: "lead-pipeline",
        name: summary.leadType,
        outcome: summary.overallSuccess ? "success" : "failure",
        ...(summary.requestId !== undefined
          ? { requestId: summary.requestId }
          : {}),
        latencyMs: summary.totalLatencyMs,
        meta: {
          leadId: summary.leadId,
          resend: summary.resend,
          airtable: summary.airtable,
        },
      }),
    );

    if (summary.overallSuccess) {
      logger.info("Lead pipeline completed", logData);
    } else {
      logger.error("Lead pipeline completed", logData);
    }
  }

  /**
   * Reset consecutive failure count for a service
   */
  private resetFailureCount(service: MetricService): void {
    this.getMutableFailureState(service).consecutiveFailures = 0;
  }

  /**
   * Increment failure count and check for alert threshold
   */
  private incrementFailureCount(
    service: MetricService,
    errorType?: ErrorType,
  ): void {
    const state = this.getMutableFailureState(service);

    state.consecutiveFailures += 1;

    if (this.shouldTriggerAlert(service)) {
      this.triggerAlert(service, state.consecutiveFailures, errorType);
      state.lastAlertTimestamp = Date.now();
    }
  }

  /**
   * Check if alert should be triggered
   */
  private shouldTriggerAlert(service: MetricService): boolean {
    const state = this.getMutableFailureState(service);
    return shouldTriggerAlert(state, this.alertConfig, Date.now());
  }

  /**
   * Trigger an alert for consecutive failures
   */
  private triggerAlert(
    service: MetricService,
    failureCount: number,
    errorType?: ErrorType,
  ): void {
    logger.error("Lead pipeline alert: consecutive failures", {
      event: "lead_pipeline_alert",
      service,
      consecutiveFailures: failureCount,
      threshold: this.alertConfig.consecutiveFailureThreshold,
      lastErrorType: errorType ?? ERROR_TYPES.UNKNOWN,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get current failure state (for testing/monitoring)
   */
  getFailureState(service: MetricService): FailureState {
    return { ...this.getMutableFailureState(service) };
  }

  /**
   * Reset all failure states (for testing)
   */
  resetAllStates(): void {
    this.failureState.set(METRIC_SERVICES.RESEND, createInitialFailureState());
    this.failureState.set(
      METRIC_SERVICES.AIRTABLE,
      createInitialFailureState(),
    );
  }
}

/**
 * Singleton metrics instance for application-wide use
 */
export const leadPipelineMetrics = new LeadPipelineMetrics();

export type {
  AlertConfig,
  FailureState,
} from "@/lib/lead-pipeline/failure-alert-policy";
export { createLatencyTimer } from "@/lib/lead-pipeline/latency-timer";
