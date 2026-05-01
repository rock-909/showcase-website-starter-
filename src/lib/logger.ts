/**
 * Logger facade.
 *
 * Client code should import `logger` from `@/lib/logger-core` so browser chunks
 * do not carry server-only PII sanitizers. Server code can keep using this
 * facade when it needs logger plus sanitization helpers.
 */
export { logger, type Logger } from "@/lib/logger-core";

/**
 * PII sanitization utilities for production logging
 * Replaces sensitive data with safe identifiers
 */

const IP_V4_PATTERN = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
const IP_V6_PATTERN = /^[a-fA-F0-9:]+$/;

/**
 * Sanitize email for logging - fully redacts to avoid PII leakage
 * Returns "[REDACTED_EMAIL]" for any provided value
 */
export function sanitizeEmail(email: string | undefined | null): string {
  if (!email) return "[NO_EMAIL]";
  return "[REDACTED_EMAIL]";
}

/**
 * Sanitize IP address for logging
 * Returns "[REDACTED_IP]" to prevent tracking
 */
export function sanitizeIP(ip: string | undefined | null): string {
  if (!ip) return "[NO_IP]";
  if (IP_V4_PATTERN.test(ip) || IP_V6_PATTERN.test(ip) || ip === "::1") {
    return "[REDACTED_IP]";
  }
  return "[REDACTED_IP]";
}

/**
 * Sanitize company name for logging
 * Returns "[REDACTED]" to prevent PII exposure
 */
export function sanitizeCompany(company: string | undefined | null): string {
  if (!company) return "[NO_COMPANY]";
  return "[REDACTED]";
}

/**
 * Sanitize phone number for logging
 * Keeps first 3 chars and last 4 digits, masks middle
 */
export function sanitizePhone(phone: string | undefined | null): string {
  if (!phone) return "[NO_PHONE]";
  const s = String(phone).replace(/\s/g, "");
  if (s.length <= 7) return "[PHONE]";
  return `${s.slice(0, 3)}****${s.slice(s.length - 4)}`;
}

/**
 * Sanitize log context object by replacing PII fields
 */
export function sanitizeLogContext<T extends Record<string, unknown>>(
  context: T,
): Record<string, unknown> {
  // nosemgrep: object-injection-sink-spread-operator
  // Safe: context is internal logging data passed by application code, not user input
  const sanitized: Record<string, unknown> = { ...context };

  if ("email" in sanitized && typeof sanitized.email === "string") {
    sanitized.email = sanitizeEmail(sanitized.email);
  }
  if ("ip" in sanitized && typeof sanitized.ip === "string") {
    sanitized.ip = sanitizeIP(sanitized.ip);
  }
  if ("company" in sanitized && typeof sanitized.company === "string") {
    sanitized.company = sanitizeCompany(sanitized.company);
  }
  if ("phone" in sanitized && typeof sanitized.phone === "string") {
    sanitized.phone = sanitizePhone(sanitized.phone);
  }
  if ("from" in sanitized && typeof sanitized.from === "string") {
    sanitized.from = sanitizeEmail(sanitized.from);
  }
  if ("to" in sanitized && typeof sanitized.to === "string") {
    sanitized.to = sanitizeEmail(sanitized.to);
  }

  return sanitized;
}
