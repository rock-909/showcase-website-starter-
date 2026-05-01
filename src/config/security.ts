import { COUNT_TWO, HEX_RADIX } from "../constants/count";
import { ZERO } from "../constants/core";
import {
  getRuntimeEnvBoolean,
  getRuntimeEnvString,
  isRuntimeDevelopment,
  isRuntimeProduction,
  isRuntimeTest,
} from "../lib/env";

export type SecurityHeader = {
  key: string;
  value: string;
};

/**
 * Security configuration for the application
 * Includes CSP, security headers, and other security-related settings
 */

/**
 * Content Security Policy configuration
 */
export function generateCSP(nonce?: string): string {
  const isDevelopment = isRuntimeDevelopment();
  const isProduction = isRuntimeProduction();
  const configuredReportUri = getRuntimeEnvString("CSP_REPORT_URI")?.trim();
  const reportUri =
    configuredReportUri && configuredReportUri.length > ZERO
      ? configuredReportUri
      : "/api/csp-report";

  // Base CSP directives
  const cspDirectives = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      // Allow inline scripts with nonce in production, unsafe-inline in development
      ...(isDevelopment
        ? ["'unsafe-inline'", "'unsafe-eval'", "https://unpkg.com"]
        : []),
      ...(nonce ? [`'nonce-${nonce}'`] : []),
      // Vercel Analytics
      "https://va.vercel-scripts.com",
      // Cloudflare Turnstile
      "https://challenges.cloudflare.com",
      // Google Analytics (if enabled)
      "https://www.googletagmanager.com",
      "https://www.google-analytics.com",
    ],
    // App Router static/prerendered responses still emit inline framework/data
    // scripts that cannot receive a request nonce. Keep `script-src` strict for
    // non-<script> execution paths, but explicitly allow inline <script> blocks
    // so prerendered routes hydrate correctly under CSP.
    "script-src-elem": [
      "'self'",
      "'unsafe-inline'",
      ...(isDevelopment ? ["'unsafe-eval'", "https://unpkg.com"] : []),
      "https://va.vercel-scripts.com",
      "https://challenges.cloudflare.com",
      "https://www.googletagmanager.com",
      "https://www.google-analytics.com",
    ],
    "style-src": [
      "'self'",
      // Allow unsafe-inline for Tailwind CSS (required for both dev and prod)
      "'unsafe-inline'",
      ...(nonce ? [`'nonce-${nonce}'`] : []),
      "https://fonts.googleapis.com",
    ],
    // Runtime style tags injected by framework/client libraries cannot reliably
    // receive a request nonce on prerendered routes. Keep element-level policy
    // explicit so browsers don't ignore `unsafe-inline` via the fallback list.
    "style-src-elem": [
      "'self'",
      "'unsafe-inline'",
      "https://fonts.googleapis.com",
    ],
    // The app intentionally renders style attributes in several server components
    // (grid decorations, responsive placeholders, and streamed fallback shells).
    // Make this explicit to stop browsers from treating style attributes as an
    // implicit fallback violation.
    "style-src-attr": ["'unsafe-inline'"],
    "img-src": [
      "'self'",
      "data:",
      "https:",
      // Vercel Analytics
      "https://va.vercel-scripts.com",
      // External image sources
      "https://images.unsplash.com",
      "https://via.placeholder.com",
      // Google Analytics
      "https://www.google-analytics.com",
      "https://www.googletagmanager.com",
    ],
    "font-src": ["'self'", "data:", "https://fonts.gstatic.com"],
    "connect-src": [
      "'self'",
      // Vercel Analytics
      "https://vitals.vercel-insights.com",
      // API endpoints
      ...(isDevelopment ? ["http://localhost:*", "ws://localhost:*"] : []),
      // External APIs
      "https://api.resend.com",
      // Google Analytics
      "https://www.google-analytics.com",
      "https://analytics.google.com",
      "https://region1.google-analytics.com",
    ],
    "frame-src": [
      // Cloudflare Turnstile (removed 'none' - conflicts with allowlist)
      "https://challenges.cloudflare.com",
    ],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
    "report-uri": [reportUri],
    "upgrade-insecure-requests": isProduction ? [] : undefined,
  };

  // Convert directives to CSP string
  return Object.entries(cspDirectives)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => {
      if (Array.isArray(value) && value.length > ZERO) {
        return `${key} ${value.join(" ")}`;
      }
      return key;
    })
    .join("; ");
}

/**
 * Security headers configuration
 */
export function isSecurityHeadersEnabled(testMode = false): boolean {
  if (testMode) {
    return getRuntimeEnvBoolean("SECURITY_HEADERS_ENABLED") !== false;
  }

  if (isRuntimeTest()) {
    return getRuntimeEnvBoolean("SECURITY_HEADERS_ENABLED") !== false;
  }

  return getRuntimeEnvBoolean("SECURITY_HEADERS_ENABLED") !== false;
}

