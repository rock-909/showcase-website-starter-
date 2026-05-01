/**
 * With Timeout Tests
 * Tests for promise timeout helper
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { withTimeout } from "../with-timeout";

describe("withTimeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("should resolve with value when promise completes before timeout", async () => {
    const expectedValue = { data: "test-result" };

    // Use real timers for this test since we need actual async behavior
    vi.useRealTimers();

    const promise = Promise.resolve(expectedValue);
    const result = await withTimeout(promise, 1000, "testOperation");

    expect(result).toEqual(expectedValue);
  });

  it("should reject with timeout error when timeout elapses first", async () => {
    // Create a promise that never resolves
    const neverResolves = new Promise(() => {});

    const resultPromise = withTimeout(neverResolves, 500, "slowOperation");

    // Advance timers to trigger timeout
    vi.advanceTimersByTime(500);

    await expect(resultPromise).rejects.toThrow(
      "slowOperation timed out after 500ms",
    );
  });

  it("should preserve original error when promise rejects before timeout", async () => {
    vi.useRealTimers();

    const originalError = new Error("Original failure reason");
    const promise = Promise.reject(originalError);

    await expect(
      withTimeout(promise, 1000, "failingOperation"),
    ).rejects.toThrow("Original failure reason");
  });

  it("should include operation name and timeout value in error message", async () => {
    const neverResolves = new Promise(() => {});

    const resultPromise = withTimeout(
      neverResolves,
      1500,
      "airtableSubmission",
    );

    vi.advanceTimersByTime(1500);

    try {
      await resultPromise;
      expect.fail("Expected promise to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      const errorMessage = (error as Error).message;
      expect(errorMessage).toContain("airtableSubmission");
      expect(errorMessage).toContain("1500ms");
    }
  });

  it("should handle immediate resolution", async () => {
    vi.useRealTimers();

    const expectedValue = "immediate-result";
    const promise = Promise.resolve(expectedValue);

    const result = await withTimeout(promise, 1000, "instantOperation");
    expect(result).toBe(expectedValue);
  });

  it("should handle zero timeout edge case", async () => {
    const neverResolves = new Promise(() => {});

    const resultPromise = withTimeout(neverResolves, 0, "zeroTimeoutOperation");

    vi.advanceTimersByTime(0);

    await expect(resultPromise).rejects.toThrow(
      "zeroTimeoutOperation timed out after 0ms",
    );
  });
});
