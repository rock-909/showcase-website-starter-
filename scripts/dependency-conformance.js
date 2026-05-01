#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = process.cwd();
const REPORT_DIR = path.join(ROOT, "reports", "architecture");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function runDepCruise() {
  return spawnSync(
    "pnpm",
    [
      "exec",
      "dependency-cruiser",
      "src",
      "--config",
      ".dependency-cruiser.js",
      "--output-type",
      "json",
    ],
    {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
    },
  );
}

function parseJsonOutput(run) {
  const raw = `${run.stdout || ""}${run.stderr || ""}`.trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Unable to parse dependency-cruiser JSON output");
  }
  return JSON.parse(raw.slice(start, end + 1));
}

function buildSummary(report) {
  const violations = Array.isArray(report?.summary?.violations)
    ? report.summary.violations
    : [];
  const errorViolations = violations.filter((v) => v.severity === "error");
  const warnViolations = violations.filter((v) => v.severity === "warn");
  return {
    generatedAt: new Date().toISOString(),
    totalViolations: violations.length,
    errorViolations: errorViolations.length,
    warnViolations: warnViolations.length,
    rulesHit: [
      ...new Set(violations.map((v) => v.name).filter(Boolean)),
    ].sort(),
  };
}

function toMarkdown(summary) {
  return `# Dependency Conformance Report

- Generated at: ${summary.generatedAt}
- Total violations: ${summary.totalViolations}
- Error violations: ${summary.errorViolations}
- Warning violations: ${summary.warnViolations}

## Rules Hit

${summary.rulesHit.length > 0 ? summary.rulesHit.map((rule) => `- ${rule}`).join("\n") : "- none"}
`;
}

function main() {
  ensureDir(REPORT_DIR);
  const run = runDepCruise();
  const report = parseJsonOutput(run);
  const summary = buildSummary(report);
  const ts = Date.now();

  const rawJsonPath = path.join(
    REPORT_DIR,
    `dependency-conformance-${ts}.json`,
  );
  const summaryMdPath = path.join(
    REPORT_DIR,
    `dependency-conformance-${ts}.md`,
  );
  const latestJson = path.join(
    REPORT_DIR,
    "dependency-conformance-latest.json",
  );
  const latestMd = path.join(REPORT_DIR, "dependency-conformance-latest.md");

  fs.writeFileSync(rawJsonPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(summaryMdPath, `${toMarkdown(summary)}\n`);
  fs.copyFileSync(rawJsonPath, latestJson);
  fs.copyFileSync(summaryMdPath, latestMd);

  console.log(
    `Dependency conformance report written: ${path.relative(ROOT, rawJsonPath)}`,
  );
  console.log(
    `Dependency conformance summary: ${path.relative(ROOT, summaryMdPath)}`,
  );
  console.log(`Total violations: ${summary.totalViolations}`);

  if ((run.status ?? 0) !== 0 && summary.errorViolations > 0) {
    process.exit(1);
  }
}

main();
