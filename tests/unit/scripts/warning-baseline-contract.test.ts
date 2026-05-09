import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(__dirname, "../../..");

function readRepoFile(relativePath: string) {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- test reads fixed repo fixture files by relative path
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

describe("generated warning baseline contract", () => {
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
  });
});
