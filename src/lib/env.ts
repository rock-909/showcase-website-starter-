/**
 * 环境变量模块（单一真相源）
 *
 * 约束：生产/测试代码统一从 `@/lib/env` 导入，避免出现多套 schema/mock 分叉。
 */

import { createEnv } from "@t3-oss/env-nextjs";
import { clientEnvSchema, serverEnvSchema } from "./env-schemas";
import {
  readRawEnvValue,
  runtimeEnv,
  shouldSkipEnvValidation,
} from "./env-runtime";

// 创建类型安全的环境变量配置
export const env = createEnv({
  server: serverEnvSchema,
  client: clientEnvSchema,
  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv,
  /**
   * Run `build` or `dev` with SKIP_ENV_VALIDATION to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: shouldSkipEnvValidation(),
  /**
   * Makes it so that empty strings are treated as undefined.
   * `SOME_VAR: z.string()` and `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});

// 提供类型安全的环境变量访问函数
export function getEnvVar(
  key: keyof typeof env,
): string | boolean | number | undefined {
  return env[key];
}

function readProcessEnvValue(key: keyof typeof env): string | undefined {
  return readRawEnvValue(key);
}

function readValidatedEnvValue(key: keyof typeof env) {
  try {
    return env[key];
  } catch {
    return undefined;
  }
}

type RuntimeNodeEnv = "development" | "test" | "production";
type RuntimeAppEnv =
  | "local"
  | "development"
  | "test"
  | "preview"
  | "production";

function coerceRuntimeNodeEnv(
  value: string | undefined,
): RuntimeNodeEnv | undefined {
  if (value === "development" || value === "test" || value === "production") {
    return value;
  }
  return undefined;
}

function coerceRuntimeAppEnv(
  value: string | undefined,
): RuntimeAppEnv | undefined {
  if (
    value === "local" ||
    value === "development" ||
    value === "test" ||
    value === "preview" ||
    value === "production"
  ) {
    return value;
  }
  return undefined;
}

export function getRuntimeEnvString(key: keyof typeof env): string | undefined {
  const runtimeValue = readProcessEnvValue(key);
  if (runtimeValue !== undefined) {
    return runtimeValue;
  }

  const value = readValidatedEnvValue(key);
  return typeof value === "string" ? value : undefined;
}

export function getRuntimeEnvBoolean(
  key: keyof typeof env,
): boolean | undefined {
  const runtimeValue = readProcessEnvValue(key);
  if (runtimeValue !== undefined) {
    return runtimeValue === "true";
  }

  const value = readValidatedEnvValue(key);
  return typeof value === "boolean" ? value : undefined;
}

export function getRuntimeEnvNumber(key: keyof typeof env): number | undefined {
  const runtimeValue = readProcessEnvValue(key);
  if (runtimeValue !== undefined) {
    const parsed = Number(runtimeValue);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  const value = readValidatedEnvValue(key);
  return typeof value === "number" ? value : undefined;
}

export function getRuntimeNodeEnv(): RuntimeNodeEnv | undefined {
  return coerceRuntimeNodeEnv(getRuntimeEnvString("NODE_ENV"));
}

export function getRuntimeAppEnv(): RuntimeAppEnv | undefined {
  return coerceRuntimeAppEnv(getRuntimeEnvString("APP_ENV"));
}

export function isRuntimeDevelopment(): boolean {
  return getRuntimeNodeEnv() === "development";
}

export function isRuntimeProduction(): boolean {
  return getRuntimeNodeEnv() === "production";
}

export function isRuntimeTest(): boolean {
  return getRuntimeNodeEnv() === "test";
}

export function isRuntimeCi(): boolean {
  return getRuntimeEnvString("CI") === "true";
}

export function isRuntimePlaywright(): boolean {
  return getRuntimeEnvBoolean("PLAYWRIGHT_TEST") === true;
}

export function isRuntimeProductionBuildPhase(): boolean {
  return getRuntimeEnvString("NEXT_PHASE") === "phase-production-build";
}

export function isRuntimeCloudflare(): boolean {
  return (
    getRuntimeEnvString("DEPLOYMENT_PLATFORM") === "cloudflare" ||
    getRuntimeEnvString("NEXT_PUBLIC_DEPLOYMENT_PLATFORM") === "cloudflare"
  );
}

export function isSecureAppEnv(): boolean {
  const appEnv = getRuntimeAppEnv();
  return appEnv === "production" || appEnv === "preview";
}

// 提供必需环境变量检查（仅用于字符串类型的环境变量）
export function requireEnvVar(key: keyof typeof env): string {
  const value = env[key];
  if (!value || typeof value === "boolean" || typeof value === "number") {
    throw new Error(
      `Required environment variable ${key} is not set or is not a string`,
    );
  }
  return value;
}

// 常用环境变量的便捷访问器
export const envUtils = {
  isDevelopment: () => env.NODE_ENV === "development",
  isProduction: () => env.NODE_ENV === "production",
  isTest: () => env.NODE_ENV === "test",
  // Turnstile相关
  getTurnstileSecret: () => requireEnvVar("TURNSTILE_SECRET_KEY"),
  getTurnstileSiteKey: () => requireEnvVar("NEXT_PUBLIC_TURNSTILE_SITE_KEY"),

  // Resend相关
  getResendApiKey: () => requireEnvVar("RESEND_API_KEY"),

  // Airtable相关
  getAirtableToken: () => requireEnvVar("AIRTABLE_API_KEY"),
  getAirtableBaseId: () => requireEnvVar("AIRTABLE_BASE_ID"),
} as const;
