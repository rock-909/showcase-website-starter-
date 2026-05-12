import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ENV_SOURCE_PATH = "src/lib/env.ts";
const ENV_EXAMPLE_PATH = ".env.example";
const ENV_DOC_PATH = "docs/website/env 设置.md";
const DEPLOY_DOC_PATH = "docs/website/部署设置.md";
const SENSITIVE_ENV_KEY_PATTERN =
  /(?:_API_KEY|_TOKEN|_SECRET(?:_KEY)?|_ACCESS_KEY|_ENCRYPTION_KEY|_PEPPER(?:_PREVIOUS)?)$/u;
const SENSITIVE_ENV_KEYS = [
  "RESEND_API_KEY",
  "AIRTABLE_API_KEY",
  "TURNSTILE_SECRET_KEY",
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_ANALYTICS_API_TOKEN",
  "NEXT_SERVER_ACTIONS_ENCRYPTION_KEY",
  "RATE_LIMIT_PEPPER",
  "RATE_LIMIT_PEPPER_PREVIOUS",
  "UPSTASH_REDIS_REST_TOKEN",
  "KV_REST_API_TOKEN",
  "OPS_DASHBOARD_ACCESS_KEY",
] as const;
// This is the adopter-facing deployment surface, not inferred from secret-like names.
const DEPLOYMENT_CRITICAL_ENV_KEYS = [
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_API_TOKEN",
  "NEXT_SERVER_ACTIONS_ENCRYPTION_KEY",
  "DEPLOYMENT_PLATFORM",
  "DEPLOY_TARGET",
  "CLOUDFLARE_ZONE_ID",
  "CLOUDFLARE_ANALYTICS_HOSTNAME",
  "OPS_DASHBOARD_ACCESS_KEY",
] as const;
const TOOLING_ONLY_ENV_KEYS = new Set(["CLOUDFLARE_API_TOKEN"]);
const FRAMEWORK_MANAGED_RUNTIME_KEYS = new Set(["NEXT_PHASE", "NODE_ENV"]);

function readRepoFile(repoPath: string) {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- architecture test reads fixed repo-local files
  return readFileSync(repoPath, "utf8");
}

function extractObjectBlock(source: string, marker: string) {
  const start = source.indexOf(marker);
  expect(start, `${marker} should exist`).toBeGreaterThanOrEqual(0);

  const openingBrace = source.indexOf("{", start);
  expect(
    openingBrace,
    `${marker} should have an object body`,
  ).toBeGreaterThanOrEqual(0);

  let depth = 0;
  for (let index = openingBrace; index < source.length; index += 1) {
    const char = source[index];

    if (char === "{") {
      depth += 1;
    }

    if (char === "}") {
      depth -= 1;
    }

    if (depth === 0) {
      return source.slice(openingBrace, index + 1);
    }
  }

  throw new Error(`Unable to find closing brace for ${marker}`);
}

function extractSchemaKeys(source: string, marker: string) {
  const block = extractObjectBlock(source, marker);
  return [...block.matchAll(/^\s{2}([A-Z0-9_]+):/gmu)].map((match) => match[1]);
}

function extractRuntimeEnvKeys(source: string) {
  const block = extractObjectBlock(source, "export const runtimeEnv = {");
  return [...block.matchAll(/^\s{2}([A-Z0-9_]+):\s*process\.env\.\1\b/gmu)].map(
    (match) => match[1],
  );
}

function parseEnvExample(source: string) {
  const values = new Map<string, string>();

  for (const line of source.split(/\r?\n/u)) {
    const trimmed = line.trim();

    if (trimmed === "" || trimmed.startsWith("#")) {
      continue;
    }

    const match = /^([A-Z0-9_]+)=(.*)$/u.exec(trimmed);
    if (match) {
      values.set(match[1], match[2] ?? "");
    }
  }

  return values;
}

function getDiscoveredSensitiveEnvKeys(envExample: Map<string, string>) {
  return [...envExample.keys()].filter((key) =>
    SENSITIVE_ENV_KEY_PATTERN.test(key),
  );
}

