/**
 * Lightweight latency timer primitive for lead-pipeline operations.
 */
export function createLatencyTimer(): { stop: () => number } {
  const startTime = Date.now();
  return {
    stop: () => Date.now() - startTime,
  };
}
