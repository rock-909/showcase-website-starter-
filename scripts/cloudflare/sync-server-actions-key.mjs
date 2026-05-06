import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getPhase6ServerActionsKeyWorkerNames } from "./phase6-topology-contract.mjs";
import { parseJsoncText } from "./jsonc-utils.mjs";
import { loadLocalEnv } from "./load-local-env.mjs";

const ROOT_DIR = process.cwd();
const WRANGLER_CONFIG_PATH = path.join(ROOT_DIR, "wrangler.jsonc");
const KEY_NAME = "NEXT_SERVER_ACTIONS_ENCRYPTION_KEY";

function printUsage() {
  console.error(
    "Usage: node scripts/cloudflare/sync-server-actions-key.mjs [--env <preview|production|all>] [--scope <gateway|split|all>] [--dry-run] [--env-file <path>]",
  );
}

function parseArgs(argv) {
  const args = {
    env: "all",
    scope: "split",
    dryRun: false,
    envFile: null,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--env" && i + 1 < argv.length) {
      args.env = argv[++i];
      continue;
    }
    if (arg === "--scope" && i + 1 < argv.length) {
      args.scope = argv[++i];
      continue;
    }
    if (arg === "--dry-run") {
      args.dryRun = true;
      continue;
    }
    if (arg === "--env-file" && i + 1 < argv.length) {
      args.envFile = argv[++i];
      continue;
    }

    console.error(`[server-actions-key] unknown argument: ${arg}`);
    printUsage();
    process.exit(1);
  }

  if (!["preview", "production", "all"].includes(args.env)) {
    console.error(
      `[server-actions-key] invalid --env value: ${args.env} (expected preview|production|all)`,
    );
    process.exit(1);
  }

  if (!["gateway", "split", "all"].includes(args.scope)) {
    console.error(
      `[server-actions-key] invalid --scope value: ${args.scope} (expected gateway|split|all)`,
    );
    process.exit(1);
  }

  return args;
}

function envSelectionIncludesProduction(envName) {
  return envName === "production" || envName === "all";
}

function loadCommandEnv(args) {
  const keyWasSetBefore = Boolean(process.env[KEY_NAME]?.trim());
  const includesProduction = envSelectionIncludesProduction(args.env);
  const allowDefaultLocalEnv = !includesProduction;

  if (!allowDefaultLocalEnv && !args.envFile) {
    console.log(
      "[server-actions-key] production/all sync: repo-local .env auto-load skipped; use shell env or --env-file explicitly.",
    );
  }

  let loadedFiles;
  try {
    loadedFiles = loadLocalEnv(ROOT_DIR, {
      allowDefault: allowDefaultLocalEnv,
      envFile: args.envFile,
    });
  } catch (error) {
    console.error(`[server-actions-key] ${(error && error.message) || error}`);
    process.exit(1);
  }

  if (loadedFiles.length > 0) {
    console.log(
      `[server-actions-key] loaded env file(s): ${loadedFiles.join(", ")}`,
    );
  }

  const keySource = keyWasSetBefore
    ? "shell environment"
    : loadedFiles.length > 0
      ? "loaded env file"
      : "not set by shell or loaded env file";
  console.log(`[server-actions-key] ${KEY_NAME} source: ${keySource}`);
}

function getWorkerNames(baseWorkerName, scope) {
  const workers = [];
  if (scope === "gateway" || scope === "all") {
    workers.push(baseWorkerName);
  }
  if (scope === "split" || scope === "all") {
    workers.push(...getPhase6ServerActionsKeyWorkerNames(baseWorkerName));
  }
  return [...new Set(workers)];
}

async function main() {
  const args = parseArgs(process.argv);
  loadCommandEnv(args);
  const key = process.env[KEY_NAME]?.trim();
  if (!key) {
    console.error(
      `[server-actions-key] missing ${KEY_NAME}. Example: ${KEY_NAME}="$(openssl rand -base64 32)" pnpm cf:sync:server-actions-key`,
    );
    process.exit(1);
  }

  if (key.length < 32) {
    console.error(
      `[server-actions-key] ${KEY_NAME} is too short (current length: ${key.length}, expected >= 32).`,
    );
    process.exit(1);
  }

  const wranglerText = await readFile(WRANGLER_CONFIG_PATH, "utf8");
  const wranglerConfig = parseJsoncText(WRANGLER_CONFIG_PATH, wranglerText);
  const baseWorkerName = wranglerConfig.name ?? "showcase-website";

  const workers = getWorkerNames(baseWorkerName, args.scope);
  const envs = args.env === "all" ? ["preview", "production"] : [args.env];

  console.log(
    `[server-actions-key] target workers: ${workers.join(", ")} | envs: ${envs.join(", ")}`,
  );

  for (const worker of workers) {
    for (const envName of envs) {
      const commandArgs = [
        "exec",
        "wrangler",
        "secret",
        "put",
        KEY_NAME,
        "--name",
        worker,
        "--env",
        envName,
      ];

      const printable = `pnpm ${commandArgs.join(" ")}`;
      if (args.dryRun) {
        console.log(`[server-actions-key][dry-run] ${printable}`);
        continue;
      }

      console.log(
        `[server-actions-key] syncing ${KEY_NAME} -> worker=${worker} env=${envName}`,
      );

      const result = spawnSync("pnpm", commandArgs, {
        cwd: ROOT_DIR,
        stdio: ["pipe", "inherit", "inherit"],
        input: `${key}\n`,
        encoding: "utf8",
      });

      if (result.status !== 0) {
        console.error(
          `[server-actions-key] failed for worker=${worker} env=${envName}`,
        );
        process.exit(result.status ?? 1);
      }
    }
  }

  console.log("[server-actions-key] sync complete");
}

main().catch((error) => {
  console.error("[server-actions-key] unexpected error:", error);
  process.exit(1);
});
