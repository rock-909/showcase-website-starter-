import { spawnSync } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { getPhase6DeploymentOrder } from "./phase6-topology-contract.mjs";
import { parseJsoncText } from "./jsonc-utils.mjs";
import { loadLocalEnv } from "./load-local-env.mjs";

const ROOT_DIR = process.cwd();
const CONFIG_DIR = path.join(ROOT_DIR, ".open-next", "wrangler", "phase6");

const deploymentOrder = getPhase6DeploymentOrder();

// --- CLI argument parsing ---

const VALID_ENVS = new Set(["preview", "production"]);
const VALID_CONFIGS = new Set(deploymentOrder);

function parseArgs(argv) {
  const args = { env: null, only: null, dryRun: false, envFile: null };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--env" && i + 1 < argv.length) {
      args.env = argv[++i];
    } else if (arg === "--only" && i + 1 < argv.length) {
      args.only = argv[++i];
    } else if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--env-file" && i + 1 < argv.length) {
      args.envFile = argv[++i];
    } else {
      console.error(`[phase6] unknown argument: ${arg}`);
      printUsage();
      process.exit(1);
    }
  }

  return args;
}

function printUsage() {
  console.error(
    "Usage: node deploy-phase6.mjs --env <preview|production> [--only <config>] [--dry-run] [--env-file <path>]",
  );
}

const args = parseArgs(process.argv);

if (!args.env) {
  console.error(
    "[phase6] --env is required (no default to prevent wrong-env deploy)",
  );
  printUsage();
  process.exit(1);
}

if (!VALID_ENVS.has(args.env)) {
  console.error(
    `[phase6] invalid env "${args.env}", expected: preview | production`,
  );
  process.exit(1);
}

if (args.only) {
  // Allow both "gateway" and "gateway.jsonc"
  const normalized = args.only.endsWith(".jsonc")
    ? args.only
    : `${args.only}.jsonc`;
  if (!VALID_CONFIGS.has(normalized)) {
    console.error(`[phase6] invalid --only target "${args.only}"`);
    console.error(`[phase6] valid targets: ${[...VALID_CONFIGS].join(", ")}`);
    process.exit(1);
  }
  args.only = normalized;
}

const targetEnv = args.env;
const configsToDeployList = args.only ? [args.only] : deploymentOrder;

function loadCommandEnv() {
  const tokenWasSetBefore = Boolean(process.env.CLOUDFLARE_API_TOKEN?.trim());
  const allowDefaultLocalEnv = targetEnv !== "production";

  if (!allowDefaultLocalEnv && !args.envFile) {
    console.log(
      "[phase6] production deploy: repo-local .env auto-load skipped; use shell env or --env-file explicitly.",
    );
  }

  let loadedFiles;
  try {
    loadedFiles = loadLocalEnv(ROOT_DIR, {
      allowDefault: allowDefaultLocalEnv,
      envFile: args.envFile,
    });
  } catch (error) {
    console.error(`[phase6] ${(error && error.message) || error}`);
    process.exit(1);
  }

  if (loadedFiles.length > 0) {
    console.log(`[phase6] loaded env file(s): ${loadedFiles.join(", ")}`);
  }

  const tokenSource = tokenWasSetBefore
    ? "shell environment"
    : loadedFiles.length > 0
      ? "loaded env file"
      : "not set by shell or loaded env file";
  console.log(`[phase6] CLOUDFLARE_API_TOKEN source: ${tokenSource}`);
}

loadCommandEnv();

// --- Preflight checks ---

function checkAuth() {
  console.log("[phase6] preflight: checking wrangler authentication...");
  const result = spawnSync("pnpm", ["exec", "wrangler", "whoami"], {
    cwd: ROOT_DIR,
    stdio: "pipe",
    encoding: "utf8",
  });

  if (result.status !== 0) {
    console.error("[phase6] wrangler is not authenticated.");
    console.error(
      "[phase6] set CLOUDFLARE_API_TOKEN or run: pnpm exec wrangler login",
    );
    process.exit(1);
  }

  // Print account info for audit trail
  const output = (result.stdout ?? "").trim();
  const accountLine = output
    .split("\n")
    .find((line) => line.includes("Account ID"));
  if (accountLine) {
    console.log(`[phase6] ${accountLine.trim()}`);
  }
}

function printWranglerVersion() {
  const result = spawnSync("pnpm", ["exec", "wrangler", "--version"], {
    cwd: ROOT_DIR,
    stdio: "pipe",
    encoding: "utf8",
  });
  const version = (result.stdout ?? "").trim().split("\n")[0];
  console.log(`[phase6] wrangler version: ${version}`);
}

async function ensureConfigs() {
  for (const file of configsToDeployList) {
    const fullPath = path.join(CONFIG_DIR, file);
    try {
      await access(fullPath);
    } catch {
      console.error(
        `[phase6] missing config: ${path.relative(ROOT_DIR, fullPath)}`,
      );
      console.error("[phase6] run `pnpm deploy:cf:dry-run` or the stable deploy wrapper first.");
      process.exit(1);
    }
  }
}

