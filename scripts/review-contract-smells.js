#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);
const EXCLUDED_SEGMENTS = [
  `${path.sep}__tests__${path.sep}`,
  `${path.sep}src${path.sep}test${path.sep}`,
  `${path.sep}src${path.sep}testing${path.sep}`,
];
const EXCLUDED_SUFFIXES = [".generated.ts", ".generated.js"];

const SMELL_PATTERNS = [
  {
    kind: "forced-noop-cast",
    pattern: /Function\.prototype\s+as\s+unknown\s+as/g,
    detail:
      "Function.prototype is being forced through the type system. Model the contract instead of passing a fake callback.",
  },
  {
    kind: "undefined-double-cast",
    pattern: /undefined\s+as\s+unknown\s+as/g,
    detail:
      "undefined is being double-cast into another type. Prefer an explicit optional contract or a real fallback value.",
  },
  {
    kind: "null-double-cast",
    pattern: /null\s+as\s+unknown\s+as/g,
    detail:
      "null is being double-cast into another type. Prefer an explicit nullable contract instead of forcing compatibility.",
  },
];

function isExcluded(absolutePath) {
  return (
    EXCLUDED_SEGMENTS.some((segment) => absolutePath.includes(segment)) ||
    EXCLUDED_SUFFIXES.some((suffix) => absolutePath.endsWith(suffix))
  );
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

function scanContractSmells() {
  const files = collectFiles(path.join(ROOT, "src"));
  const issues = [];

  for (const file of files) {
    const relPath = toRepoPath(file);
    const content = fs.readFileSync(file, "utf8");

    for (const smell of SMELL_PATTERNS) {
      const regex = new RegExp(smell.pattern);
      let match;

      while ((match = regex.exec(content))) {
        issues.push({
          file: relPath,
          line: getLineNumber(content, match.index),
          kind: smell.kind,
          detail: smell.detail,
        });
      }
    }
  }

  return issues;
}

function main() {
  const issues = scanContractSmells();

  if (issues.length === 0) {
    console.log("review:contract-smells passed");
    return;
  }

  console.error("review:contract-smells failed");
  for (const issue of issues) {
    console.error(
      `- [${issue.kind}] ${issue.file}:${issue.line} ${issue.detail}`,
    );
  }
  process.exit(1);
}

main();
