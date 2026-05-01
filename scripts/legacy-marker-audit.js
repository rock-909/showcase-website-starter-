#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = process.cwd();
const REPORT_DIR = path.join(ROOT, "reports", "architecture");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function runLegacySearch(command, args) {
  return spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
  });
}

function main() {
  ensureDir(REPORT_DIR);
  const pattern =
    "@deprecated|Currently used by|legacy helper|legacy server-side|legacy/test-side|//.*legacy|/\\*.*legacy|\\*.*legacy";
  let run = runLegacySearch("rg", [
    "-n",
    pattern,
    "src",
    "--glob",
    "!**/__tests__/**",
  ]);

  if (run.status !== 0 && run.status !== 1) {
    run = runLegacySearch("grep", [
      "-RInE",
      pattern,
      "src",
      "--exclude-dir=__tests__",
    ]);
  }

  // status 0 = matches found, 1 = no matches, anything else = real error
  if (run.status !== 0 && run.status !== 1) {
    throw new Error(run.stderr || "legacy marker audit failed (rg error)");
  }
  const output = run.stdout;

  const findings = output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const report = {
    generatedAt: new Date().toISOString(),
    findingCount: findings.length,
    findings,
  };

  const ts = Date.now();
  const jsonPath = path.join(REPORT_DIR, `legacy-marker-audit-${ts}.json`);
  const mdPath = path.join(REPORT_DIR, `legacy-marker-audit-${ts}.md`);
  const latestJson = path.join(REPORT_DIR, "legacy-marker-audit-latest.json");
  const latestMd = path.join(REPORT_DIR, "legacy-marker-audit-latest.md");

  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(
    mdPath,
    `# Legacy Marker Audit\n\n- Generated at: ${report.generatedAt}\n- Findings: ${report.findingCount}\n\n${findings.length > 0 ? findings.map((f) => `- ${f}`).join("\n") : "- none"}\n`,
  );
  fs.copyFileSync(jsonPath, latestJson);
  fs.copyFileSync(mdPath, latestMd);

  console.log(`Legacy marker report written: ${path.relative(ROOT, jsonPath)}`);
  console.log(`Findings: ${report.findingCount}`);
}

main();
