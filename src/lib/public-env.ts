/**
 * Browser-safe runtime env helpers.
 *
 * Client Components must not import "@/lib/env" because that facade also owns
 * server-only schema and raw runtime mappings. Keep public reads here with
 * static process.env property access so Next.js can inline NEXT_PUBLIC values.
 */

const PUBLIC_RUNTIME_ENV_READERS = {
  NODE_ENV: () => process.env.NODE_ENV,
  NEXT_PUBLIC_BASE_URL: () => process.env.NEXT_PUBLIC_BASE_URL,
  NEXT_PUBLIC_SITE_URL: () => process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_WEBSITE_BASE_URL: () => process.env.NEXT_PUBLIC_WEBSITE_BASE_URL,
  NEXT_PUBLIC_WEBSITE_SECONDARY_BASE_URL: () =>
    process.env.NEXT_PUBLIC_WEBSITE_SECONDARY_BASE_URL,
  NEXT_PUBLIC_APP_NAME: () => process.env.NEXT_PUBLIC_APP_NAME,
  NEXT_PUBLIC_APP_VERSION: () => process.env.NEXT_PUBLIC_APP_VERSION,
  NEXT_PUBLIC_SITE_KEY: () => process.env.NEXT_PUBLIC_SITE_KEY,
  NEXT_PUBLIC_VERCEL_ANALYTICS_ID: () =>
    process.env.NEXT_PUBLIC_VERCEL_ANALYTICS_ID,
  NEXT_PUBLIC_GA_MEASUREMENT_ID: () =>
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
  NEXT_PUBLIC_ENABLE_ANALYTICS_PRECONNECT: () =>
    process.env.NEXT_PUBLIC_ENABLE_ANALYTICS_PRECONNECT,
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: () =>
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  NEXT_PUBLIC_TURNSTILE_ACTION: () => process.env.NEXT_PUBLIC_TURNSTILE_ACTION,
  NEXT_PUBLIC_TURNSTILE_BYPASS: () => process.env.NEXT_PUBLIC_TURNSTILE_BYPASS,
  NEXT_PUBLIC_ENABLE_ANALYTICS: () => process.env.NEXT_PUBLIC_ENABLE_ANALYTICS,
  NEXT_PUBLIC_ENABLE_ERROR_REPORTING: () =>
    process.env.NEXT_PUBLIC_ENABLE_ERROR_REPORTING,
  NEXT_PUBLIC_ENABLE_PERFORMANCE_MONITORING: () =>
    process.env.NEXT_PUBLIC_ENABLE_PERFORMANCE_MONITORING,
  NEXT_PUBLIC_DISABLE_REACT_SCAN: () =>
    process.env.NEXT_PUBLIC_DISABLE_REACT_SCAN,
  NEXT_PUBLIC_DISABLE_DEV_TOOLS: () =>
    process.env.NEXT_PUBLIC_DISABLE_DEV_TOOLS,
  NEXT_PUBLIC_TEST_MODE: () => process.env.NEXT_PUBLIC_TEST_MODE,
  NEXT_PUBLIC_DEFAULT_LOCALE: () => process.env.NEXT_PUBLIC_DEFAULT_LOCALE,
  NEXT_PUBLIC_SUPPORTED_LOCALES: () =>
    process.env.NEXT_PUBLIC_SUPPORTED_LOCALES,
  NEXT_PUBLIC_ENABLE_CN_FONT_SUBSET: () =>
    process.env.NEXT_PUBLIC_ENABLE_CN_FONT_SUBSET,
  NEXT_PUBLIC_SECURITY_MODE: () => process.env.NEXT_PUBLIC_SECURITY_MODE,
  NEXT_PUBLIC_NAV_VARIANT: () => process.env.NEXT_PUBLIC_NAV_VARIANT,
  NEXT_PUBLIC_CONTACT_FORM_COOLDOWN_MS: () =>
    process.env.NEXT_PUBLIC_CONTACT_FORM_COOLDOWN_MS,
  NEXT_PUBLIC_DEPLOYMENT_PLATFORM: () =>
    process.env.NEXT_PUBLIC_DEPLOYMENT_PLATFORM,
} as const satisfies Record<string, () => string | undefined>;

export type PublicRuntimeEnvKey = keyof typeof PUBLIC_RUNTIME_ENV_READERS;

export function getPublicRuntimeEnvString(
  key: PublicRuntimeEnvKey,
): string | undefined {
  return PUBLIC_RUNTIME_ENV_READERS[key]();
}

export function getPublicRuntimeEnvBoolean(
  key: PublicRuntimeEnvKey,
): boolean | undefined {
  const value = getPublicRuntimeEnvString(key);

  if (value === undefined) {
    return undefined;
  }

  return value === "true";
}

export function getPublicRuntimeEnvNumber(
  key: PublicRuntimeEnvKey,
): number | undefined {
  const value = getPublicRuntimeEnvString(key);

  if (value === undefined) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function isPublicRuntimeDevelopment(): boolean {
  return getPublicRuntimeEnvString("NODE_ENV") === "development";
}

export function isPublicRuntimeProduction(): boolean {
  return getPublicRuntimeEnvString("NODE_ENV") === "production";
}

export function isPublicRuntimeTest(): boolean {
  return getPublicRuntimeEnvString("NODE_ENV") === "test";
}
