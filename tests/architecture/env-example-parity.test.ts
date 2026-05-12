import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ENV_SOURCE_PATH = "src/lib/env.ts";
const ENV_EXAMPLE_PATH = ".env.example";
const TOOLING_ONLY_ENV_KEYS = new Set(["CLOUDFLARE_API_TOKEN"]);
const FRAMEWORK_MANAGED_RUNTIME_KEYS = new Set(["NEXT_PHASE", "NODE_ENV"]);

function expectDefined<T>(value: T | undefined, label: string): T {
  expect(value, label).toBeDefined();
  if (value === undefined) {
    throw new Error(`${label} should be defined`);
  }
  return value;
}

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
  return [...block.matchAll(/^\s{2}([A-Z0-9_]+):/gmu)].map((match) =>
    expectDefined(match[1], "schema key"),
  );
}

function extractRuntimeEnvKeys(source: string) {
  const block = extractObjectBlock(source, "export const runtimeEnv = {");
  return [...block.matchAll(/^\s{2}([A-Z0-9_]+):\s*process\.env\.\1\b/gmu)].map(
    (match) => expectDefined(match[1], "runtime env key"),
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
      const key = expectDefined(match[1], ".env.example key");
      const value = match[2] ?? "";
      values.set(key, value);
    }
  }

  return values;
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

    expect(Array.from(schemaKeys).toSorted()).toEqual(
      Array.from(runtimeKeys).toSorted(),
    );

    const documentedRuntimeKeys = new Set<string>();
    const missingFromExample: string[] = [];
    const unknownExampleKeys: string[] = [];

    for (const key of envExample.keys()) {
      if (!TOOLING_ONLY_ENV_KEYS.has(key)) {
        documentedRuntimeKeys.add(key);
      }
      if (!schemaKeys.has(key) && !TOOLING_ONLY_ENV_KEYS.has(key)) {
        unknownExampleKeys.push(key);
      }
    }

    for (const key of schemaKeys) {
      if (
        !FRAMEWORK_MANAGED_RUNTIME_KEYS.has(key) &&
        !documentedRuntimeKeys.has(key)
      ) {
        missingFromExample.push(key);
      }
    }

    expect(missingFromExample.toSorted()).toEqual([]);
    expect(unknownExampleKeys.toSorted()).toEqual([]);
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
});
