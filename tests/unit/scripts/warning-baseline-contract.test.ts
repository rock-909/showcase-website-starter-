import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(__dirname, "../../..");

function readRepoFile(relativePath: string) {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- test reads fixed repo fixture files by relative path
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

describe("generated warning baseline contract", () => {
  it("keeps React Doctor wired as an error gate plus manual JSON report", () => {
    const packageJson = JSON.parse(readRepoFile("package.json")) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts["react:doctor"]).toBe(
      "react-doctor . --offline --fail-on error",
    );
    expect(packageJson.scripts["react:doctor:report"]).toBe(
      "react-doctor . --offline --json --fail-on none",
    );
    expect(packageJson.scripts).not.toHaveProperty("react:doctor:classify");
    expect(packageJson.scripts).not.toHaveProperty("react:doctor:governance");
    expect(packageJson.scripts).not.toHaveProperty(
      "react:doctor:raw-governance",
    );
  });

  it("tracks generated warning baselines without treating them as source defects", () => {
    const cloudflareBaseline = readRepoFile(
      "docs/quality/cloudflare-warning-baseline.md",
    );
    const storybookBaseline = readRepoFile(
      "docs/quality/storybook-warning-baseline.md",
    );
    const qualityProof = readRepoFile("docs/website/quality-proof.md");

    expect(cloudflareBaseline).toContain("duplicate-case");
    expect(cloudflareBaseline).toContain("direct-eval");
    expect(cloudflareBaseline).toContain("equals-negative-zero");
    expect(storybookBaseline).toContain('"use client" was ignored');
    expect(storybookBaseline).toContain("iframe chunk");
    expect(qualityProof).toContain("warning baseline");
    expect(readRepoFile("docs/quality/react-doctor-baseline.md")).toContain(
      "docs/quality/react-doctor-policy.md",
    );
    expect(readRepoFile("docs/quality/react-doctor-baseline.md")).toContain(
      "docs/quality/react-doctor-exceptions.md",
    );
    expect(readRepoFile("docs/quality/react-doctor-baseline.md")).toContain(
      "warningCount: 203",
    );
    expect(readRepoFile("docs/quality/react-doctor-baseline.md")).toContain(
      "score: 97 / 100",
    );
    expect(readRepoFile("docs/quality/react-doctor-policy.md")).toContain(
      "The calibrated gate target is `0 error`",
    );
    const retiredZeroWarningClaim = [
      "native scan is",
      "0",
      "warning /",
      "0",
      "error",
    ].join(" ");
    expect(readRepoFile("docs/quality/react-doctor-policy.md")).not.toContain(
      retiredZeroWarningClaim,
    );
    expect(qualityProof).toContain("React Doctor");
    expect(qualityProof).toContain("error blocks CI");
    expect(qualityProof).toContain("warning is backlog");
    expect(qualityProof).toContain("not a separate CI governance layer");
  });
});
