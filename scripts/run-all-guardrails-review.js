#!/usr/bin/env node

const { spawnSync } = require("child_process");
const {
  formatDuration,
  writeGuardrailSummary,
} = require("./lib/guardrail-report");

const GROUPS = [
  {
    name: "architecture-truth",
    label: "应用主树 / truth guardrails",
    command: ["pnpm", "review:architecture-truth"],
  },
  {
    name: "scripts-env",
    label: "Scripts env guardrails",
    command: ["pnpm", "review:scripts-env"],
  },
];

function runGroup(group) {
  console.log(`\n[guardrails] ${group.label}: ${group.command.join(" ")}`);
  const start = Date.now();
  const result = spawnSync(group.command[0], group.command.slice(1), {
    stdio: "inherit",
    shell: true,
    env: process.env,
  });
  const durationMs = Date.now() - start;

  if (result.status !== 0) {
    return {
      ...group,
      status: "failed",
      exitCode: result.status ?? 1,
      durationMs,
    };
  }

  return {
    ...group,
    status: "passed",
    exitCode: 0,
    durationMs,
  };
}

function printSummary(results, reportPaths) {
  console.log("\n[guardrails] Summary");
  for (const result of results) {
    console.log(
      `- ${result.label}: ${result.status} in ${formatDuration(result.durationMs)}`,
    );
  }
  console.log(`[guardrails] Summary written: ${reportPaths.latestPath}`);
}

function main() {
  console.log("[guardrails] Running grouped guardrail reviews");
  const results = [];
  let exitCode = 0;

  for (const group of GROUPS) {
    const result = runGroup(group);
    results.push(result);
    if (result.status !== "passed") {
      exitCode = result.exitCode;
      break;
    }
  }

  const reportPaths = writeGuardrailSummary("all-guardrails-summary", {
    createdAt: new Date().toISOString(),
    status: exitCode === 0 ? "passed" : "failed",
    results,
  });

  printSummary(results, reportPaths);

  if (exitCode !== 0) {
    throw new Error(
      `[guardrails] Failed groups detected (exit code ${exitCode})`,
    );
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
