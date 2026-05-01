import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  collectMissingWorkflowPnpmScripts,
  extractWorkflowPnpmScriptRefs,
  PNPM_BUILTIN_COMMANDS,
} from "../../../scripts/static-truth-check.js";

function createTempRepo(files: Record<string, string>) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "truth-check-"));

  for (const [relativePath, content] of Object.entries(files)) {
    const fullPath = path.join(tempDir, relativePath);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- temp fixture path is created inside the test-owned directory
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- temp fixture path is created inside the test-owned directory
    fs.writeFileSync(fullPath, content);
  }

  return tempDir;
}

describe("static-truth-check workflow pnpm script guard", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("extracts workflow pnpm script refs but ignores pnpm builtins", () => {
    const refs = extractWorkflowPnpmScriptRefs(
      `
jobs:
  test:
    steps:
      - run: pnpm install
      - run: pnpm exec playwright install --with-deps chromium
      - run: pnpm proof:cf:preview-deployed
      - run: pnpm run release:verify
`,
      "/tmp/cloudflare-deploy.yml",
    );

    expect(PNPM_BUILTIN_COMMANDS.has("install")).toBe(true);
    expect(PNPM_BUILTIN_COMMANDS.has("exec")).toBe(true);
    expect(refs).toEqual([
      expect.objectContaining({ script: "proof:cf:preview-deployed" }),
      expect.objectContaining({ script: "release:verify" }),
    ]);
  });

  it("flags workflow references to missing pnpm scripts", () => {
    const repoDir = createTempRepo({
      "package.json": JSON.stringify(
        {
          scripts: {
            "release:verify": "bash scripts/release-proof.sh",
          },
        },
        null,
        2,
      ),
      ".github/workflows/cloudflare-deploy.yml": `
jobs:
  build:
    steps:
      - run: pnpm preview:preflight:cf
      - run: pnpm release:verify
`,
    });
    tempDirs.push(repoDir);

    const findings = collectMissingWorkflowPnpmScripts(repoDir);

    expect(findings).toEqual([
      expect.objectContaining({
        file: ".github/workflows/cloudflare-deploy.yml",
        script: "preview:preflight:cf",
        error: 'Workflow references missing pnpm script "preview:preflight:cf"',
      }),
    ]);
  });

  it("does not flag workflows when all referenced pnpm scripts exist", () => {
    const repoDir = createTempRepo({
      "package.json": JSON.stringify(
        {
          scripts: {
            "proof:cf:preview-deployed":
              "node scripts/cloudflare/proof-preview-deployed.mjs",
            "release:verify": "bash scripts/release-proof.sh",
          },
        },
        null,
        2,
      ),
      ".github/workflows/cloudflare-deploy.yml": `
jobs:
  build:
    steps:
      - run: pnpm proof:cf:preview-deployed
      - run: pnpm run release:verify
      - run: pnpm exec wrangler --version
`,
    });
    tempDirs.push(repoDir);

    const findings = collectMissingWorkflowPnpmScripts(repoDir);

    expect(findings).toEqual([]);
  });
});
