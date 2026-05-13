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

  it("documents hook boundaries separately from CI and release proof", () => {
    const qualityProof = readRepoFile("docs/website/quality-proof.md");
    const proofLevels = readRepoFile("docs/guides/QUALITY-PROOF-LEVELS.md");

    expect(qualityProof).toContain("pre-commit 是快速本地反馈");
    expect(qualityProof).toContain(
      "pre-push 可以更重，但仍然不是 release proof",
    );
    expect(qualityProof).toContain(
      "CI、`pnpm website:check` 和 `pnpm release:verify` 才是完整证明入口",
    );
    expect(proofLevels).toContain("pre-commit：只做快速本地反馈");
    expect(proofLevels).toContain("pre-push：可以做较重的本地分支保护");
  });
});
