import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(__dirname, "../../..");

function readRepoFile(relativePath: string) {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- test reads fixed repo fixture files by relative path
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

describe("Cloudflare platform env contract", () => {
  it("uses DEPLOYMENT_PLATFORM as the canonical Cloudflare signal", () => {
    expect(readRepoFile("wrangler.jsonc")).toContain(
      '"DEPLOYMENT_PLATFORM": "cloudflare"',
    );
    expect(readRepoFile("next.config.ts")).toContain(
      'process.env.DEPLOYMENT_PLATFORM === "cloudflare"',
    );
    expect(readRepoFile("next.config.ts")).toContain(
      'process.env.DEPLOY_TARGET === "cloudflare"',
    );
    expect(readRepoFile("docs/technical/deployment-notes.md")).toContain(
      "DEPLOYMENT_PLATFORM=cloudflare",
    );
    expect(readRepoFile("docs/technical/deployment-notes.md")).toContain(
      "DEPLOY_TARGET=cloudflare",
    );
  });
});
