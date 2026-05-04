import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(__dirname, "../../..");
const GUARDED_RUNNERS = [
  "scripts/run-all-guardrails-review.js",
  "scripts/run-scripts-env-review.js",
  "scripts/quality-gate.js",
] as const;

function readRepoFile(relativePath: string): string {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- test reads fixed repo files by relative path
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

describe("guardrail runner deprecation contract", () => {
  it("does not pass args to child processes with shell enabled", () => {
    for (const runnerPath of GUARDED_RUNNERS) {
      const source = readRepoFile(runnerPath);

      expect(source, runnerPath).not.toMatch(
        /spawnSync\([\s\S]*?shell:\s*true[\s\S]*?\)/,
      );
    }
  });
});
