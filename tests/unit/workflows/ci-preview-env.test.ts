import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import yaml from "js-yaml";

interface WorkflowStep {
  readonly name?: string;
  readonly run?: string;
  readonly env?: Record<string, string>;
}

interface WorkflowJob {
  readonly steps?: WorkflowStep[];
}

interface Workflow {
  readonly jobs?: Record<string, WorkflowJob>;
}

type WorkflowPath =
  | ".github/workflows/ci.yml"
  | ".github/workflows/uplink-health.yml"
  | ".github/workflows/vercel-deploy.yml";

function readWorkflowText(relativePath: WorkflowPath) {
  switch (relativePath) {
    case ".github/workflows/ci.yml":
      return readFileSync(".github/workflows/ci.yml", "utf8");
    case ".github/workflows/uplink-health.yml":
      return readFileSync(".github/workflows/uplink-health.yml", "utf8");
    case ".github/workflows/vercel-deploy.yml":
      return readFileSync(".github/workflows/vercel-deploy.yml", "utf8");
    default: {
      const _exhaustive: never = relativePath;
      return _exhaustive;
    }
  }
}

function readCiWorkflow(): Workflow {
  return yaml.load(readWorkflowText(".github/workflows/ci.yml")) as Workflow;
}

describe("CI preview environment contract", () => {
  it("does not run preview performance builds with the reserved example.com site URL", () => {
    const workflow = readCiWorkflow();
    const buildStep = workflow.jobs?.["cloudflare-build"]?.steps?.find(
      (step) => step.name === "构建检查",
    );

    expect(buildStep?.env?.APP_ENV).toBe("preview");
    expect(buildStep?.env?.NEXT_PUBLIC_SITE_URL).not.toContain("example.com");
  });

  it("keeps CI focused on starter proof instead of old guardrail bureaucracy", () => {
    const workflowText = readWorkflowText(".github/workflows/ci.yml");

    expect(workflowText).toContain("pnpm brand:check");
    expect(workflowText).toContain("pnpm content:check");
    expect(workflowText).toContain("pnpm website:review:client-boundary");
    expect(workflowText).toContain("pnpm website:build:cf");
    expect(workflowText).toContain("Lead API Family Layered Proof Review");
    expect(workflowText).not.toContain("pnpm quality:gate:ci");
    expect(workflowText).not.toContain("pnpm review:all-guardrails");
  });

  it("keeps Vercel and external uplink checks manual-only for starter repos", () => {
    const vercelWorkflow = readWorkflowText(
      ".github/workflows/vercel-deploy.yml",
    );
    const uplinkWorkflow = readWorkflowText(
      ".github/workflows/uplink-health.yml",
    );

    expect(vercelWorkflow).toContain("workflow_dispatch:");
    expect(vercelWorkflow).not.toContain("pull_request:");
    expect(vercelWorkflow).not.toContain("branches: [main]");
    expect(uplinkWorkflow).toContain("workflow_dispatch:");
    expect(uplinkWorkflow).not.toContain("schedule:");
    expect(uplinkWorkflow).not.toContain("https://example.com");
  });
});
