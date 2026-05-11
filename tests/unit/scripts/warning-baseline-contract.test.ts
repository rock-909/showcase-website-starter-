import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(__dirname, "../../..");

function readRepoFile(relativePath: string) {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- test reads fixed repo fixture files by relative path
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

describe("generated warning baseline contract", () => {
  it("keeps React Doctor governance scripts wired as warning baseline tooling", () => {
    const packageJson = JSON.parse(readRepoFile("package.json")) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts["react:doctor"]).toBe(
      "react-doctor . --offline --fail-on error",
    );
    expect(packageJson.scripts["react:doctor:report"]).toBe(
      "react-doctor . --offline --json --fail-on none",
    );
    expect(packageJson.scripts["react:doctor:classify"]).toBe(
      "react-doctor . --offline --json --fail-on none > /tmp/showcase-react-doctor-current.json && node scripts/quality/react-doctor-classify.mjs /tmp/showcase-react-doctor-current.json reports/quality/react-doctor-classified.json",
    );
    expect(packageJson.scripts["react:doctor:governance"]).toBe(
      "react-doctor . --offline --json --fail-on none > /tmp/showcase-react-doctor-current.json && node scripts/quality/react-doctor-classify.mjs /tmp/showcase-react-doctor-current.json reports/quality/react-doctor-classified.json --check",
    );
    expect(packageJson.scripts["react:doctor:raw-governance"]).toBe(
      "node scripts/quality/react-doctor-raw-governance.mjs",
    );
    expect(Object.keys(packageJson.scripts)).toHaveLength(20);
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
    expect(qualityProof).toContain("React Doctor");
    expect(qualityProof).toContain("error blocks CI");
    expect(qualityProof).toContain("warning is backlog");
  });
});
