import { beforeEach, describe, expect, it } from "vitest";
import { I18nPerformanceMonitor } from "@/lib/i18n/performance";

describe("i18n-performance", () => {
  beforeEach(() => {
    I18nPerformanceMonitor.reset();
  });

  it("records load times", () => {
    I18nPerformanceMonitor.recordLoadTime(40);
    I18nPerformanceMonitor.recordLoadTime(60);

    expect(I18nPerformanceMonitor.getMetrics()).toEqual({
      averageLoadTime: 50,
      totalErrors: 0,
    });
  });

  it("tracks errors separately from request counters", () => {
    I18nPerformanceMonitor.recordError();
    I18nPerformanceMonitor.recordError();

    expect(I18nPerformanceMonitor.getMetrics()).toEqual({
      averageLoadTime: 0,
      totalErrors: 2,
    });
  });

  it("reset clears accumulated metrics", () => {
    I18nPerformanceMonitor.recordLoadTime(80);
    I18nPerformanceMonitor.recordError();

    I18nPerformanceMonitor.reset();

    expect(I18nPerformanceMonitor.getMetrics()).toEqual({
      averageLoadTime: 0,
      totalErrors: 0,
    });
  });
});
