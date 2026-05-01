import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { retryAsync } from "../retry-async";

async function flushRetryLoop(ms: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
  await Promise.resolve();
}

describe("retryAsync", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns immediately when the first attempt succeeds", async () => {
    const fn = vi.fn().mockResolvedValue("ok");

    await expect(
      retryAsync(fn, { maxRetries: 2, baseDelayMs: 100 }),
    ).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries with exponential backoff until a later attempt succeeds", async () => {
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("first"))
      .mockRejectedValueOnce(new Error("second"))
      .mockResolvedValueOnce("ok");

    const promise = retryAsync(fn, { maxRetries: 2, baseDelayMs: 100 });
    await Promise.resolve();

    expect(fn).toHaveBeenCalledTimes(1);

    await flushRetryLoop(100);
    expect(fn).toHaveBeenCalledTimes(2);

    await flushRetryLoop(199);
    expect(fn).toHaveBeenCalledTimes(2);

    await flushRetryLoop(1);
    await expect(promise).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("throws the last error after exhausting all retries", async () => {
    const finalError = new Error("still failing");
    const fn = vi.fn().mockRejectedValue(finalError);

    const promise = retryAsync(fn, { maxRetries: 2, baseDelayMs: 50 });
    const assertion = expect(promise).rejects.toBe(finalError);
    await Promise.resolve();

    await flushRetryLoop(50);
    await flushRetryLoop(100);

    await assertion;
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("normalizes non-Error rejections into an Error on the last attempt", async () => {
    const fn = vi.fn().mockRejectedValue("boom");

    const promise = retryAsync(fn, { maxRetries: 1, baseDelayMs: 25 });
    const assertion = expect(promise).rejects.toThrow("boom");
    await Promise.resolve();
    await flushRetryLoop(25);

    await assertion;
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("does not schedule retries when maxRetries is zero", async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const error = new Error("no retries");
    const fn = vi.fn().mockRejectedValue(error);

    await expect(
      retryAsync(fn, { maxRetries: 0, baseDelayMs: 25 }),
    ).rejects.toBe(error);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(setTimeoutSpy).not.toHaveBeenCalled();
  });

  it("uses the default base delay when one is not provided", async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("first"))
      .mockResolvedValueOnce("ok");

    const promise = retryAsync(fn, { maxRetries: 1 });
    await Promise.resolve();

    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 1000);

    await flushRetryLoop(999);
    expect(fn).toHaveBeenCalledTimes(1);

    await flushRetryLoop(1);
    await expect(promise).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("schedules exponential delays for each retry attempt", async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const fn = vi.fn().mockRejectedValue(new Error("still failing"));
    const promise = retryAsync(fn, { maxRetries: 2, baseDelayMs: 100 });
    const assertion = expect(promise).rejects.toThrow("still failing");

    await Promise.resolve();
    await flushRetryLoop(100);
    await flushRetryLoop(200);

    await assertion;
    expect(setTimeoutSpy).toHaveBeenNthCalledWith(1, expect.any(Function), 100);
    expect(setTimeoutSpy).toHaveBeenNthCalledWith(2, expect.any(Function), 200);
  });
});
