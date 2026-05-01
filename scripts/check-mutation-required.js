#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const TARGET_DIRECTORIES = [
  "src/lib/lead-pipeline/",
  "src/lib/security/",
  "src/lib/form-schema/",
];
const REPORT_PATH = path.join(
  process.cwd(),
  "reports",
  "mutation",
  "mutation-report.json",
);

function runGit(args) {
  return execFileSync("git", args, {
    cwd: process.cwd(),
    encoding: "utf8",
  }).trim();
}

function getChangedFiles() {
  const output = runGit(["diff", "origin/main...HEAD", "--name-only"]);
  if (!output) return [];

  return output
    .split("\n")
    .map((file) => file.trim())
    .filter(Boolean)
    .filter((file) => !file.includes("/__tests__/"));
}

function getTouchedTargetDirectories(changedFiles) {
  return TARGET_DIRECTORIES.filter((directory) =>
    changedFiles.some((file) => file.startsWith(directory)),
  );
}

function getMergeBaseTimestampMs() {
  const mergeBase = runGit(["merge-base", "HEAD", "origin/main"]);
  const timestamp = runGit(["show", "-s", "--format=%ct", mergeBase]);
  return Number.parseInt(timestamp, 10) * 1000;
}

function getLatestCommittedChangeTimestampMs(filePath) {
  const timestamp = runGit([
    "log",
    "-1",
    "--format=%ct",
    "HEAD",
    "--",
    filePath,
  ]);
  return Number.parseInt(timestamp || "0", 10) * 1000;
}

function loadMutationReport() {
  if (!fs.existsSync(REPORT_PATH)) {
    throw new Error(
      "缺少 reports/mutation/mutation-report.json，请先运行 pnpm test:mutation",
    );
  }

  const raw = fs.readFileSync(REPORT_PATH, "utf8");
  return JSON.parse(raw);
}

function isReportFreshEnough(reportPath, branchStartMs) {
  return fs.statSync(reportPath).mtimeMs >= branchStartMs;
}

function getLatestRelevantChangeTimestampMs(
  changedFiles,
  {
    getLatestCommittedChangeTimestampMsFn = getLatestCommittedChangeTimestampMs,
  } = {},
) {
  const relevantFiles = changedFiles.filter((file) =>
    TARGET_DIRECTORIES.some((directory) => file.startsWith(directory)),
  );

  return relevantFiles.reduce((latestTimestamp, filePath) => {
    return Math.max(
      latestTimestamp,
      getLatestCommittedChangeTimestampMsFn(filePath),
    );
  }, 0);
}

function normalizeMutateScopes(report) {
  const mutate = report?.config?.mutate;
  return Array.isArray(mutate)
    ? mutate.filter((value) => typeof value === "string")
    : [];
}

function isDirectoryCovered(directory, mutateScopes) {
  // Stryker mutate scopes are glob prefixes like "src/lib/security/**/*.ts",
  // so startsWith(directory) is enough to tell whether a scope targets that directory tree.
  return mutateScopes.some((scope) => scope.startsWith(directory));
}

function getSuggestedMutationCommand(touchedDirectories) {
  const touchesLead = touchedDirectories.includes("src/lib/lead-pipeline/");
  const touchesSecurity = touchedDirectories.includes("src/lib/security/");
  const touchesFormSchema = touchedDirectories.includes("src/lib/form-schema/");

  if (touchesFormSchema) {
    return "pnpm test:mutation";
  }

  if (touchesLead && touchesSecurity) {
    return "pnpm test:mutation:lead-security";
  }

  if (touchesSecurity) {
    return "pnpm test:mutation:security";
  }

  if (touchesLead) {
    return "pnpm test:mutation:lead";
  }

  return "pnpm test:mutation";
}

function main({
  getChangedFilesFn = getChangedFiles,
  getTouchedTargetDirectoriesFn = getTouchedTargetDirectories,
  getMergeBaseTimestampMsFn = getMergeBaseTimestampMs,
  getLatestRelevantChangeTimestampMsFn = getLatestRelevantChangeTimestampMs,
  loadMutationReportFn = loadMutationReport,
  isReportFreshEnoughFn = isReportFreshEnough,
  normalizeMutateScopesFn = normalizeMutateScopes,
  isDirectoryCoveredFn = isDirectoryCovered,
} = {}) {
  const changedFiles = getChangedFilesFn();
  const touchedDirectories = getTouchedTargetDirectoriesFn(changedFiles);

  if (touchedDirectories.length === 0) {
    console.log(
      "✅ 未检测到 lead/security/form-schema 变更，跳过变异测试新鲜度检查",
    );
    return;
  }

  const freshnessBaselineMs = Math.max(
    getMergeBaseTimestampMsFn(),
    getLatestRelevantChangeTimestampMsFn(changedFiles),
  );
  const report = loadMutationReportFn();

  if (!isReportFreshEnoughFn(REPORT_PATH, freshnessBaselineMs)) {
    throw new Error(
      "变异测试报告早于本次受保护改动的最新变更，请重新运行对应的局部变异测试命令",
    );
  }

  const mutateScopes = normalizeMutateScopesFn(report);
  const uncoveredDirectories = touchedDirectories.filter(
    (directory) => !isDirectoryCoveredFn(directory, mutateScopes),
  );

  if (uncoveredDirectories.length > 0) {
    const command = getSuggestedMutationCommand(touchedDirectories);
    throw new Error(
      [
        "变异测试报告 scope 不覆盖本次改动。",
        `命中目录: ${touchedDirectories.join(", ")}`,
        `报告 mutate scope: ${mutateScopes.join(", ") || "(empty)"}`,
        `未覆盖目录: ${uncoveredDirectories.join(", ")}`,
        `请运行 ${command} 并更新 reports/mutation/mutation-report.json`,
      ].join("\n"),
    );
  }

  console.log(
    `✅ 变异测试报告有效，覆盖目录: ${touchedDirectories.join(", ")}`,
  );
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ ${message}`);
    process.exit(1);
  }
}

module.exports = {
  TARGET_DIRECTORIES,
  REPORT_PATH,
  getChangedFiles,
  getTouchedTargetDirectories,
  getMergeBaseTimestampMs,
  getLatestCommittedChangeTimestampMs,
  loadMutationReport,
  isReportFreshEnough,
  getLatestRelevantChangeTimestampMs,
  normalizeMutateScopes,
  isDirectoryCovered,
  getSuggestedMutationCommand,
  main,
};
