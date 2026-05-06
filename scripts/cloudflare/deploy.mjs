#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const VALID_ENVS = new Set(["preview", "production"]);

function parseArgs(argv) {
  const args = {
    env: "",
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--dry-run") {
      args.dryRun = true;
      continue;
    }

    if (arg === "--env") {
      args.env = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    console.error(`[cloudflare-deploy] unknown argument: ${arg}`);
    process.exit(1);
  }

  if (!VALID_ENVS.has(args.env)) {
    console.error(
      "[cloudflare-deploy] --env is required and must be preview or production",
    );
    process.exit(1);
  }

  return args;
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    stdio: "inherit",
    env: process.env,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const args = parseArgs(process.argv.slice(2));

run("pnpm", ["clean:next-artifacts"]);
run("pnpm", ["build:cf"]);
run("node", ["scripts/cloudflare/build-phase6-workers.mjs"]);

const deployArgs = [
  "scripts/cloudflare/deploy-phase6.mjs",
  "--env",
  args.env,
];
if (args.dryRun) {
  deployArgs.push("--dry-run");
}

run("node", deployArgs);
