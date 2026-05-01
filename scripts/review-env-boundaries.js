#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);
const SCAN_ROOTS = ["src/app", "src/components"];
const EXCLUDED_SEGMENTS = [
  `${path.sep}__tests__${path.sep}`,
  `${path.sep}src${path.sep}test${path.sep}`,
  `${path.sep}src${path.sep}testing${path.sep}`,
];

const DIRECT_PUBLIC_ENV_PATTERN =
  /process\.env(?:\.NEXT_PUBLIC_[A-Z0-9_]+|\[['"]NEXT_PUBLIC_[A-Z0-9_]+['"]\])/g;

function isExcluded(absolutePath) {
  return EXCLUDED_SEGMENTS.some((segment) => absolutePath.includes(segment));
}

function isSourceFile(fileName) {
  return SOURCE_EXTENSIONS.has(path.extname(fileName));
}

function collectFiles(dir, results = []) {
  if (!fs.existsSync(dir)) return results;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".git", ".next"].includes(entry.name)) continue;

    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(absolutePath, results);
      continue;
    }

    if (isSourceFile(entry.name) && !isExcluded(absolutePath)) {
      results.push(absolutePath);
    }
  }

  return results;
}

function toRepoPath(absolutePath) {
  return path.relative(ROOT, absolutePath).split(path.sep).join("/");
}

function getLineNumber(content, index) {
  return content.slice(0, index).split("\n").length;
}

function scanEnvBoundaries() {
  const files = SCAN_ROOTS.flatMap((root) =>
    collectFiles(path.join(ROOT, root)),
  );
  const issues = [];

  for (const file of files) {
    const relPath = toRepoPath(file);
    const content = fs.readFileSync(file, "utf8");
    let match;

    while ((match = DIRECT_PUBLIC_ENV_PATTERN.exec(content))) {
      issues.push({
        file: relPath,
        line: getLineNumber(content, match.index),
        detail:
          "App/component layer should read NEXT_PUBLIC_* through '@/lib/public-env' instead of direct process.env access.",
      });
    }
  }

  return issues;
}

function main() {
  const issues = scanEnvBoundaries();

  if (issues.length === 0) {
    console.log("review:env-boundaries passed");
    return;
  }

  console.error("review:env-boundaries failed");
  for (const issue of issues) {
    console.error(`- ${issue.file}:${issue.line} ${issue.detail}`);
  }
  process.exit(1);
}

main();
