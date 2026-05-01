#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const SOURCE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".json",
  ".md",
  ".mdx",
  ".svg",
  ".txt",
  ".html",
]);

const SCAN_ROOTS = ["public", "src/app", "src/components", "src/config"];
const EXCLUDED_SEGMENTS = [
  `${path.sep}__tests__${path.sep}`,
  `${path.sep}src${path.sep}test${path.sep}`,
  `${path.sep}src${path.sep}testing${path.sep}`,
  `${path.sep}content${path.sep}_archive${path.sep}`,
  `${path.sep}src${path.sep}components${path.sep}blocks${path.sep}_templates${path.sep}`,
];

const TEMPLATE_MARKERS = [
  "B2B Web Template",
  "showcase-website-starter.example.com",
  "Modern B2B Enterprise Web Platform",
];

const PLACEHOLDER_MARKERS = [
  "Coming Soon",
  "即将推出",
  "specsComingSoon",
  "comingSoon",
];

const ROUTE_FILE_NAMES = new Set([
  "page.tsx",
  "layout.tsx",
  "loading.tsx",
  "error.tsx",
  "template.tsx",
]);

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

function getLineNumber(content, marker) {
  const index = content.indexOf(marker);
  return index === -1 ? 1 : content.slice(0, index).split("\n").length;
}

function shouldCheckPlaceholder(relPath) {
  if (relPath.startsWith("src/components/") && relPath.endsWith(".tsx")) {
    return true;
  }

  return ROUTE_FILE_NAMES.has(path.basename(relPath));
}

function scanTemplateResidue() {
  const files = SCAN_ROOTS.flatMap((root) =>
    collectFiles(path.join(ROOT, root)),
  );
  const issues = [];

  for (const file of files) {
    const relPath = toRepoPath(file);
    const content = fs.readFileSync(file, "utf8");

    for (const marker of TEMPLATE_MARKERS) {
      if (!content.includes(marker)) continue;
      issues.push({
        file: relPath,
        line: getLineNumber(content, marker),
        kind: "template-residue",
        detail: `Template residue marker \`${marker}\` is still present.`,
      });
    }

    if (!shouldCheckPlaceholder(relPath)) continue;

    for (const marker of PLACEHOLDER_MARKERS) {
      if (!content.includes(marker)) continue;
      issues.push({
        file: relPath,
        line: getLineNumber(content, marker),
        kind: "live-placeholder",
        detail: `Live route/component still contains placeholder marker \`${marker}\`.`,
      });
    }
  }

  return issues;
}

function main() {
  const issues = scanTemplateResidue();

  if (issues.length === 0) {
    console.log("review:template-residue passed");
    return;
  }

  console.error("review:template-residue failed");
  for (const issue of issues) {
    console.error(
      `- [${issue.kind}] ${issue.file}:${issue.line} ${issue.detail}`,
    );
  }
  process.exit(1);
}

main();
