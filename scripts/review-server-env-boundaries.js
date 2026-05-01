#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);
const SCAN_ROOTS = [
  "src/lib",
  "src/app",
  "src/components",
  "src/config",
  "src/middleware.ts",
];
const EXCLUDED_SEGMENTS = [
  `${path.sep}__tests__${path.sep}`,
  `${path.sep}src${path.sep}test${path.sep}`,
  `${path.sep}src${path.sep}testing${path.sep}`,
];
const EXCLUDED_FILES = new Set([
  "src/lib/env.ts",
  "src/lib/env-runtime.ts",
  "src/lib/logger.ts",
  "src/lib/public-env.ts",
]);
const GUARDED_KEYS = [
  "ADMIN_API_TOKEN",
  "CACHE_INVALIDATION_SECRET",
  "TURNSTILE_ALLOWED_ACTIONS",
  "TURNSTILE_BYPASS",
  "RATE_LIMIT_PEPPER",
  "RATE_LIMIT_PEPPER_PREVIOUS",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "KV_REST_API_URL",
  "KV_REST_API_TOKEN",
  "LOG_LEVEL",
  "CONTENT_ENABLE_DRAFTS",
  "DEPLOYMENT_PLATFORM",
  "VERCEL",
  "CF_PAGES",
  "GOOGLE_SITE_VERIFICATION",
  "YANDEX_VERIFICATION",
  "APP_ENV",
  "NODE_ENV",
];

const DIRECT_SERVER_ENV_PATTERN = new RegExp(
  String.raw`process\.env(?:\.(${GUARDED_KEYS.join("|")})|\[['"](${GUARDED_KEYS.join("|")})['"]\])`,
  "g",
);

function isExcluded(absolutePath) {
  const repoPath = toRepoPath(absolutePath);
  return (
    EXCLUDED_FILES.has(repoPath) ||
    EXCLUDED_SEGMENTS.some((segment) => absolutePath.includes(segment))
  );
}

function isSourceFile(fileName) {
  return SOURCE_EXTENSIONS.has(path.extname(fileName));
}

function collectFiles(targetPath, results = []) {
  if (!fs.existsSync(targetPath)) return results;

  const stat = fs.statSync(targetPath);
  if (stat.isFile()) {
    if (isSourceFile(targetPath) && !isExcluded(targetPath)) {
      results.push(targetPath);
    }
    return results;
  }

  for (const entry of fs.readdirSync(targetPath, { withFileTypes: true })) {
    if (["node_modules", ".git", ".next"].includes(entry.name)) continue;

    const absolutePath = path.join(targetPath, entry.name);
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

function scanServerEnvBoundaries() {
  const files = SCAN_ROOTS.flatMap((root) =>
    collectFiles(path.join(ROOT, root)),
  );
  const issues = [];

  for (const file of files) {
    const relPath = toRepoPath(file);
    const content = fs.readFileSync(file, "utf8");
    let match;

    while ((match = DIRECT_SERVER_ENV_PATTERN.exec(content))) {
      const envKey = match[1] || match[2] || "unknown";
      issues.push({
        file: relPath,
        line: getLineNumber(content, match.index),
        detail: `Server secret/config \`${envKey}\` should read through '@/lib/env' runtime helpers instead of direct process.env access.`,
      });
    }
  }

  return issues;
}

function main() {
  const issues = scanServerEnvBoundaries();

  if (issues.length === 0) {
    console.log("review:server-env-boundaries passed");
    return;
  }

  console.error("review:server-env-boundaries failed");
  for (const issue of issues) {
    console.error(`- ${issue.file}:${issue.line} ${issue.detail}`);
  }
  process.exit(1);
}

main();
