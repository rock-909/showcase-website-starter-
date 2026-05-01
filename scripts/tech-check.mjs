import { readFileSync } from "node:fs";
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

function formatStatus(ok) {
  return ok ? "PASS" : "FAIL";
}

function runCommand(label, command, args, options = {}) {
  console.log(`\n=== ${label} ===`);

  const result = spawnSync(command, args, {
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
    ...options,
  });

  printOutput(result.stdout);
  printOutput(result.stderr, process.stderr);

  const ok =
    !result.error &&
    !result.signal &&
    (result.status === 0 || result.status === null);

  if (result.error) {
    console.error(result.error.message);
  }

  if (result.signal) {
    console.error(`${label} terminated by signal ${result.signal}`);
  }

  return {
    label,
    ok,
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
    // Fall back to extracting the JSON object from mixed stdout/stderr content.
  }

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

function parseAudit(stdout) {
  const data = safeJsonParse(stdout);
  if (!data || typeof data !== "object") {
    return [];
  }

  const advisories = Object.values(data.advisories ?? {});
  return advisories.map((advisory) => ({
    module: advisory.module_name,
    severity: advisory.severity,
    recommendation: advisory.recommendation,
    title: advisory.title,
  }));
}

function unique(items) {
  return [...new Set(items)];
}

function readPackageJson() {
  return JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  );
}

