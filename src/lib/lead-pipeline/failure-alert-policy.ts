import { COUNT_FIVE, TEN_SECONDS_MS } from "@/constants";

/**
 * Alert configuration for consecutive service failures.
 */
export interface AlertConfig {
  consecutiveFailureThreshold: number;
  alertCooldownMs: number;
}

export const DEFAULT_ALERT_CONFIG: AlertConfig = {
  consecutiveFailureThreshold: COUNT_FIVE,
  alertCooldownMs: TEN_SECONDS_MS,
};

/**
 * Mutable state tracked per downstream service.
 */
export interface FailureState {
  consecutiveFailures: number;
  lastAlertTimestamp: number;
}

export function createInitialFailureState(): FailureState {
  return { consecutiveFailures: 0, lastAlertTimestamp: 0 };
}

export function shouldTriggerAlert(
  state: FailureState,
  config: AlertConfig,
  now: number,
): boolean {
  const meetsThreshold =
    state.consecutiveFailures >= config.consecutiveFailureThreshold;
  const cooldownExpired =
    now - state.lastAlertTimestamp >= config.alertCooldownMs;

  return meetsThreshold && cooldownExpired;
}
