#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".d.ts"];
const INDEX_CANDIDATES = [
  "index.ts",
  "index.tsx",
  "index.js",
  "index.jsx",
  "index.d.ts",
];
const TOP_LEVEL_NAMESPACE_PATTERNS = [
  /^src\/lib\/[^/]+\.ts$/,
  /^src\/types\/[^/]+\.ts$/,
  /^src\/config\/[^/]+\.ts$/,
];
const IGNORE_CANDIDATE_PATTERNS = [/\.d\.ts$/, /\.generated\.[jt]s$/];
const TEST_PATH_PATTERNS = [
  /(^|\/)__tests__\//,
  /(^|\/)tests\//,
  /(^|\/)src\/test\//,
  /\.(test|spec)\.[jt]sx?$/,
];
const args = process.argv.slice(2);
const isJson = args.includes("--json");

function isTestPath(relPath) {
  return TEST_PATH_PATTERNS.some((pattern) => pattern.test(relPath));
}

function isCandidateFile(relPath) {
  if (IGNORE_CANDIDATE_PATTERNS.some((pattern) => pattern.test(relPath))) {
    return false;
  }
  return TOP_LEVEL_NAMESPACE_PATTERNS.some((pattern) => pattern.test(relPath));
}

function collectFiles(dir, results = []) {
  if (!fs.existsSync(dir)) return results;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (
      entry.name === "node_modules" ||
      entry.name === ".next" ||
      entry.name === ".git"
    ) {
      continue;
    }

    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(absolute, results);
      continue;
    }

    if (SOURCE_EXTENSIONS.some((ext) => absolute.endsWith(ext))) {
      results.push(absolute);
    }
  }

  return results;
}

function toRepoPath(absolutePath) {
  return path.relative(ROOT, absolutePath).split(path.sep).join("/");
}

function tryResolveBase(basePath) {
  if (fs.existsSync(basePath) && fs.statSync(basePath).isFile()) {
    return basePath;
  }

  for (const ext of SOURCE_EXTENSIONS) {
    const withExt = `${basePath}${ext}`;
    if (fs.existsSync(withExt) && fs.statSync(withExt).isFile()) {
      return withExt;
    }
  }

  if (fs.existsSync(basePath) && fs.statSync(basePath).isDirectory()) {
    for (const indexFile of INDEX_CANDIDATES) {
      const indexPath = path.join(basePath, indexFile);
      if (fs.existsSync(indexPath) && fs.statSync(indexPath).isFile()) {
        return indexPath;
      }
    }
  }

  return null;
}

function resolveImport(importerFile, specifier) {
  if (!specifier) return null;

  if (specifier.startsWith("@/")) {
    return tryResolveBase(path.join(ROOT, "src", specifier.slice(2)));
  }

  if (specifier.startsWith(".")) {
    return tryResolveBase(path.resolve(path.dirname(importerFile), specifier));
  }

  return null;
}

function extractSpecifiers(content) {
  const specifiers = new Set();
  const patterns = [
    /\bimport\s+(?:type\s+)?(?:[^"'`]+?\s+from\s+)?["'`]([^"'`]+)["'`]/g,
    // Side-effect-only imports: `import "some-polyfill";`
    /\bimport\s+["'`]([^"'`]+)["'`]/g,
    /\bexport\s+(?:type\s+)?[^"'`]*?\sfrom\s+["'`]([^"'`]+)["'`]/g,
    /\brequire\(\s*["'`]([^"'`]+)["'`]\s*\)/g,
    /\bimport\(\s*["'`]([^"'`]+)["'`]\s*\)/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content))) {
      if (match[1]) specifiers.add(match[1]);
    }
  }

  return [...specifiers];
}

function buildConsumerMap(files) {
  const consumers = new Map();

  for (const importerFile of files) {
    const content = fs.readFileSync(importerFile, "utf8");
    const importerRel = toRepoPath(importerFile);

    for (const specifier of extractSpecifiers(content)) {
      const resolved = resolveImport(importerFile, specifier);
      if (!resolved) continue;

      const resolvedRel = toRepoPath(resolved);
      if (!consumers.has(resolvedRel)) {
        consumers.set(resolvedRel, new Set());
      }
      consumers.get(resolvedRel).add(importerRel);
    }
  }

  return consumers;
}

function main() {
  const files = [
    ...collectFiles(path.join(ROOT, "src")),
    ...collectFiles(path.join(ROOT, "tests")),
  ];
  const consumerMap = buildConsumerMap(files);
  const candidates = files.map(toRepoPath).filter(isCandidateFile).sort();

  const issues = [];

  for (const candidate of candidates) {
    const importers = [...(consumerMap.get(candidate) || new Set())].filter(
      (importer) => importer !== candidate,
    );
    const prodImporters = importers.filter((importer) => !isTestPath(importer));
    const testImporters = importers.filter(isTestPath);

    if (prodImporters.length === 0 && testImporters.length === 0) {
      issues.push({
        file: candidate,
        kind: "zero-consumer-entrypoint",
        message: "Top-level production-namespace entrypoint has no consumers.",
      });
      continue;
    }

    if (prodImporters.length === 0 && testImporters.length > 0) {
      issues.push({
        file: candidate,
        kind: "test-only-entrypoint",
        message:
          "Top-level production-namespace entrypoint is only consumed by tests.",
        consumers: testImporters,
      });
    }
  }

  const result = {
    status: issues.length === 0 ? "passed" : "failed",
    issueCount: issues.length,
    issues,
  };

  if (isJson) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else if (issues.length === 0) {
    console.log("review-hygiene: passed");
  } else {
    console.error("review-hygiene: failed");
    for (const issue of issues) {
      console.error(`- [${issue.kind}] ${issue.file}: ${issue.message}`);
      if (issue.consumers?.length) {
        for (const consumer of issue.consumers) {
          console.error(`  - consumer: ${consumer}`);
        }
      }
    }
  }

  process.exit(issues.length === 0 ? 0 : 1);
}

main();
