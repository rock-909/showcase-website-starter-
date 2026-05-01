/**
 * Settle Service Tests
 * Tests for the settleService utility that wraps promises with timeout and metrics
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { settleService } from "../settle-service";
import { isServiceFailure } from "../service-result";

// Mock dependencies
vi.mock("@/lib/lead-pipeline/metrics", () => ({
  createLatencyTimer: vi.fn(),
}));

vi.mock("@/lib/lead-pipeline/with-timeout", () => ({
  OPERATION_TIMEOUT_MS: 10000,
  withTimeout: vi.fn(),
}));

describe("settleService", () => {
  const mockStop = vi.fn();
  const setupSuccessPath = async (latencyMs: number) => {
    const { createLatencyTimer } = await import("@/lib/lead-pipeline/metrics");
    const { withTimeout } = await import("@/lib/lead-pipeline/with-timeout");
    mockStop.mockReturnValue(latencyMs);
    vi.mocked(createLatencyTimer).mockReturnValue({ stop: mockStop });
    vi.mocked(withTimeout).mockImplementation((promise) => promise);
    return { createLatencyTimer, withTimeout };
  };

  const setupFailurePath = async (latencyMs: number, error: unknown) => {
    const { createLatencyTimer } = await import("@/lib/lead-pipeline/metrics");
    const { withTimeout } = await import("@/lib/lead-pipeline/with-timeout");
    mockStop.mockReturnValue(latencyMs);
    vi.mocked(createLatencyTimer).mockReturnValue({ stop: mockStop });
    vi.mocked(withTimeout).mockRejectedValue(error);
    return { createLatencyTimer, withTimeout };
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    // Setup createLatencyTimer mock
    const { createLatencyTimer } = await import("@/lib/lead-pipeline/metrics");
    vi.mocked(createLatencyTimer).mockReturnValue({ stop: mockStop });

    // Setup withTimeout to pass through by default
    const { withTimeout } = await import("@/lib/lead-pipeline/with-timeout");
    vi.mocked(withTimeout).mockImplementation((promise) => promise);
  });

  describe("successful resolution", () => {
    it("should return success result with latency on resolution", async () => {
      const expectedLatency = 150;
      mockStop.mockReturnValue(expectedLatency);

      const resolvedValue = { data: "test" };
      const promise = Promise.resolve(resolvedValue);

      const result = await settleService(promise, {
        operationName: "testOperation",
      });

      expect(result).toEqual({
        success: true,
        id: undefined,
        latencyMs: expectedLatency,
      });
    });

    it("should call mapId on successful result", async () => {
      const expectedLatency = 100;
      mockStop.mockReturnValue(expectedLatency);

      const resolvedValue = { recordId: "rec_abc123" };
      const mapId = vi.fn().mockReturnValue("rec_abc123");
      const promise = Promise.resolve(resolvedValue);

      const result = await settleService(promise, {
        operationName: "testOperation",
        mapId,
      });

      expect(mapId).toHaveBeenCalledWith(resolvedValue);
      expect(result).toEqual({
        success: true,
        id: "rec_abc123",
        latencyMs: expectedLatency,
      });
    });
  });

  describe("rejection handling", () => {
    it("should return failure result with latency on rejection", async () => {
      const expectedLatency = 200;
      mockStop.mockReturnValue(expectedLatency);

      const testError = new Error("Connection failed");
      const { withTimeout } = await import("@/lib/lead-pipeline/with-timeout");
      vi.mocked(withTimeout).mockRejectedValue(testError);

      const promise = Promise.resolve({ data: "test" });

      const result = await settleService(promise, {
        operationName: "testOperation",
      });

      expect(result).toEqual({
        success: false,
        error: testError,
        latencyMs: expectedLatency,
      });
    });

    it("should normalize non-Error rejection values", async () => {
      const expectedLatency = 100;
      mockStop.mockReturnValue(expectedLatency);

      const { withTimeout } = await import("@/lib/lead-pipeline/with-timeout");
      vi.mocked(withTimeout).mockRejectedValue("string error");

      const promise = Promise.resolve({ data: "test" });

      const result = await settleService(promise, {
        operationName: "testOperation",
      });

      expect(result.success).toBe(false);
      expect(isServiceFailure(result)).toBe(true);
      if (isServiceFailure(result)) {
        expect(result.error).toBeInstanceOf(Error);
        expect(result.error.message).toBe("string error");
      }
      expect(result.latencyMs).toBe(expectedLatency);
    });
  });

  describe("timeout handling", () => {
    it("should handle timeout from withTimeout", async () => {
      const expectedLatency = 10050;
      mockStop.mockReturnValue(expectedLatency);

      const timeoutError = new Error("testOperation timed out after 10000ms");
      const { withTimeout } = await import("@/lib/lead-pipeline/with-timeout");
      vi.mocked(withTimeout).mockRejectedValue(timeoutError);

      const promise = Promise.resolve({ data: "test" });

      const result = await settleService(promise, {
        operationName: "testOperation",
        timeoutMs: 10000,
      });

      expect(result).toEqual({
        success: false,
        error: timeoutError,
        latencyMs: expectedLatency,
      });
    });

    it("should pass custom timeout to withTimeout", async () => {
      mockStop.mockReturnValue(50);

      const { withTimeout } = await import("@/lib/lead-pipeline/with-timeout");
      const promise = Promise.resolve({ data: "test" });
      const customTimeout = 5000;

      await settleService(promise, {
        operationName: "testOperation",
        timeoutMs: customTimeout,
      });

      expect(withTimeout).toHaveBeenCalledWith(
        promise,
        customTimeout,
        "testOperation",
      );
    });

    it("should use default timeout when not specified", async () => {
      mockStop.mockReturnValue(50);

      const { withTimeout, OPERATION_TIMEOUT_MS } =
        await import("@/lib/lead-pipeline/with-timeout");
      const promise = Promise.resolve({ data: "test" });

      await settleService(promise, {
        operationName: "testOperation",
      });

      expect(withTimeout).toHaveBeenCalledWith(
        promise,
        OPERATION_TIMEOUT_MS,
        "testOperation",
      );
    });
  });

  describe("latency measurement", () => {
    it("measures latency for successful operations", async () => {
      const { createLatencyTimer } = await setupSuccessPath(150);
      const successResult = await settleService(Promise.resolve("success"), {
        operationName: "successOp",
      });

      expect(createLatencyTimer).toHaveBeenCalled();
      expect(mockStop).toHaveBeenCalled();
      expect(successResult.latencyMs).toBe(150);
    });

    it("measures latency for failed operations", async () => {
      const { createLatencyTimer } = await setupFailurePath(
        200,
        new Error("fail"),
      );
      const failureResult = await settleService(Promise.resolve("test"), {
        operationName: "failOp",
      });

      expect(createLatencyTimer).toHaveBeenCalled();
      expect(mockStop).toHaveBeenCalled();
      expect(failureResult.latencyMs).toBe(200);
    });
  });
});
