import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(__dirname, "../../..");
const RETIRED_DEPCRUISER_RULES = [
  "no-orphans",
  "feature-isolation",
  "no-external-to-internal",
  "no-cross-domain-direct-access:web-vitals",
  "no-shipped-blog-routes-to-newsletter-island",
  "no-shipped-product-routes-to-inquiry-islands",
  "web-vitals-no-ui-deps",
  "i18n-no-ui-deps",
  "enforce-domain-boundaries",
  "i18n-domain-boundaries",
  "no-barrel-export-dependencies",
] as const;

const REQUIRED_DEPCRUISER_RULES = [
  "no-lib-to-components-or-app",
  "no-components-to-app",
  "no-config-to-components",
  "no-cross-route-import",
  "no-non-test-imports-api-routes",
  "no-circular",
  "no-test-imports-in-production",
  "no-test-support-imports-in-production",
  "no-dev-dependencies-in-production",
  "no-relative-cross-layer-imports",
  "ui-radix-import-boundary",
] as const;

const RETIRED_SEMGREP_RULES = [
  "object-injection-sink-dynamic-property",
  "object-injection-sink-spread-operator",
  "unsafe-property-access-pattern",
  "object-injection-sink-computed-property",
  "object-injection-sink-for-in-loop",
  "object-injection-sink-object-keys",
  "object-injection-sink-destructuring-assignment",
  "object-injection-sink-reflect-api",
] as const;

const REQUIRED_SEMGREP_RULES = [
  "nextjs-unsafe-dangerouslySetInnerHTML",
  "hardcoded-api-keys",
  "unsafe-eval-usage",
  "nextjs-unsafe-html-injection",
  "weak-crypto-algorithm",
  "sql-injection-risk",
  "nextjs-unsafe-server-action",
  "object-injection-untrusted-key-write",
  "no-raw-request-json-in-api",
  "raw-proxy-header-read-outside-trusted-entry",
  "api-route-free-text-error-response",
  "starter-lead-route-missing-safe-json-body",
] as const;

const RETIRED_PATH_MARKERS = [
  "whatsapp",
  "web-vitals",
  "performance-monitoring",
  "theme-analytics",
  "locale-detection-hooks",
  "i18n-cache-types-advanced",
  "blog-newsletter",
  "product-inquiry-form",
  "inquiry-drawer",
  "product-actions",
] as const;

interface DepCruiserRule {
  readonly name: string;
  readonly severity: string;
  readonly from?: unknown;
  readonly to?: {
    readonly path?: string;
    readonly pathNot?: string;
  };
}

interface DepCruiserConfig {
  readonly forbidden: DepCruiserRule[];
}

interface SemgrepRule {
  readonly id: string;
  readonly severity?: string;
}

interface SemgrepConfig {
  readonly rules: SemgrepRule[];
}

function readRepoFile(relativePath: string): string {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- test reads fixed repo fixture files by relative path
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

function readSemgrepConfig(): SemgrepConfig {
  return yaml.load(readRepoFile("semgrep.yml")) as SemgrepConfig;
}

function readDepCruiserConfig(): DepCruiserConfig {
  return require(
    path.join(REPO_ROOT, ".dependency-cruiser.js"),
  ) as DepCruiserConfig;
}

describe("security and architecture rule boundaries", () => {
  it("keeps dependency-cruiser focused on current blocking architecture rules", () => {
    const ruleNames = readDepCruiserConfig().forbidden.map((rule) => rule.name);

    for (const ruleName of REQUIRED_DEPCRUISER_RULES) {
      expect(ruleNames).toContain(ruleName);
    }

    for (const ruleName of RETIRED_DEPCRUISER_RULES) {
      expect(ruleNames).not.toContain(ruleName);
    }
  });

  it("does not keep warning-only dependency-cruiser forbidden rules", () => {
    const warningRules = readDepCruiserConfig()
      .forbidden.filter((rule) => rule.severity === "warn")
      .map((rule) => rule.name);

    expect(warningRules).toEqual([]);
  });

  it("allows the intentional i18n message-loader cache-tag dependency", () => {
    const text = readRepoFile(".dependency-cruiser.js");

    expect(text).toContain("^src/lib/cache/cache-tags\\\\.ts$");
  });

  it("keeps high-value Semgrep rules and removes broad heuristic sink rules", () => {
    const ruleIds = readSemgrepConfig().rules.map((rule) => rule.id);

    for (const ruleId of REQUIRED_SEMGREP_RULES) {
      expect(ruleIds).toContain(ruleId);
    }

    for (const ruleId of RETIRED_SEMGREP_RULES) {
      expect(ruleIds).not.toContain(ruleId);
    }
  });

  it("removes stale Semgrep path markers for deleted surfaces", () => {
    const semgrepText = readRepoFile("semgrep.yml");

    for (const marker of RETIRED_PATH_MARKERS) {
      expect(semgrepText).not.toContain(marker);
    }
  });

  it("documents the active security and architecture rule scope", () => {
    const policy = readRepoFile("docs/guides/POLICY-SOURCE-OF-TRUTH.md");

    expect(policy).toContain("dependency-cruiser 是阻断型架构边界工具");
    expect(policy).toContain("Semgrep ERROR 规则是 CI 阻断项");
  });
});
