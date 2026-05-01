#!/usr/bin/env node
const { spawnSync } = require("node:child_process");

const criticalCommands = [
  ["pnpm", ["test:mutation:idempotency"]],
  ["pnpm", ["test:mutation:security"]],
  ["pnpm", ["test:mutation:lead"]],
];

for (const [command, args] of criticalCommands) {
  console.log(
    `[review-mutation-critical] Running ${command} ${args.join(" ")}`,
  );
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("[review-mutation-critical] Critical mutation review completed.");