async function readProductionDomainRouteStatus() {
  const gatewayConfigPath = path.join(CONFIG_DIR, "gateway.jsonc");

  try {
    const gatewayConfig = parseJsoncText(
      gatewayConfigPath,
      await readFile(gatewayConfigPath, "utf8"),
    );
    const routes = gatewayConfig.env?.production?.routes;
    return { status: "ok", routes: Array.isArray(routes) ? routes : [] };
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return { status: "missing", routes: [] };
    }
    throw new Error(
      `[phase6] cannot parse ${path.relative(ROOT_DIR, gatewayConfigPath)}: ${
        (error && error.message) || error
      }`,
      { cause: error },
    );
  }
}

async function printProductionCutoverBoundary() {
  if (targetEnv !== "production") {
    return;
  }

  let routeStatus;
  try {
    routeStatus = await readProductionDomainRouteStatus();
  } catch (error) {
    console.warn(
      `[phase6] production worker deploy boundary warning: ${
        (error && error.message) || error
      }`,
    );
    console.log(
      "[phase6] This deploy does not prove official-domain cutover. Confirm DNS/routes and run deployed smoke before calling the site live.",
    );
    return;
  }

  const { status, routes } = routeStatus;

  if (status === "missing") {
    console.log(
      "[phase6] production worker deploy boundary: gateway.jsonc is missing, so official-domain route status cannot be assessed.",
    );
    console.log(
      "[phase6] This deploy does not prove official-domain cutover. Confirm DNS/routes and run deployed smoke before calling the site live.",
    );
    return;
  }

  if (routes.length === 0) {
    console.log(
      "[phase6] production worker deploy boundary: no official-domain route is present in gateway.jsonc.",
    );
    console.log(
      "[phase6] This deploy does not prove official-domain cutover. Confirm DNS/routes and run deployed smoke before calling the site live.",
    );
    return;
  }

  const routePatterns = routes
    .map((route) =>
      typeof route === "string" ? route : route.pattern || "(unlabelled route)",
    )
    .filter(Boolean)
    .join(", ");
  console.log(
    `[phase6] production gateway includes domain route(s): ${routePatterns || "(unlabelled routes)"}.`,
  );
  console.log(
    "[phase6] Treat this as worker deployment only. Live-site readiness still requires explicit domain-cutover evidence and deployed smoke.",
  );
}

// --- Deployment ---

function runDeploy(configFile) {
  const fullPath = path.join(CONFIG_DIR, configFile);
  const commandArgs = [
    "exec",
    "wrangler",
    "deploy",
    "--config",
    fullPath,
    "--env",
    targetEnv,
  ];
  const basePrintable = `pnpm exec wrangler deploy --config ${path.relative(ROOT_DIR, fullPath)} --env ${targetEnv}`;

  if (args.dryRun) {
    commandArgs.push("--dry-run");
    console.log(`[phase6][dry-run] ${basePrintable} --dry-run`);
  } else {
    console.log(`[phase6] deploying ${configFile} (${targetEnv})`);
  }

  const result = spawnSync("pnpm", commandArgs, {
    cwd: ROOT_DIR,
    env: {
      ...process.env,
      OPEN_NEXT_DEPLOY: "true",
    },
    stdio: args.dryRun ? "pipe" : "inherit",
    encoding: args.dryRun ? "utf8" : undefined,
  });

  if (args.dryRun) {
    if (result.stdout) {
      process.stdout.write(result.stdout);
    }
    if (result.stderr) {
      process.stderr.write(result.stderr);
    }
  }

  if (result.status !== 0) {
    console.error(
      `[phase6] ${args.dryRun ? "dry-run" : "deployment"} failed for ${configFile}`,
    );
    process.exit(result.status ?? 1);
  }
}

// --- Main ---

if (!args.dryRun) {
  checkAuth();

  // Preflight: verify server-actions-key sync
  console.log("[phase6] preflight: syncing server-actions encryption key...");
  const syncArgs = [
    "scripts/cloudflare/sync-server-actions-key.mjs",
    "--env",
    targetEnv,
    "--scope",
    "split",
  ];
  if (args.envFile) {
    syncArgs.push("--env-file", args.envFile);
  }
  const syncResult = spawnSync("node", syncArgs, {
    cwd: ROOT_DIR,
    stdio: "inherit",
  });
  if (syncResult.status !== 0) {
    console.error(
      "[phase6] server-actions-key sync failed. Aborting deployment.",
    );
    process.exit(1);
  }
}
printWranglerVersion();
await ensureConfigs();

console.log(
  `[phase6] deploying ${configsToDeployList.length} worker(s) to ${targetEnv}`,
);

for (const file of configsToDeployList) {
  runDeploy(file);
}

if (args.dryRun) {
  console.log("[phase6] dry-run complete");
} else {
  console.log("[phase6] deployment complete");
}
await printProductionCutoverBoundary();
