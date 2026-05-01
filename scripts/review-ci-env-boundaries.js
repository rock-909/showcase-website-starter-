#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const TARGET_FILE = "scripts/quality-gate.js";
const GUARDED_KEYS = [
  "QUALITY_ENABLE_COVERAGE",
  "QUALITY_DISABLE_COVERAGE",
  "QUALITY_ENABLE_PERFORMANCE",
  "QUALITY_DISABLE_PERFORMANCE",
  "QUALITY_DIFF_COVERAGE_THRESHOLD",
  "QUALITY_DIFF_COVERAGE_DROP_WARNING_THRESHOLD",
  "NODE_ENV",
  "CI",
  "GITHUB_REF_NAME",
  "QUALITY_DIFF_BASE",
  "QUALITY_COVERAGE_TIMEOUT_MS",
  "QUALITY_PERF_TEST_TIMEOUT_MS",
  "QUALITY_FORCE_SEMGREP",
  "GITHUB_ACTIONS",
  "GITHUB_OUTPUT",
];

const DIRECT_ENV_PATTERN = new RegExp(
  String.raw`process\.env(?:\.(${GUARDED_KEYS.join("|")})|\[['"](${GUARDED_KEYS.join("|")})['"]\])`,
  "g",
);

function getLineNumber(content, index) {
  return content.slice(0, index).split("\n").length;
}

function scanCiEnvBoundaries() {
  const absolutePath = path.join(ROOT, TARGET_FILE);
  if (!fs.existsSync(absolutePath)) {
    return [];
  }

  const content = fs.readFileSync(absolutePath, "utf8");
  const issues = [];
  let match;

  while ((match = DIRECT_ENV_PATTERN.exec(content))) {
    const envKey = match[1] || match[2] || "unknown";
    issues.push({
      file: TARGET_FILE,
      line: getLineNumber(content, match.index),
      detail: `CI gate env \`${envKey}\` should read through scripts/lib/runtime-env.js instead of direct process.env access.`,
    });
  }

  return issues;
}

function main() {
  const issues = scanCiEnvBoundaries();

  if (issues.length === 0) {
    console.log("review:ci-env-boundaries passed");
    return;
  }

  console.error("review:ci-env-boundaries failed");
  for (const issue of issues) {
    console.error(`- ${issue.file}:${issue.line} ${issue.detail}`);
  }
  process.exit(1);
}

main();
