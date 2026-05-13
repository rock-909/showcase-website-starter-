# Security and Architecture Rule Slimming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove stale/noisy Semgrep and dependency-cruiser rules while keeping CI security coverage and core architecture boundaries intact.

**Architecture:** Add a contract test for the desired rule set first. Then simplify `.dependency-cruiser.js` and `semgrep.yml` to match the current codebase. Keep high-value security and architecture blockers; delete historical rollback guards and warning-only heuristics that have no current production surface.

**Tech Stack:** dependency-cruiser 17.4.0, Semgrep CI container, js-yaml 4.1.1, Vitest 4.1.6.

---

## File structure

- Create `tests/unit/scripts/security-arch-rules-contract.test.ts`: validates retained and retired rule boundaries.
- Modify `.dependency-cruiser.js`: keep core architecture rules, remove stale/warning-only rules, add a Radix UI boundary rule.
- Modify `semgrep.yml`: keep blocking security/API contract rules, remove broad heuristic sink rules and stale path excludes.
- Modify `docs/guides/POLICY-SOURCE-OF-TRUTH.md`: document current Semgrep/dependency-cruiser scope.

## Task 1: Add rule boundary contract test

**Files:**
- Create: `tests/unit/scripts/security-arch-rules-contract.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/scripts/security-arch-rules-contract.test.ts`:

```ts
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
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- dependency-cruiser config is CommonJS
  return require(path.join(REPO_ROOT, ".dependency-cruiser.js")) as DepCruiserConfig;
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
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm exec vitest run tests/unit/scripts/security-arch-rules-contract.test.ts
```

Expected:

- Fails on currently retained stale dependency-cruiser rules, warning rules, broad Semgrep heuristic rules, stale Semgrep path markers, and missing policy wording.

## Task 2: Simplify dependency-cruiser

**Files:**
- Modify: `.dependency-cruiser.js`

- [ ] **Step 1: Remove stale and warning-only rules**

Delete these forbidden rules:

- `no-orphans`
- `feature-isolation`
- `no-external-to-internal`
- `no-cross-domain-direct-access:web-vitals`
- `no-shipped-blog-routes-to-newsletter-island`
- `no-shipped-product-routes-to-inquiry-islands`
- `web-vitals-no-ui-deps`
- `i18n-no-ui-deps`
- `enforce-domain-boundaries`
- `i18n-domain-boundaries`
- `no-barrel-export-dependencies`

- [ ] **Step 2: Add explicit i18n/cache exception to layer rule**

In `no-lib-to-components-or-app`, no change is needed. For i18n/cache warning removal, add a short comment in the config near retained rules and avoid warning-only i18n rules. The contract test expects the text:

```js
"^src/lib/cache/cache-tags\\.ts$"
```

This records that cache tags are an accepted shared infrastructure dependency.

- [ ] **Step 3: Add Radix boundary rule**

Add this forbidden rule:

```js
{
  name: "ui-radix-import-boundary",
  severity: "error",
  comment: "Radix primitives must be wrapped in src/components/ui before use",
  from: {
    path: "^src/",
    pathNot:
      "^src/components/ui/|\\.(spec|test|stories)\\.(js|ts|tsx)$|/__tests__/",
  },
  to: {
    path: "^node_modules/@radix-ui/",
  },
},
```

- [ ] **Step 4: Run contract and dependency-cruiser**

Run:

```bash
pnpm exec vitest run tests/unit/scripts/security-arch-rules-contract.test.ts
pnpm exec dependency-cruiser src --config .dependency-cruiser.js -T err
```

Expected:

- Contract may still fail until Semgrep/docs edits are done.
- dependency-cruiser exits with no warnings.

## Task 3: Simplify Semgrep config

**Files:**
- Modify: `semgrep.yml`

- [ ] **Step 1: Remove broad heuristic sink rules**

Delete the Semgrep rules listed in `RETIRED_SEMGREP_RULES` from the test:

- `object-injection-sink-dynamic-property`
- `object-injection-sink-spread-operator`
- `unsafe-property-access-pattern`
- `object-injection-sink-computed-property`
- `object-injection-sink-for-in-loop`
- `object-injection-sink-object-keys`
- `object-injection-sink-destructuring-assignment`
- `object-injection-sink-reflect-api`

- [ ] **Step 2: Remove stale path excludes**

From retained rules, remove stale path mentions for deleted surfaces:

- `whatsapp`
- `web-vitals`
- `performance-monitoring`
- `theme-analytics`
- `locale-detection-hooks`
- `i18n-cache-types-advanced`
- `blog-newsletter`
- `product-inquiry-form`
- `inquiry-drawer`
- `product-actions`

- [ ] **Step 3: Run Semgrep contract**

Run:

```bash
pnpm exec vitest run tests/unit/scripts/security-arch-rules-contract.test.ts
```

Expected:

- Semgrep rule and stale marker checks pass once docs are updated.

## Task 4: Update docs

**Files:**
- Modify: `docs/guides/POLICY-SOURCE-OF-TRUTH.md`

- [ ] **Step 1: Add current rule-scope wording**

Add a short note under architecture/dependency governance:

```md
dependency-cruiser 是阻断型架构边界工具，不再承担 broad dead-code / orphan scan 或历史回退提醒。

Semgrep ERROR 规则是 CI 阻断项。WARNING / INFO 级启发式规则只有在明确保留时才是人工 review signal，不应长期堆例外列表。
```

- [ ] **Step 2: Run docs/rule contract**

Run:

```bash
pnpm exec vitest run tests/unit/scripts/security-arch-rules-contract.test.ts
```

Expected:

- 6 tests pass.

## Task 5: Final verification

**Files:**
- Verify changed repo state.

- [ ] **Step 1: Run local required validation**

Run:

```bash
pnpm exec dependency-cruiser src --config .dependency-cruiser.js -T err
pnpm exec semgrep scan --config semgrep.yml --error --severity ERROR src
pnpm lint:check
pnpm test
```

Expected:

- dependency-cruiser exits 0 and prints no warnings.
- If local Semgrep CLI is unavailable, record it as blocked locally and rely on CI wiring proof; do not call it passed.
- lint and tests pass.

- [ ] **Step 2: Verify diff**

Run:

```bash
git diff --check
git diff --stat origin/main...HEAD
```

Expected:

- No whitespace errors.
- Diff is limited to rule configs, docs, contract test, and Superpowers spec/plan.
