import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(__dirname, "../../..");
const LEAD_FAMILY_TEST_FILES = [
  "tests/integration/api/lead-family-contract.test.ts",
  "tests/integration/api/lead-family-protection.test.ts",
  "src/app/api/inquiry/__tests__/route.test.ts",
  "tests/integration/api/subscribe.test.ts",
] as const;

function readRepoFile(relativePath: string) {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- test reads fixed repo fixture files by relative path
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

describe("proof lane contract", () => {
  it("keeps the lightweight review lanes wired into ci-local and release proof", () => {
    const packageJson = readRepoFile("package.json");
    const ciLocalScript = readRepoFile("scripts/ci-local.sh");
    const releaseProofScript = readRepoFile("scripts/release-proof.sh");

    expect(packageJson).toContain('"review:docs-truth"');
    expect(packageJson).toContain('"review:cf:official-compare"');
    expect(packageJson).toContain('"review:cf:official-compare:generated"');
    expect(packageJson).toContain('"review:cf:official-compare:source"');
    expect(packageJson).toContain('"review:derivative-readiness"');

    expect(ciLocalScript).toContain("pnpm review:docs-truth");
    expect(ciLocalScript).toContain("pnpm review:derivative-readiness");
    expect(ciLocalScript).toContain("pnpm review:cf:official-compare:source");
    expect(
      ciLocalScript.indexOf("pnpm review:cf:official-compare:source"),
    ).toBeLessThan(ciLocalScript.indexOf("# 构建检查"));

    expect(releaseProofScript).toContain("pnpm review:docs-truth");
    expect(releaseProofScript).toContain(
      "pnpm review:cf:official-compare:source",
    );
    expect(releaseProofScript).toContain(
      "pnpm review:cf:official-compare:generated",
    );
    expect(
      releaseProofScript.indexOf("pnpm review:cf:official-compare:source"),
    ).toBeLessThan(releaseProofScript.indexOf("pnpm deploy:cf:phase6:dry-run"));
    expect(
      releaseProofScript.indexOf("pnpm review:cf:official-compare:generated"),
    ).toBeGreaterThan(
      releaseProofScript.indexOf("pnpm deploy:cf:phase6:dry-run"),
    );
    expect(releaseProofScript).toContain("pnpm review:derivative-readiness");
  });

  it("documents dirty-worktree targeted proof separately from clean-branch full proof", () => {
    const qualityProofLevels = readRepoFile(
      "docs/guides/QUALITY-PROOF-LEVELS.md",
    );
    const releaseProofRunbook = readRepoFile(
      "docs/guides/RELEASE-PROOF-RUNBOOK.md",
    );

    expect(qualityProofLevels).toContain("dirty worktree");
    expect(qualityProofLevels).toContain("targeted proof");
    expect(qualityProofLevels).toContain("clean branch");

    expect(releaseProofRunbook).toContain("dirty worktree");
    expect(releaseProofRunbook).toContain("targeted proof");
    expect(releaseProofRunbook).toContain("clean branch");
    expect(releaseProofRunbook).toContain("ci:local:quick");
  });

  it("keeps the lead-family proof lane aligned with route-level replay coverage", () => {
    const packageJson = JSON.parse(readRepoFile("package.json")) as {
      scripts: Record<string, string>;
    };
    const leadFamilyScript = packageJson.scripts["test:lead-family"];

    expect(leadFamilyScript).toBeTruthy();
    for (const testFile of LEAD_FAMILY_TEST_FILES) {
      expect(leadFamilyScript).toContain(testFile);
    }
  });

  it("does not imply deployed GET smoke proves real lead submission", () => {
    const releaseProofScript = readRepoFile("scripts/release-proof.sh");
    const releaseProofRunbook = readRepoFile(
      "docs/guides/RELEASE-PROOF-RUNBOOK.md",
    );

    expect(releaseProofScript).toContain("test:e2e:post-deploy");
    expect(releaseProofScript).toContain("Airtable");
    expect(releaseProofScript).toContain("manual launch gate");
    expect(releaseProofRunbook).toContain("test:e2e:post-deploy");
    expect(releaseProofRunbook).toContain("manual launch gate");
  });

  it("keeps review:mutation:critical pointed at an existing script", () => {
    const packageJson = JSON.parse(readRepoFile("package.json")) as {
      scripts: Record<string, string>;
    };
    const command = packageJson.scripts["review:mutation:critical"];

    expect(command).toBe("node scripts/review-mutation-critical.js");
    expect(() =>
      readRepoFile("scripts/review-mutation-critical.js"),
    ).not.toThrow();
  });
});
