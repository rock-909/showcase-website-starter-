import { CACHE_LIMITS } from "@/constants/i18n-constants";

// 性能监控
export class I18nPerformanceMonitor {
  private static metrics = {
    loadTime: [] as number[],
    errors: 0,
  };

  static recordLoadTime(time: number): void {
    this.metrics.loadTime.push(time);
    // 保持最近记录数量限制
    if (this.metrics.loadTime.length > CACHE_LIMITS.MAX_CACHE_ENTRIES) {
      this.metrics.loadTime.shift();
    }
  }

  static recordError(): void {
    this.metrics.errors += 1;
  }

  static getMetrics() {
    const loadTimes = this.metrics.loadTime;
    const avgLoadTime =
      loadTimes.length > 0
        ? loadTimes.reduce((a, b) => a + b, 0) / loadTimes.length
        : 0;

    return {
      averageLoadTime: avgLoadTime,
      totalErrors: this.metrics.errors,
    };
  }

  static reset(): void {
    this.metrics = {
      loadTime: [],
      errors: 0,
    };
  }
}