function parseVersionParts(version) {
  const match = String(version).match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    return null;
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function classifyUpdateRisk(current, latest) {
  const currentParts = parseVersionParts(current);
  const latestParts = parseVersionParts(latest);

  if (!currentParts || !latestParts) {
    return "recommended_update";
  }

  if (latestParts.major !== currentParts.major) {
    return "breaking_change_risk";
  }

  if (currentParts.major === 0 && latestParts.minor !== currentParts.minor) {
    return "breaking_change_risk";
  }

  return "recommended_update";
}

function compareVersionParts(left, right) {
  if (left.major !== right.major) {
    return left.major - right.major;
  }

  if (left.minor !== right.minor) {
    return left.minor - right.minor;
  }

  return left.patch - right.patch;
}

function formatVersionParts(parts) {
  return `${parts.major}.${parts.minor}.${parts.patch}`;
}

function parseNodeEngineRange(engineRange) {
  const match = String(engineRange).match(
    /^>=\s*(\d+)(?:\.(\d+))?(?:\.(\d+))?\s*<\s*(\d+)(?:\.(\d+))?(?:\.(\d+))?$/,
  );
  if (!match) {
    return null;
  }

  const min = {
    major: Number(match[1]),
    minor: Number(match[2] ?? 0),
    patch: Number(match[3] ?? 0),
  };
  const maxExclusive = {
    major: Number(match[4]),
    minor: Number(match[5] ?? 0),
    patch: Number(match[6] ?? 0),
  };
  const supportedMajors = [];

  for (let major = min.major; major < maxExclusive.major; major += 1) {
    supportedMajors.push(major);
  }

  return {
    min,
    maxExclusive,
    supportedMajors,
  };
}

function isVersionWithinRange(version, range) {
  return (
    compareVersionParts(version, range.min) >= 0 &&
    compareVersionParts(version, range.maxExclusive) < 0
  );
}

function detectRuntimeAlignmentRisk(pkg, supportedNodeMajors) {
  if (pkg.name !== "@types/node") {
    return null;
  }

  const currentParts = parseVersionParts(pkg.current);
  const latestParts = parseVersionParts(pkg.latest);

  if (!currentParts || !latestParts || supportedNodeMajors.length === 0) {
    return null;
  }

  const currentAligned = supportedNodeMajors.includes(currentParts.major);
  const latestAligned = supportedNodeMajors.includes(latestParts.major);

  if (latestAligned) {
    return null;
  }

  return {
    name: pkg.name,
    current: pkg.current,
    latest: pkg.latest,
    supportedNodeMajors,
    currentAligned,
    latestAligned,
  };
}

function printList(title, items, formatter = (item) => item) {
  console.log(`${title}: ${items.length === 0 ? "none" : ""}`);

  for (const item of items) {
    console.log(`- ${formatter(item)}`);
  }
}

function summarizeUpdates(outdatedPackages, vulnerabilities) {
  const vulnerableModules = new Map();
  for (const vulnerability of vulnerabilities) {
    const current = vulnerableModules.get(vulnerability.module);
    if (!current) {
      vulnerableModules.set(vulnerability.module, vulnerability);
      continue;
    }

    const severityRank = ["info", "low", "moderate", "high", "critical"];
    if (
      severityRank.indexOf(vulnerability.severity) >
      severityRank.indexOf(current.severity)
    ) {
      vulnerableModules.set(vulnerability.module, vulnerability);
    }
  }

  return outdatedPackages.map((pkg) => {
    const vulnerability = vulnerableModules.get(pkg.name);
    return {
      ...pkg,
      vulnerability,
    };
  });
}

const stepResults = [];
const packageJson = readPackageJson();
const nodeEngineRange = parseNodeEngineRange(packageJson.engines?.node);
const supportedNodeMajors = nodeEngineRange?.supportedMajors ?? [];
const currentNodeVersion = parseVersionParts(process.version.replace(/^v/, ""));
const nodeRuntimeWithinPolicy =
  nodeEngineRange && currentNodeVersion
    ? isVersionWithinRange(currentNodeVersion, nodeEngineRange)
    : null;

console.log(`Node.js: ${process.version}`);
if (nodeEngineRange && currentNodeVersion) {
  console.log(
    `Node policy: ${packageJson.engines?.node} (current=${formatVersionParts(
      currentNodeVersion,
    )}, min=${formatVersionParts(nodeEngineRange.min)}, max_exclusive=${formatVersionParts(
      nodeEngineRange.maxExclusive,
    )}, status=${nodeRuntimeWithinPolicy ? "within_range" : "outside_range"})`,
  );
}
stepResults.push(runCommand("pnpm version", "pnpm", ["--version"]));

const outdatedResult = runCommand("dependency updates", "pnpm", [
  "outdated",
  "--format",
  "json",
]);
stepResults.push(outdatedResult);

const auditResult = runCommand("dependency audit", "pnpm", [
  "audit",
  "--prod",
  "--json",
  "--audit-level",
  "moderate",
]);
stepResults.push(auditResult);

stepResults.push(runCommand("config consistency", "pnpm", ["config:check"]));
stepResults.push(runCommand("production config", "pnpm", ["validate:config"]));
stepResults.push(runCommand("type check", "pnpm", ["type-check"]));
stepResults.push(runCommand("lint check", "pnpm", ["lint:check"]));
stepResults.push(runCommand("build", "pnpm", ["build"]));
stepResults.push(runCommand("cloudflare build", "pnpm", ["build:cf"]));

const outdatedPackages = parseOutdated(outdatedResult.stdout);
const vulnerabilities = parseAudit(auditResult.stdout);
const updateSummary = summarizeUpdates(outdatedPackages, vulnerabilities);

const needsUpdate = updateSummary.map((pkg) => ({
  name: pkg.name,
  current: pkg.current,
  latest: pkg.latest,
  isDeprecated: pkg.isDeprecated,
  dependencyType: pkg.dependencyType,
  vulnerability: pkg.vulnerability,
  risk: classifyUpdateRisk(pkg.current, pkg.latest),
}));

const { actionableUpdates, heldUpdates } =
  partitionDependencyUpdates(needsUpdate);

const recommendedUpdate = actionableUpdates.filter(
  (item) => item.risk === "recommended_update",
);
const breakingChangeRisk = actionableUpdates.filter(
  (item) => item.risk === "breaking_change_risk",
);
const runtimeAlignmentRisk = actionableUpdates
  .map((item) => detectRuntimeAlignmentRisk(item, supportedNodeMajors))
  .filter(Boolean);
const dependencyUpdatesReviewed = canTreatOutdatedResultAsReviewed(
  outdatedResult,
  needsUpdate,
);

const failedChecks = stepResults
  .filter(
    (step) =>
      !step.ok &&
      !(
        step.label === "dependency updates" &&
        dependencyUpdatesReviewed === true
      ),
  )
  .map((step) => step.label);

if (nodeRuntimeWithinPolicy === false) {
  failedChecks.unshift("node runtime policy");
}

const needsFix = stepResults
  .filter(
    (step) =>
      !step.ok &&
      [
        "config consistency",
        "production config",
        "type check",
        "lint check",
      ].includes(step.label),
  )
  .map((step) => step.label);

const needsInvestigation = stepResults
  .filter(
    (step) => !step.ok && ["build", "cloudflare build"].includes(step.label),
  )
  .map((step) => step.label);

const passedChecks = stepResults
  .filter(
    (step) =>
      step.ok ||
      (step.label === "dependency updates" &&
        dependencyUpdatesReviewed === true),
  )
  .map((step) => step.label);
const vulnerableModules = unique(vulnerabilities.map((item) => item.module));

console.log("\n=== summary ===");
console.log(`overall: ${failedChecks.length === 0 ? "PASS" : "FAIL"}`);

printList("failed_checks", failedChecks);
printList("passed_checks", passedChecks);
if (nodeEngineRange && currentNodeVersion) {
  printList("node_runtime_policy", [
    `${packageJson.engines?.node} (current=${formatVersionParts(
      currentNodeVersion,
    )}, min=${formatVersionParts(nodeEngineRange.min)}, max_exclusive=${formatVersionParts(
      nodeEngineRange.maxExclusive,
    )}, status=${nodeRuntimeWithinPolicy ? "within_range" : "outside_range"})`,
  ]);
}

printList("needs_update", actionableUpdates, (item) => {
  const securityNote = item.vulnerability
    ? `, security=${item.vulnerability.severity}`
    : "";
  return `${item.name} ${item.current} -> ${item.latest} (${item.dependencyType}${securityNote})`;
});
printList("held_updates", heldUpdates, (item) => {
  const deprecatedNote = item.isDeprecated ? ", deprecated" : "";
  return `${item.name} ${item.current} -> ${item.latest} (${item.dependencyType}${deprecatedNote}, ${item.hold.status})`;
});
printList("recommended_update", recommendedUpdate, (item) => {
  const securityNote = item.vulnerability
    ? `, security=${item.vulnerability.severity}`
    : "";
  return `${item.name} ${item.current} -> ${item.latest} (${item.dependencyType}${securityNote})`;
});
printList("breaking_change_risk", breakingChangeRisk, (item) => {
  const securityNote = item.vulnerability
    ? `, security=${item.vulnerability.severity}`
    : "";
  return `${item.name} ${item.current} -> ${item.latest} (${item.dependencyType}${securityNote})`;
});
printList("runtime_alignment_risk", runtimeAlignmentRisk, (item) => {
  const supported = item.supportedNodeMajors.join(", ");
  const currentNote = item.currentAligned
    ? "current_aligned"
    : "current_not_aligned";
  return `${item.name} ${item.current} -> ${item.latest} (supported_node_majors=${supported}, ${currentNote}, latest_not_aligned)`;
});

printList("needs_fix", needsFix);
printList("needs_investigation", needsInvestigation);
printList("vulnerable_modules", vulnerableModules);

console.log("\nclassification:");
console.log(
  "- `needs_update` means package versions should be reviewed or upgraded.",
);
console.log(
  "- `held_updates` means the package was reviewed and intentionally kept out of the current upgrade lane.",
);
console.log(
  "- `recommended_update` means patch/minor upgrades with lower compatibility risk.",
);
console.log(
  "- `breaking_change_risk` means major upgrades, or `0.x` minor upgrades that should be validated more carefully.",
);
console.log(
  "- `runtime_alignment_risk` means the package should track the project's declared runtime support rather than npm `latest`.",
);
console.log(
  "- `needs_fix` means code or config is failing without implying a package upgrade.",
);
console.log(
  "- `needs_investigation` means the build chain failed and may be caused by code, config, env, or version compatibility.",
);

process.exit(failedChecks.length === 0 ? 0 : 1);
