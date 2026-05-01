#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);
const BARREL_FILES = new Set([
  "index.ts",
  "index.tsx",
  "index.js",
  "index.jsx",
]);

const SOURCE_ROOTS = ["src"];
const EXCLUDED_SEGMENTS = [
  `${path.sep}__tests__${path.sep}`,
  `${path.sep}src${path.sep}test${path.sep}`,
  `${path.sep}src${path.sep}testing${path.sep}`,
];
const EXCLUDED_SUFFIXES = [".generated.ts", ".generated.js"];

const TEST_SPECIFIER_PATTERNS = [
  /(^|\/)__tests__(\/|$)/,
  /(^|\/)test-[^/]+/,
  /(^|\/)src\/test(\/|$)/,
  /(^|\/)src\/testing(\/|$)/,
  /^@\/test(\/|$)/,
  /^@\/testing(\/|$)/,
  /^@\/.*\/__tests__(\/|$)/,
  /^@\/.*\/test-[^/]+/,
  /^\.\.?\/.*__tests__(\/|$)/,
  /^\.\.?\/.*test-[^/]+/,
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

function isTestOnlyModule(relPath) {
  return (
    /(^|\/)__tests__(\/|$)/.test(relPath) ||
    /(^|\/)tests(\/|$)/.test(relPath) ||
    /(^|\/)src\/test(\/|$)/.test(relPath) ||
    /(^|\/)src\/testing(\/|$)/.test(relPath) ||
    /(^|\/)test-[^/]+\.[jt]sx?$/.test(relPath)
  );
}

function matchesTestSpecifier(specifier) {
  return TEST_SPECIFIER_PATTERNS.some((pattern) => pattern.test(specifier));
}

function extractSpecifiers(content) {
  const matches = [];
  const patterns = [
    /\bimport\s+(?:type\s+)?(?:[^"'`]+?\s+from\s+)?["'`]([^"'`]+)["'`]/g,
    /\bexport\s+(?:type\s+)?[^"'`]*?\sfrom\s+["'`]([^"'`]+)["'`]/g,
    /\brequire\(\s*["'`]([^"'`]+)["'`]\s*\)/g,
    /\bimport\(\s*["'`]([^"'`]+)["'`]\s*\)/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content))) {
      matches.push({ specifier: match[1], index: match.index });
    }
  }

  return matches;
}

function getLineNumber(content, index) {
  return content.slice(0, index).split("\n").length;
}

function pushIssue(issues, relPath, line, kind, detail) {
  issues.push({ file: relPath, line, kind, detail });
}

function scanBoundaryLeaks() {
  const files = SOURCE_ROOTS.flatMap((root) =>
    collectFiles(path.join(ROOT, root)),
  );
  const issues = [];

  for (const file of files) {
    const relPath = toRepoPath(file);
    const content = fs.readFileSync(file, "utf8");
    const specifiers = extractSpecifiers(content);

    if (!isTestOnlyModule(relPath)) {
      for (const entry of specifiers) {
        if (!matchesTestSpecifier(entry.specifier)) continue;
        pushIssue(
          issues,
          relPath,
          getLineNumber(content, entry.index),
          "production-imports-test-module",
          `Production source references test-only module \`${entry.specifier}\`.`,
        );
      }
    }

    if (!BARREL_FILES.has(path.basename(file))) continue;

    for (const entry of specifiers) {
      if (!matchesTestSpecifier(entry.specifier)) continue;
      pushIssue(
        issues,
        relPath,
        getLineNumber(content, entry.index),
        "barrel-exports-test-module",
        `Production barrel re-exports test-only module \`${entry.specifier}\`.`,
      );
    }

    const exportTestSymbolPattern =
      /export\s*\{[^}]*\bTEST_[A-Z0-9_]+\b[^}]*\}\s*from\s*["'`][^"'`]+["'`]/g;
    let match;
    while ((match = exportTestSymbolPattern.exec(content))) {
      pushIssue(
        issues,
        relPath,
        getLineNumber(content, match.index),
        "barrel-exports-test-symbol",
        "Production barrel exports TEST_* symbols.",
      );
    }
  }

  return issues;
}

function main() {
  const issues = scanBoundaryLeaks();

  if (issues.length === 0) {
    console.log("review:boundary-leaks passed");
    return;
  }

  console.error("review:boundary-leaks failed");
  for (const issue of issues) {
    console.error(
      `- [${issue.kind}] ${issue.file}:${issue.line} ${issue.detail}`,
    );
  }
  process.exit(1);
}

main();
