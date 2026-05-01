#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const TARGET_FILES = [
  "scripts/structural-hotspots.js",
  "scripts/semgrep-common.js",
];
const GUARDED_KEYS = [
  "STRUCTURAL_HOTSPOT_DAYS",
  "STRUCTURAL_HOTSPOT_TOP",
  "STRUCTURAL_COUPLING_TOP",
  "SEMGREP_PYTHON",
  "SEMGREP_BIN",
  "HOME",
];

const DIRECT_ENV_PATTERN = new RegExp(
  String.raw`process\.env(?:\.(${GUARDED_KEYS.join("|")})|\[['"](${GUARDED_KEYS.join("|")})['"]\])`,
  "g",
);

function getLineNumber(content, index) {
  return content.slice(0, index).split("\n").length;
}

function scanAnalysisEnvBoundaries() {
  const issues = [];

  for (const relPath of TARGET_FILES) {
    const absolutePath = path.join(ROOT, relPath);
    if (!fs.existsSync(absolutePath)) continue;

    const content = fs.readFileSync(absolutePath, "utf8");
    let match;

    while ((match = DIRECT_ENV_PATTERN.exec(content))) {
      const envKey = match[1] || match[2] || "unknown";
      issues.push({
        file: relPath,
        line: getLineNumber(content, match.index),
        detail: `Analysis script env \`${envKey}\` should read through scripts/lib/runtime-env.js instead of direct process.env access.`,
      });
    }
  }

  return issues;
}

function main() {
  const issues = scanAnalysisEnvBoundaries();

  if (issues.length === 0) {
    console.log("review:analysis-env-boundaries passed");
    return;
  }

  console.error("review:analysis-env-boundaries failed");
  for (const issue of issues) {
    console.error(`- ${issue.file}:${issue.line} ${issue.detail}`);
  }
  process.exit(1);
}

main();