describe(".env.example parity", () => {
  it("keeps env example aligned with the central runtime env contract", () => {
    const envSource = readRepoFile(ENV_SOURCE_PATH);
    const envExample = parseEnvExample(readRepoFile(ENV_EXAMPLE_PATH));
    const schemaKeys = new Set([
      ...extractSchemaKeys(envSource, "export const serverEnvSchema = {"),
      ...extractSchemaKeys(envSource, "export const clientEnvSchema = {"),
    ]);
    const runtimeKeys = new Set(extractRuntimeEnvKeys(envSource));

    expect([...schemaKeys].sort()).toEqual([...runtimeKeys].sort());

    const documentedRuntimeKeys = new Set(
      [...envExample.keys()].filter((key) => !TOOLING_ONLY_ENV_KEYS.has(key)),
    );
    const missingFromExample = [...schemaKeys]
      .filter((key) => !FRAMEWORK_MANAGED_RUNTIME_KEYS.has(key))
      .filter((key) => !documentedRuntimeKeys.has(key))
      .sort();
    const unknownExampleKeys = [...envExample.keys()]
      .filter((key) => !schemaKeys.has(key))
      .filter((key) => !TOOLING_ONLY_ENV_KEYS.has(key))
      .sort();

    expect(missingFromExample).toEqual([]);
    expect(unknownExampleKeys).toEqual([]);
    expect(envExample.get("CLOUDFLARE_API_TOKEN")).toBeDefined();
    expect(schemaKeys.has("CLOUDFLARE_API_TOKEN")).toBe(false);
  });

  it("keeps dangerous or behavior-sensitive defaults safe", () => {
    const envExample = parseEnvExample(readRepoFile(ENV_EXAMPLE_PATH));

    expect(envExample.get("ALLOW_MEMORY_RATE_LIMIT")).toBe("false");
    expect(envExample.get("NEXT_PUBLIC_TURNSTILE_ACTION")).toBe("contact_form");
    expect(envExample.get("TURNSTILE_EXPECTED_ACTION")).toBe("contact_form");
    expect(envExample.get("TURNSTILE_ALLOWED_ACTIONS")?.split(",")).toContain(
      "contact_form",
    );
  });

  it("documents all sensitive example keys in the env guide", () => {
    const envExample = parseEnvExample(readRepoFile(ENV_EXAMPLE_PATH));
    const envGuide = readRepoFile(ENV_DOC_PATH);
    const sensitiveEnvKeys = [
      ...new Set([
        ...SENSITIVE_ENV_KEYS,
        ...getDiscoveredSensitiveEnvKeys(envExample),
      ]),
    ].sort();
    const publicSensitiveKeys = [...envExample.keys()].filter(
      (key) =>
        key.startsWith("NEXT_PUBLIC_") && SENSITIVE_ENV_KEY_PATTERN.test(key),
    );

    expect(publicSensitiveKeys).toEqual([]);

    for (const key of sensitiveEnvKeys) {
      expect(envExample.has(key), `${key} should remain in .env.example`).toBe(
        true,
      );
      expect(
        envGuide,
        `${key} should be mentioned in ${ENV_DOC_PATH}`,
      ).toContain(key);
      expect(
        key.startsWith("NEXT_PUBLIC_"),
        `${key} must stay server-only and must not be public`,
      ).toBe(false);
    }
  });

  it("documents deployment-critical keys in the deployment guide", () => {
    const envExample = parseEnvExample(readRepoFile(ENV_EXAMPLE_PATH));
    const deployGuide = readRepoFile(DEPLOY_DOC_PATH);

    for (const key of DEPLOYMENT_CRITICAL_ENV_KEYS) {
      expect(envExample.has(key), `${key} should remain in .env.example`).toBe(
        true,
      );
      expect(
        deployGuide,
        `${key} should be mentioned in ${DEPLOY_DOC_PATH}`,
      ).toContain(key);
    }
  });
});
