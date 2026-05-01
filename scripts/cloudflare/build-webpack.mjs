import { lstat, mkdir, rm, symlink } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT_DIR = process.cwd();
const DOT_NEXT_DIR = path.join(ROOT_DIR, ".next");
const STANDALONE_DIR = path.join(DOT_NEXT_DIR, "standalone");
const STANDALONE_NEXT_LINK = path.join(STANDALONE_DIR, ".next");

const CF_ENV = {
  ...process.env,
  DEPLOY_TARGET: "cloudflare",
  NEXT_PUBLIC_DEPLOYMENT_PLATFORM: "cloudflare",
};

function run(command, args, extraEnv = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT_DIR,
    stdio: "inherit",
    env: {
      ...CF_ENV,
      ...extraEnv,
    },
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

async function ensureWebpackStandaloneCompatibility() {
  await mkdir(STANDALONE_DIR, { recursive: true });

  try {
    const stat = await lstat(STANDALONE_NEXT_LINK);
    if (stat.isSymbolicLink()) {
      return;
    }

    await rm(STANDALONE_NEXT_LINK, { recursive: true, force: true });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    } else {
      throw error;
    }
  }

  // OpenNext's skipNextBuild path expects ".next/standalone/.next/server/*" to exist.
  // Webpack builds in this repo emit ".next/server/*" without the standalone wrapper,
  // so add a compatibility symlink instead of mutating the real output structure.
  await symlink("..", STANDALONE_NEXT_LINK, "dir");
}

async function main() {
  run("node", ["scripts/clean-next-build-artifacts.mjs"]);
  run("pnpm", ["prebuild"]);
  run("pnpm", ["exec", "next", "build", "--webpack"]);
  await ensureWebpackStandaloneCompatibility();
  run("pnpm", ["exec", "opennextjs-cloudflare", "build", "--skipNextBuild"]);
  run("node", ["scripts/cloudflare/patch-prefetch-hints-manifest.mjs"]);
}

main().catch((error) => {
  console.error("[cf-webpack-build] failed:", error);
  process.exit(1);
});
