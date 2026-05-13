# Pre-commit Slimming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce normal pre-commit latency without removing release-critical proof from CI or explicit proof commands.

**Architecture:** Treat git hooks as local feedback only. Keep cheap staged checks in pre-commit, leave heavy proof in CI, pre-push, `pnpm website:check`, and `pnpm release:verify`. Add a contract test so future edits do not quietly re-bloat pre-commit.

**Tech Stack:** Lefthook 2.1.6, Vitest 4.1.6, js-yaml 4.1.1, pnpm scripts, GitHub Actions.

---

## File structure

- Create `tests/unit/scripts/hook-boundary-contract.test.ts`: contract test for hook boundaries and CI coverage.
- Modify `lefthook.yml`: remove slow lanes from `pre-commit`; keep existing pre-push lanes and `RUN_FAST_PUSH=1` behavior.
- Modify `docs/website/quality-proof.md`: document hook responsibility vs CI/release proof.
- Modify `docs/guides/QUALITY-PROOF-LEVELS.md`: clarify that pre-commit is fast feedback, while pre-push can be heavier but is still not release proof.

## Task 1: Add hook boundary contract test

**Files:**
- Create: `tests/unit/scripts/hook-boundary-contract.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/scripts/hook-boundary-contract.test.ts`:

```ts
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(__dirname, "../../..");

interface LefthookCommand {
  readonly run?: string;
}

interface LefthookStage {
  readonly commands?: Record<string, LefthookCommand>;
}

interface LefthookConfig {
  readonly "pre-commit"?: LefthookStage;
  readonly "pre-push"?: LefthookStage;
}

interface WorkflowStep {
  readonly run?: string;
}

interface WorkflowJob {
  readonly steps?: WorkflowStep[];
}

interface WorkflowConfig {
  readonly jobs?: Record<string, WorkflowJob>;
}

function readRepoFile(relativePath: string): string {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- test reads fixed repo fixture files by relative path
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

function readLefthookConfig(): LefthookConfig {
  return yaml.load(readRepoFile("lefthook.yml")) as LefthookConfig;
}

function readCiWorkflow(): WorkflowConfig {
  return yaml.load(readRepoFile(".github/workflows/ci.yml")) as WorkflowConfig;
}

function collectWorkflowRuns(workflow: WorkflowConfig): string {
  return Object.values(workflow.jobs ?? {})
    .flatMap((job) => job.steps ?? [])
    .map((step) => step.run ?? "")
    .join("\n");
}

describe("git hook proof boundaries", () => {
  it("keeps pre-commit focused on fast local feedback", () => {
    const lefthook = readLefthookConfig();
    const preCommitCommands = Object.keys(
      lefthook["pre-commit"]?.commands ?? {},
    );

    expect(preCommitCommands).toEqual([
      "format-check",
      "quality-check",
      "architecture-guard",
      "i18n-sync",
    ]);
  });

  it("does not run slow proof lanes from pre-commit", () => {
    const lefthook = readLefthookConfig();
    const preCommitCommands = Object.keys(
      lefthook["pre-commit"]?.commands ?? {},
    );

    expect(preCommitCommands).not.toContain("type-check");
    expect(preCommitCommands).not.toContain("config-check");
    expect(preCommitCommands).not.toContain("structural-clusters-review");
    expect(preCommitCommands).not.toContain("test-related");
  });

  it("keeps CI coverage for checks moved out of pre-commit", () => {
    const ciRuns = collectWorkflowRuns(readCiWorkflow());

    expect(ciRuns).toContain("pnpm type-check");
    expect(ciRuns).toContain("pnpm test");
    expect(ciRuns).toContain("pnpm build");
  });

  it("keeps emergency pre-push bypass wording available", () => {
    const lefthookText = readRepoFile("lefthook.yml");

    expect(lefthookText).toContain("RUN_FAST_PUSH=1");
    expect(lefthookText).toContain("仅用于紧急推送");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm exec vitest run tests/unit/scripts/hook-boundary-contract.test.ts
```

Expected:

- Fails because current `pre-commit` still contains `type-check`, `config-check`, `structural-clusters-review`, and `test-related`.

## Task 2: Slim pre-commit

**Files:**
- Modify: `lefthook.yml`

- [ ] **Step 1: Remove slow pre-commit commands**

In `lefthook.yml`, remove these command blocks from `pre-commit.commands`:

- `type-check`
- `config-check`
- `structural-clusters-review`
- `test-related`

Keep:

- `format-check`
- `quality-check`
- `architecture-guard`
- `i18n-sync`

Do not remove or weaken existing `pre-push` commands.

- [ ] **Step 2: Run hook contract test**

Run:

```bash
pnpm exec vitest run tests/unit/scripts/hook-boundary-contract.test.ts
```

Expected:

- 4 tests pass.

## Task 3: Update quality proof docs

**Files:**
- Modify: `docs/website/quality-proof.md`
- Modify: `docs/guides/QUALITY-PROOF-LEVELS.md`

- [ ] **Step 1: Document hook boundary in quality proof**

Add a short section to `docs/website/quality-proof.md` explaining:

- pre-commit is quick local feedback;
- pre-push can be heavier but still is not release proof;
- CI and `pnpm website:check`/`pnpm release:verify` own full proof.

- [ ] **Step 2: Clarify fast gate docs**

In `docs/guides/QUALITY-PROOF-LEVELS.md`, update the `fast gate` section so it does not imply every git hook runs the same proof level.

- [ ] **Step 3: Run proof contract tests**

Run:

```bash
pnpm exec vitest run tests/unit/scripts/hook-boundary-contract.test.ts tests/unit/scripts/proof-lane-contract.test.ts
```

Expected:

- All tests pass.

## Task 4: Final verification

**Files:**
- Verify changed repo state.

- [ ] **Step 1: Run required validation commands**

Run:

```bash
pnpm lint:check
pnpm type-check
pnpm test
pnpm build
pnpm website:check
```

Expected:

- All commands exit 0.
- `pnpm build` may still show the known middleware deprecation, missing local Resend key, and `DYNAMIC_SERVER_USAGE` warnings.

- [ ] **Step 2: Verify diff**

Run:

```bash
git diff --check
git diff --stat origin/main...HEAD
```

Expected:

- No whitespace errors.
- Diff only touches hook boundary tests/docs/config and Superpowers plan/spec files.
