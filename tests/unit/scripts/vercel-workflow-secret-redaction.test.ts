import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(__dirname, "../../..");
const VERCEL_WORKFLOW_PATH = ".github/workflows/vercel-deploy.yml";

function readWorkflow() {
  return fs.readFileSync(path.join(REPO_ROOT, VERCEL_WORKFLOW_PATH), "utf8");
}

describe("Vercel workflow secret redaction", () => {
  it("does not print pulled Vercel env file contents to Actions logs", () => {
    const workflow = readWorkflow();

    expect(workflow).not.toMatch(
      /\b(?:cat|head|tail|sed|awk)\b[^\n]*\.vercel\/\.env\.[^\n]*/u,
    );
    expect(workflow).toContain("内容已隐藏");
  });

  it("does not print Vercel project linkage file contents to Actions logs", () => {
    const workflow = readWorkflow();

    expect(workflow).not.toMatch(
      /\b(?:cat|head|tail|sed|awk)\b[^\n]*\.vercel\/project\.json/u,
    );
    expect(workflow).toContain("项目关联文件 (.vercel/project.json):");
  });
});
