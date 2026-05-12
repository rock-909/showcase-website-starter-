import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ENV_SOURCE_PATH = "src/lib/env.ts";
const ENV_EXAMPLE_PATH = ".env.example";
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
});
