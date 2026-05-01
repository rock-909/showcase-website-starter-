import { logger } from "@/lib/logger";

export type ObservabilitySurface =
  | "lead-family"
  | "cache-health"
  | "lead-pipeline"
  | "locale-runtime";

export type ObservabilitySignalKind =
  | "api_request"
  | "pipeline_metric"
  | "pipeline_summary";

export type ObservabilityOutcome = "success" | "failure" | "degraded";

export interface SystemObservabilitySignal {
  timestamp: string;
  kind: ObservabilitySignalKind;
  surface: ObservabilitySurface;
  name: string;
  outcome: ObservabilityOutcome;
  requestId?: string;
  statusCode?: number;
  errorCode?: string;
  errorType?: string;
  latencyMs?: number;
  route?: string;
  meta?: Record<string, unknown>;
}

export interface SignalAggregate {
  kind: ObservabilitySignalKind;
  surface: ObservabilitySurface;
  name: string;
  total: number;
  success: number;
  failure: number;
  degraded: number;
  lastTimestamp: string;
  lastRequestId?: string;
  lastStatusCode?: number;
  lastErrorCode?: string;
  lastErrorType?: string;
}

export interface ObservabilitySnapshot {
  totalSignals: number;
  recentSignals: SystemObservabilitySignal[];
  aggregates: SignalAggregate[];
}

const MAX_RECENT_SIGNALS = 200;
const recentSignals: SystemObservabilitySignal[] = [];
const aggregateMap = new Map<string, SignalAggregate>();

function aggregateKey(signal: SystemObservabilitySignal): string {
  return `${signal.surface}:${signal.kind}:${signal.name}`;
}

function cloneSignal(
  signal: SystemObservabilitySignal,
): SystemObservabilitySignal {
  return {
    ...signal,
    ...(signal.meta ? { meta: { ...signal.meta } } : {}),
  };
}

function assignOptionalAggregateFields(
  aggregate: SignalAggregate,
  signal: SystemObservabilitySignal,
): void {
  if (signal.requestId !== undefined) {
    aggregate.lastRequestId = signal.requestId;
  }
  if (signal.statusCode !== undefined) {
    aggregate.lastStatusCode = signal.statusCode;
  }
  if (signal.errorCode !== undefined) {
    aggregate.lastErrorCode = signal.errorCode;
  }
  if (signal.errorType !== undefined) {
    aggregate.lastErrorType = signal.errorType;
  }
}

function ensureAggregate(signal: SystemObservabilitySignal): SignalAggregate {
  const key = aggregateKey(signal);
  const existing = aggregateMap.get(key);
  if (existing) {
    return existing;
  }

  const created: SignalAggregate = {
    kind: signal.kind,
    surface: signal.surface,
    name: signal.name,
    total: 0,
    success: 0,
    failure: 0,
    degraded: 0,
    lastTimestamp: signal.timestamp,
  };
  aggregateMap.set(key, created);
  return created;
}

export function recordSystemSignal(signal: SystemObservabilitySignal): void {
  const normalized = cloneSignal(signal);
  recentSignals.push(normalized);
  if (recentSignals.length > MAX_RECENT_SIGNALS) {
    recentSignals.shift();
  }

  const aggregate = ensureAggregate(normalized);
  aggregate.total += 1;
  aggregate[normalized.outcome] += 1;
  aggregate.lastTimestamp = normalized.timestamp;
  assignOptionalAggregateFields(aggregate, normalized);

  logger.info("System observability signal", {
    event: "system_observability_signal",
    ...normalized,
  });
}

export function createSystemSignal(
  signal: Omit<SystemObservabilitySignal, "timestamp">,
): SystemObservabilitySignal {
  return {
    timestamp: new Date().toISOString(),
    ...signal,
  };
}

export function getSystemObservabilitySnapshot(): ObservabilitySnapshot {
  return {
    totalSignals: recentSignals.length,
    recentSignals: recentSignals.map(cloneSignal),
    aggregates: Array.from(aggregateMap.values()).map((aggregate) => ({
      ...aggregate,
    })),
  };
}

export function resetSystemObservability(): void {
  recentSignals.length = 0;
  aggregateMap.clear();
}
