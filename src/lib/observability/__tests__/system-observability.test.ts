import { beforeEach, describe, expect, it } from "vitest";
import {
  createSystemSignal,
  getSystemObservabilitySnapshot,
  recordSystemSignal,
  resetSystemObservability,
} from "@/lib/observability/system-observability";
import { recordApiSignal } from "@/lib/observability/api-signals";

describe("system observability", () => {
  beforeEach(() => {
    resetSystemObservability();
  });

  it("aggregates signals by surface, kind, and name", () => {
    recordSystemSignal(
      createSystemSignal({
        kind: "pipeline_metric",
        surface: "lead-pipeline",
        name: "resend",
        outcome: "success",
        latencyMs: 120,
      }),
    );
    recordSystemSignal(
      createSystemSignal({
        kind: "pipeline_metric",
        surface: "lead-pipeline",
        name: "resend",
        outcome: "failure",
        latencyMs: 300,
        errorType: "timeout",
      }),
    );

    const snapshot = getSystemObservabilitySnapshot();
    expect(snapshot.totalSignals).toBe(2);
    expect(snapshot.recentSignals).toHaveLength(2);
    expect(snapshot.aggregates).toEqual([
      expect.objectContaining({
        surface: "lead-pipeline",
        kind: "pipeline_metric",
        name: "resend",
        total: 2,
        success: 1,
        failure: 1,
        degraded: 0,
        lastErrorType: "timeout",
      }),
    ]);
  });

  it("records route signals with request identity and surface", () => {
    recordApiSignal({
      context: {
        requestId: "req-route-1",
        surface: "cache-health",
      },
      name: "health.get",
      route: "/api/health",
      outcome: "failure",
      statusCode: 401,
      errorCode: "UNAUTHORIZED",
      latencyMs: 42,
    });

    const snapshot = getSystemObservabilitySnapshot();
    expect(snapshot.aggregates).toEqual([
      expect.objectContaining({
        surface: "cache-health",
        kind: "api_request",
        name: "health.get",
        failure: 1,
        lastRequestId: "req-route-1",
        lastStatusCode: 401,
        lastErrorCode: "UNAUTHORIZED",
      }),
    ]);
  });
});
