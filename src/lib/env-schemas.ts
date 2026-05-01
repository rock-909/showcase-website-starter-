import { z } from "zod";

export const serverEnvSchema = {
  // Database
  DATABASE_URL: z.string().url().optional(),

  // Authentication
  NEXTAUTH_SECRET: z.string().min(1).optional(),
  NEXTAUTH_URL: z.string().url().optional(),

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

  // Admin & automation secrets
  ADMIN_API_TOKEN: z.string().min(1).optional(),
  CACHE_INVALIDATION_SECRET: z.string().min(1).optional(),
  NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: z.string().min(1).optional(),

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

  // AI Translation Service (Lingo.dev)
  LINGO_DEV_API_KEY: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
  GROQ_API_KEY: z.string().min(1).optional(),
  GOOGLE_API_KEY: z.string().min(1).optional(),
  MISTRAL_API_KEY: z.string().min(1).optional(),

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

  // Network & API Configuration
  API_TIMEOUT: z.coerce.number().optional(),
  UPLOAD_TIMEOUT: z.coerce.number().optional(),
  WEBSOCKET_TIMEOUT: z.coerce.number().optional(),
  HEALTH_CHECK_TIMEOUT: z.coerce.number().optional(),

  // Retry Configuration
  DEFAULT_RETRIES: z.coerce.number().optional(),
  API_RETRIES: z.coerce.number().optional(),
  UPLOAD_RETRIES: z.coerce.number().optional(),
  RETRY_DELAY_BASE: z.coerce.number().optional(),

  // Rate Limiting
  API_REQUESTS_PER_MINUTE: z.coerce.number().optional(),
  UPLOADS_PER_HOUR: z.coerce.number().optional(),
  CONTACT_FORMS_PER_HOUR: z.coerce.number().optional(),

  // Development Server Ports
  PORT: z.coerce.number().optional(),
  API_PORT: z.coerce.number().optional(),
  DEV_TOOLS_PORT: z.coerce.number().optional(),
  TEST_PORT: z.coerce.number().optional(),
  MONITORING_PORT: z.coerce.number().optional(),
  API_MONITORING_PORT: z.coerce.number().optional(),

  // Development Experience
  HOT_RELOAD_DELAY: z.coerce.number().optional(),
  FILE_WATCH_DEBOUNCE: z.coerce.number().optional(),
  DEV_TOOLS_REFRESH_INTERVAL: z.coerce.number().optional(),

  // Cache Configuration
  STATIC_CACHE_TTL: z.coerce.number().optional(),
  API_CACHE_TTL: z.coerce.number().optional(),
  SESSION_CACHE_TTL: z.coerce.number().optional(),
  I18N_CACHE_TTL: z.coerce.number().optional(),

  // Memory Limits
  MAX_UPLOAD_SIZE: z.coerce.number().optional(),
  MAX_REQUEST_SIZE: z.coerce.number().optional(),
  MAX_CACHE_SIZE: z.coerce.number().optional(),
  MAX_LOG_SIZE: z.coerce.number().optional(),

  // Performance Monitoring
  PERFORMANCE_SAMPLE_RATE: z.coerce.number().optional(),
  ERROR_SAMPLE_RATE: z.coerce.number().optional(),
  MONITORING_INTERVAL: z.coerce.number().optional(),
  HEALTH_CHECK_INTERVAL: z.coerce.number().optional(),

  // Web Vitals Thresholds
  LCP_GOOD_THRESHOLD: z.coerce.number().optional(),
  FID_GOOD_THRESHOLD: z.coerce.number().optional(),
  CLS_GOOD_THRESHOLD: z.coerce.number().optional(),
  TTFB_GOOD_THRESHOLD: z.coerce.number().optional(),

  // Security Configuration
  JWT_EXPIRES_IN: z.coerce.number().optional(),
  BCRYPT_ROUNDS: z.coerce.number().optional(),
  CSRF_TOKEN_LENGTH: z.coerce.number().optional(),
  SESSION_TIMEOUT: z.coerce.number().optional(),

  // Feature Flags
  ENABLE_PERFORMANCE_MONITORING: z
    .string()
    .transform((val) => val === "true")
    .optional(),
  ENABLE_ERROR_TRACKING: z
    .string()
    .transform((val) => val === "true")
    .optional(),
  ENABLE_AB_TESTING: z
    .string()
    .transform((val) => val === "true")
    .optional(),
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
