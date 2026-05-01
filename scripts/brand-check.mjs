#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const SCAN_ROOTS = [
  "README.md",
  "AGENTS.md",
  "CLAUDE.md",
  "CLAUDE.local.md",
  "PRODUCT.md",
  "DESIGN.md",
  "HANDOFF.md",
  "package.json",
  "src",
  "content",
  "messages",
  "public",
  "tests",
  "scripts",
  "docs",
];

const SOURCE_EXTENSIONS = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mdx",
  ".mjs",
  ".svg",
  ".ts",
  ".tsx",
  ".txt",
  ".yml",
  ".yaml",
]);

const EXCLUDED_DIRS = new Set([
  ".git",
  ".next",
  ".open-next",
  ".wrangler",
  "coverage",
  "node_modules",
  "reports",
  "storybook-static",
]);

const FORBIDDEN_MARKERS = [
  "Tianze",
  "天泽",
  "tianze-pipe",
  "Lianyungang Tianze",
  "TIANZE-DESIGN",
  "b2b-web-template",
  "PVC conduit",
  "PETG pneumatic",
];

const SELF_PATH = "scripts/brand-check.mjs";

function toRepoPath(absolutePath) {
  return path.relative(ROOT, absolutePath).split(path.sep).join("/");
}

function isSourceFile(filePath) {
  return SOURCE_EXTENSIONS.has(path.extname(filePath));
}

function collectFiles(targetPath, results = []) {
  if (!existsSync(targetPath)) return results;

  const stats = readdirSync(path.dirname(targetPath), {
    withFileTypes: true,
  }).find((entry) => entry.name === path.basename(targetPath));

  if (stats?.isFile()) {
    if (isSourceFile(targetPath)) results.push(targetPath);
    return results;
  }

  for (const entry of readdirSync(targetPath, { withFileTypes: true })) {
    if (EXCLUDED_DIRS.has(entry.name)) continue;

    const absolutePath = path.join(targetPath, entry.name);
    if (entry.isDirectory()) {
      collectFiles(absolutePath, results);
      continue;
    }

    if (entry.isFile() && isSourceFile(absolutePath)) {
      results.push(absolutePath);
    }
  }

  return results;
}

function getLineNumber(content, index) {
  return content.slice(0, index).split("\n").length;
}

function scanFile(filePath) {
  const content = readFileSync(filePath, "utf8");
  if (toRepoPath(filePath) === SELF_PATH) {
    return [];
  }

  const findings = [];

  for (const marker of FORBIDDEN_MARKERS) {
    const haystack =
      marker === marker.toLowerCase() ? content.toLowerCase() : content;
    const needle =
      marker === marker.toLowerCase() ? marker.toLowerCase() : marker;
    let searchIndex = 0;

    while (true) {
      const index = haystack.indexOf(needle, searchIndex);
      if (index === -1) break;
      findings.push({
        file: toRepoPath(filePath),
        line: getLineNumber(content, index),
        marker,
      });
      searchIndex = index + needle.length;
    }
  }

  return findings;
}

function main() {
  const files = SCAN_ROOTS.flatMap((scanRoot) =>
    collectFiles(path.join(ROOT, scanRoot)),
  );
  const findings = files.flatMap(scanFile);

  if (findings.length === 0) {
    console.log("brand:check passed");
    return;
  }

  console.error("brand:check failed: old project brand markers remain");
  for (const finding of findings) {
    console.error(
      `- ${finding.file}:${finding.line} forbidden marker "${finding.marker}"`,
    );
  }
  process.exit(1);
}

main();
