import { spawnSync } from "node:child_process";

import {
  canTreatOutdatedResultAsReviewed,
  partitionDependencyUpdates,
} from "./dependency-update-policy.mjs";

function printOutput(text, writer = process.stdout) {
  if (!text) {
    return;
  }

  writer.write(text);
  if (!text.endsWith("\n")) {
    writer.write("\n");
  }
}

function runPnpm(label, args) {
  console.log(`\n=== pnpm ${label} ===`);
  const result = spawnSync("pnpm", args, {
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
  });

  printOutput(result.stdout);
  printOutput(result.stderr, process.stderr);

  if (result.error) {
    console.error(result.error.message);
  }

  if (result.signal) {
    console.error(`pnpm ${label} terminated by signal ${result.signal}`);
  }

  return {
    ok:
      !result.error &&
      !result.signal &&
      (result.status === 0 || result.status === null),
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    error: result.error ?? null,
    signal: result.signal ?? null,
  };
}

function safeJsonParse(text) {
  const trimmed = String(text).trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    const firstObject = trimmed.indexOf("{");
    const firstArray = trimmed.indexOf("[");
    const firstJsonStart =
      firstObject === -1
        ? firstArray
        : firstArray === -1
          ? firstObject
          : Math.min(firstObject, firstArray);
    const lastObject = trimmed.lastIndexOf("}");
    const lastArray = trimmed.lastIndexOf("]");
    const lastJsonEnd = Math.max(lastObject, lastArray);

    if (
      firstJsonStart === -1 ||
      lastJsonEnd === -1 ||
      lastJsonEnd <= firstJsonStart
    ) {
      return null;
    }

    try {
      return JSON.parse(trimmed.slice(firstJsonStart, lastJsonEnd + 1));
    } catch {
      return null;
    }
  }
}

function parseOutdated(stdout) {
  const data = safeJsonParse(stdout);
  if (!data) {
    return [];
  }

  if (Array.isArray(data)) {
    return data.map((details) => ({
      name: details.name,
      current: details.current,
      latest: details.latest,
      isDeprecated: details.isDeprecated === true,
      dependencyType: details.dependencyType,
    }));
  }

  return Object.entries(data).map(([name, details]) => ({
    name,
    current: details.current,
    latest: details.latest,
    isDeprecated: details.isDeprecated === true,
    dependencyType: details.dependencyType,
  }));
}

function printList(title, items, formatter) {
  console.log(`${title}: ${items.length === 0 ? "none" : ""}`);

  for (const item of items) {
    console.log(`- ${formatter(item)}`);
  }
}

const outdatedResult = runPnpm("outdated", ["outdated", "--format", "json"]);
const outdatedPackages = parseOutdated(outdatedResult.stdout);
const { actionableUpdates, heldUpdates } =
  partitionDependencyUpdates(outdatedPackages);
const outdatedReviewed = canTreatOutdatedResultAsReviewed(
  outdatedResult,
  outdatedPackages,
);

console.log("\n=== dependency update summary ===");
printList("actionable_updates", actionableUpdates, (item) => {
  const deprecatedNote = item.isDeprecated ? ", deprecated" : "";
  return `${item.name} ${item.current} -> ${item.latest} (${item.dependencyType}${deprecatedNote})`;
});
printList("held_updates", heldUpdates, (item) => {
  const deprecatedNote = item.isDeprecated ? ", deprecated" : "";
  return `${item.name} ${item.current} -> ${item.latest} (${item.dependencyType}${deprecatedNote}, ${item.hold.status})`;
});

const auditResult = runPnpm("audit", [
  "audit",
  "--prod",
  "--audit-level",
  "moderate",
]);

const exitCode =
  outdatedReviewed && actionableUpdates.length === 0 && auditResult.ok ? 0 : 1;

process.exit(exitCode);