export function getSecurityHeaders(
  nonce?: string,
  testMode = false,
): SecurityHeader[] {
  if (!isSecurityHeadersEnabled(testMode)) {
    return [];
  }

  const securityConfig = getSecurityConfig(testMode);
  const cspHeaderKey = securityConfig.cspReportOnly
    ? "Content-Security-Policy-Report-Only"
    : "Content-Security-Policy";

  return [
    // Prevent clickjacking
    {
      key: "X-Frame-Options",
      value: "DENY",
    },
    // Prevent MIME type sniffing
    {
      key: "X-Content-Type-Options",
      value: "nosniff",
    },
    // Referrer policy
    {
      key: "Referrer-Policy",
      value: "strict-origin-when-cross-origin",
    },
    // HSTS (HTTP Strict Transport Security)
    {
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    },
    // Content Security Policy (enforced or report-only based on security mode)
    {
      key: cspHeaderKey,
      value: generateCSP(nonce),
    },
    // Permissions Policy (formerly Feature Policy)
    {
      key: "Permissions-Policy",
      value: [
        "camera=()",
        "microphone=()",
        "geolocation=()",
        "interest-cohort=()",
        "payment=()",
        "usb=()",
      ].join(", "),
    },
    // Cross-Origin policies
    {
      key: "Cross-Origin-Embedder-Policy",
      value: "unsafe-none", // Changed from require-corp for compatibility
    },
    {
      key: "Cross-Origin-Opener-Policy",
      value: "same-origin",
    },
    {
      key: "Cross-Origin-Resource-Policy",
      value: "cross-origin",
    },
  ];
}

/**
 * Generate a cryptographically secure nonce for CSP
 *
 * Requirements:
 * - Minimum 128 bits (16 bytes) entropy per OWASP best practices
 * - 32 hex characters output for CSP compatibility
 * - Must pass isValidNonce validation
 */
const NONCE_BYTE_LENGTH = HEX_RADIX; // 16 bytes = 128 bits = 32 hex characters
const NONCE_HEX_PAD = COUNT_TWO;

export function generateNonce(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    // randomUUID returns 36 chars with hyphens, removing hyphens gives 32 hex chars
    // Use full 32 chars for 128-bit entropy
    return crypto.randomUUID().replace(/-/g, "");
  }

  if (
    typeof crypto !== "undefined" &&
    typeof crypto.getRandomValues === "function"
  ) {
    const bytes = new Uint8Array(NONCE_BYTE_LENGTH);
    crypto.getRandomValues(bytes);
    // Convert to hex: 16 bytes = 32 hex characters = 128 bits
    return Array.from(bytes, (value) =>
      value.toString(HEX_RADIX).padStart(NONCE_HEX_PAD, "0"),
    ).join("");
  }

  throw new Error("Secure nonce generation unavailable");
}

/**
 * Security mode configuration
 */
export const SECURITY_MODES = {
  strict: {
    cspReportOnly: false,
    enforceHTTPS: true,
    strictTransportSecurity: true,
    contentTypeOptions: true,
    frameOptions: "DENY",
    xssProtection: true,
  },
  moderate: {
    cspReportOnly: false,
    enforceHTTPS: true,
    strictTransportSecurity: true,
    contentTypeOptions: true,
    frameOptions: "SAMEORIGIN",
    xssProtection: true,
  },
  relaxed: {
    cspReportOnly: true,
    enforceHTTPS: false,
    strictTransportSecurity: false,
    contentTypeOptions: true,
    frameOptions: "SAMEORIGIN",
    xssProtection: false,
  },
} as const;

/**
 * Get security configuration based on mode
 */
export function getSecurityConfig(_testMode = false) {
  const rawMode = getRuntimeEnvString("NEXT_PUBLIC_SECURITY_MODE") || "strict";

  const mode =
    rawMode === "moderate" || rawMode === "relaxed" ? rawMode : "strict";

  switch (mode) {
    case "moderate":
      return SECURITY_MODES.moderate;
    case "relaxed":
      return SECURITY_MODES.relaxed;
    case "strict":
    default:
      return SECURITY_MODES.strict;
  }
}

/**
 * Validate CSP nonce (128-bit minimum entropy)
 */
export function isValidNonce(nonce: string): boolean {
  // Nonce should be at least 32 characters (128 bits) and contain only alphanumeric characters
  return /^[a-zA-Z0-9]{32,}$/.test(nonce);
}

/**
 * CSP report endpoint handler type
 */
export interface CSPReport {
  "csp-report": {
    "document-uri": string;
    referrer: string;
    "violated-directive": string;
    "effective-directive": string;
    "original-policy": string;
    disposition: string;
    "blocked-uri": string;
    "line-number": number;
    "column-number": number;
    "source-file": string;
    "status-code": number;
    "script-sample": string;
  };
}

/**
 * Security utilities
 */
export const SecurityUtils = {
  generateCSP,
  getSecurityHeaders,
  generateNonce,
  getSecurityConfig,
  isValidNonce,
} as const;
