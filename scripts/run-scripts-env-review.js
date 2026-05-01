#!/usr/bin/env node

const { spawnSync } = require("child_process");
const {
  formatDuration,
  writeGuardrailSummary,
} = require("./lib/guardrail-report");

const LANES = [
  {
    name: "proof-env-boundaries",
    label: "Proof lane",
    command: ["pnpm", "review:proof-env-boundaries"],
  },
  {
    name: "ci-env-boundaries",
    label: "CI gate lane",
    command: ["pnpm", "review:ci-env-boundaries"],
  },
  {
    name: "analysis-env-boundaries",
    label: "Analysis lane",
    command: ["pnpm", "review:analysis-env-boundaries"],
  },
];

function runLane(lane) {
  console.log(`\n[scripts-env] ${lane.label}: ${lane.command.join(" ")}`);
  const start = Date.now();

  const result = spawnSync(lane.command[0], lane.command.slice(1), {
    stdio: "inherit",
    shell: true,
    env: process.env,
  });

  const durationMs = Date.now() - start;

  if (result.status !== 0) {
    return {
      ...lane,
      status: "failed",
      exitCode: result.status ?? 1,
      durationMs,
    };
  }

  return {
    ...lane,
    status: "passed",
    exitCode: 0,
    durationMs,
  };
}

function printSummary(results, reportPaths) {
  console.log("\n[scripts-env] Summary");
  for (const result of results) {
    console.log(
      `- ${result.label}: ${result.status} in ${formatDuration(result.durationMs)}`,
    );
  }
  console.log(`[scripts-env] Summary written: ${reportPaths.latestPath}`);
}

function main() {
  console.log("[scripts-env] Running scripts env review lanes");
  const results = [];
  let exitCode = 0;

  for (const lane of LANES) {
    const result = runLane(lane);
    results.push(result);
    if (result.status !== "passed") {
      exitCode = result.exitCode;
      break;
    }
  }

  const reportPaths = writeGuardrailSummary("scripts-env-summary", {
    createdAt: new Date().toISOString(),
    status: exitCode === 0 ? "passed" : "failed",
    results,
  });

  printSummary(results, reportPaths);

  if (exitCode !== 0) {
    throw new Error(
      `[scripts-env] Failed lanes detected (exit code ${exitCode})`,
    );
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
