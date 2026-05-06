import { z } from "zod";

export const serverEnvSchema = {
  // Email Service (Resend)
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().email().optional(),
  EMAIL_REPLY_TO: z.string().email().optional(),

  // Data Storage (Airtable)
  AIRTABLE_API_KEY: z.string().min(1).optional(),
  AIRTABLE_BASE_ID: z.string().min(1).optional(),
  AIRTABLE_TABLE_NAME: z.string().min(1).optional(),

  // Bot Protection (Cloudflare Turnstile)
  TURNSTILE_SECRET_KEY: z.string().min(1).optional(),
  TURNSTILE_ALLOWED_HOSTS: z.string().optional(),
  TURNSTILE_ALLOWED_ACTIONS: z.string().optional(),
  TURNSTILE_EXPECTED_ACTION: z.string().optional(),
  TURNSTILE_BYPASS: z
    .string()
    .optional()
    .transform((val) => val === "true"),

  // Cloudflare split-worker Server Action compatibility
  NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: z.string().min(1).optional(),

  // Cloudflare analytics and owner dashboard
  CLOUDFLARE_ZONE_ID: z.string().min(1).optional(),
  CLOUDFLARE_ACCOUNT_ID: z.string().min(1).optional(),
  CLOUDFLARE_ANALYTICS_API_TOKEN: z.string().min(1).optional(),
  CLOUDFLARE_ANALYTICS_HOSTNAME: z.string().min(1).optional(),
  OPS_DASHBOARD_ACCESS_KEY: z.string().min(16).optional(),

  // Runtime and platform configuration
  LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).optional(),
  CONTENT_ENABLE_DRAFTS: z
    .string()
    .optional()
    .transform((val) => val === "true"),
  DEPLOYMENT_PLATFORM: z
    .enum(["vercel", "cloudflare", "development", "self-hosted"])
    .optional(),
  VERCEL: z.string().optional(),
  CF_PAGES: z.string().optional(),
  GOOGLE_SITE_VERIFICATION: z.string().min(1).optional(),
  YANDEX_VERIFICATION: z.string().min(1).optional(),

  // Distributed storage and rate limiting
  RATE_LIMIT_PEPPER: z.string().min(1).optional(),
  RATE_LIMIT_PEPPER_PREVIOUS: z.string().min(1).optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  KV_REST_API_URL: z.string().url().optional(),
  KV_REST_API_TOKEN: z.string().min(1).optional(),
  ALLOW_MEMORY_RATE_LIMIT: z
    .string()
    .optional()
    .transform((val) => val === "true"),
  ALLOW_MEMORY_IDEMPOTENCY: z
    .string()
    .optional()
    .transform((val) => val === "true"),

  // Vercel
  VERCEL_URL: z.string().optional(),
  VERCEL_GIT_COMMIT_SHA: z.string().optional(),
  VERCEL_ENV: z.enum(["development", "preview", "production"]).optional(),

  // Node Environment
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  APP_ENV: z
    .enum(["local", "development", "test", "preview", "production"])
    .optional(),
  NEXT_PHASE: z.string().optional(),

  // CI/CD
  CI: z.string().optional(),
  GITHUB_TOKEN: z.string().optional(),
  PLAYWRIGHT_TEST: z
    .string()
    .optional()
    .transform((val) => val === "true"),
  SKIP_ENV_VALIDATION: z
    .string()
    .optional()
    .transform((val) => val === "true"),

  // Security
  SECURITY_HEADERS_ENABLED: z
    .string()
    .default("true")
    .transform((val) => val === "true"),
  CSP_REPORT_URI: z.string().url().optional(),
  CORS_ALLOWED_ORIGINS: z.string().optional(),
};

export const clientEnvSchema = {
  // Base Configuration
  NEXT_PUBLIC_BASE_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
  NEXT_PUBLIC_WEBSITE_BASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_WEBSITE_SECONDARY_BASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_APP_NAME: z.string().default("Example Showcase Company"),
  NEXT_PUBLIC_APP_VERSION: z.string().default("1.0.0"),
  NEXT_PUBLIC_SITE_KEY: z.string().default("showcase"),

  // Analytics & Monitoring
  NEXT_PUBLIC_VERCEL_ANALYTICS_ID: z.string().optional(),
  NEXT_PUBLIC_GA_MEASUREMENT_ID: z.string().optional(),
  NEXT_PUBLIC_ENABLE_ANALYTICS_PRECONNECT: z
    .string()
    .optional()
    .transform((val) => val === "true"),

  // Bot Protection (Cloudflare Turnstile Public Key)
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().optional(),
  NEXT_PUBLIC_TURNSTILE_ACTION: z.string().optional(),
  NEXT_PUBLIC_TURNSTILE_BYPASS: z
    .string()
    .default("false")
    .transform((val) => val === "true"),

  // Feature Flags
  NEXT_PUBLIC_ENABLE_ANALYTICS: z
    .string()
    .default("true")
    .transform((val) => val === "true"),
  NEXT_PUBLIC_ENABLE_ERROR_REPORTING: z
    .string()
    .default("true")
    .transform((val) => val === "true"),
  NEXT_PUBLIC_ENABLE_PERFORMANCE_MONITORING: z
    .string()
    .default("true")
    .transform((val) => val === "true"),

  // Development Tools
  NEXT_PUBLIC_DISABLE_REACT_SCAN: z
    .string()
    .default("false")
    .transform((val) => val === "true"),
  NEXT_PUBLIC_DISABLE_DEV_TOOLS: z
    .string()
    .default("false")
    .transform((val) => val === "true"),
  NEXT_PUBLIC_TEST_MODE: z
    .string()
    .default("false")
    .transform((val) => val === "true"),

  // Internationalization
  NEXT_PUBLIC_DEFAULT_LOCALE: z.string().default("en"),
  NEXT_PUBLIC_SUPPORTED_LOCALES: z.string().default("en,zh"),
  NEXT_PUBLIC_ENABLE_CN_FONT_SUBSET: z
    .string()
    .optional()
    .transform((val) => val === "true"),

  // Security
  NEXT_PUBLIC_SECURITY_MODE: z
    .enum(["strict", "moderate", "relaxed"])
    .default("strict"),

  // UI tuning
  NEXT_PUBLIC_NAV_VARIANT: z.string().optional(),
  NEXT_PUBLIC_CONTACT_FORM_COOLDOWN_MS: z.coerce.number().optional(),

  // Deployment Platform
  NEXT_PUBLIC_DEPLOYMENT_PLATFORM: z
    .enum(["vercel", "cloudflare", "development", "self-hosted"])
    .optional(),
};
