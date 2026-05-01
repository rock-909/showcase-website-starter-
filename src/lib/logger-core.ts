/* eslint-disable no-console -- logger intentionally wraps console.* with env-based filtering */
/**
 * Lightweight logger utility with production-safe behavior.
 * - error/warn: Always output for production diagnostics
 * - info: Respects LOG_LEVEL
 * - debug/log: Development and test only
 */

import {
  getRuntimeEnvString,
  isRuntimeDevelopment,
  isRuntimeTest,
} from "@/lib/env";

type LogArgs = [message?: unknown, ...optionalParams: unknown[]];

type LogLevel = "error" | "warn" | "info" | "debug";

const LOG_LEVELS: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

function isDev(): boolean {
  return isRuntimeDevelopment() || isRuntimeTest();
}

function isValidLogLevel(value: string): value is LogLevel {
  return Object.prototype.hasOwnProperty.call(LOG_LEVELS, value);
}

function getLogLevel(): LogLevel {
  const rawLevel = getRuntimeEnvString("LOG_LEVEL");
  const level = rawLevel?.toLowerCase() as LogLevel | undefined;
  if (level && isValidLogLevel(level)) {
    return level;
  }
  return isDev() ? "debug" : "warn";
}

function shouldLog(level: LogLevel): boolean {
  if (level === "error" || level === "warn") {
    return true;
  }
  if (level === "debug" && !isDev()) {
    return false;
  }
  return LOG_LEVELS[level] <= LOG_LEVELS[getLogLevel()];
}

export const logger = {
  debug: (...args: LogArgs) => {
    if (shouldLog("debug")) {
      console.debug(...args);
    }
  },
  info: (...args: LogArgs) => {
    if (shouldLog("info")) {
      console.info(...args);
    }
  },
  log: (...args: LogArgs) => {
    if (shouldLog("debug")) {
      console.log(...args);
    }
  },
  warn: (...args: LogArgs) => {
    if (shouldLog("warn")) {
      console.warn(...args);
    }
  },
  error: (...args: LogArgs) => {
    if (shouldLog("error")) {
      console.error(...args);
    }
  },
};

export type Logger = typeof logger;
