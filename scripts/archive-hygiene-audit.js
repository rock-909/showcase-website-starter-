#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const REPORT_DIR = path.join(ROOT, "reports", "architecture");

const CHECKS = [
  {
    file: "docs/README.md",
    pattern: "旧执行计划都优先移入 Trash 或改看 git 历史",
    label: "docs overview reflects retired plan layer",
  },
  {
    file: "docs/guides/POLICY-SOURCE-OF-TRUTH.md",
    pattern: "已移走、只保留在 git 历史或 Trash 的旧计划、旧审计包、旧治理记录",
    label: "policy index treats retired plan layer as supplemental only",
  },
  {
    file: "docs/guides/POLICY-SOURCE-OF-TRUTH.md",
    pattern: "Canonical Current Sources",
    label: "policy source-of-truth index exists",
  },
];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function main() {
  ensureDir(REPORT_DIR);

  const findings = [];

  for (const check of CHECKS) {
    const fullPath = path.join(ROOT, check.file);
    if (!fs.existsSync(fullPath)) {
      findings.push({ ...check, status: "missing" });
      continue;
    }
    const content = fs.readFileSync(fullPath, "utf8");
    findings.push({
      ...check,
      status: content.includes(check.pattern) ? "ok" : "missing_marker",
    });
  }

  const failed = findings.filter((item) => item.status !== "ok");
  const report = {
    generatedAt: new Date().toISOString(),
    failedCount: failed.length,
    findings,
  };

  const ts = Date.now();
  const jsonPath = path.join(REPORT_DIR, `archive-hygiene-audit-${ts}.json`);
  const mdPath = path.join(REPORT_DIR, `archive-hygiene-audit-${ts}.md`);
  const latestJson = path.join(REPORT_DIR, "archive-hygiene-audit-latest.json");
  const latestMd = path.join(REPORT_DIR, "archive-hygiene-audit-latest.md");

  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(
    mdPath,
    `# Archive Hygiene Audit\n\n- Generated at: ${report.generatedAt}\n- Failed checks: ${report.failedCount}\n\n${findings
      .map((item) => `- [${item.status}] ${item.label} (${item.file})`)
      .join("\n")}\n`,
  );
  fs.copyFileSync(jsonPath, latestJson);
  fs.copyFileSync(mdPath, latestMd);

  console.log(
    `Archive hygiene audit written: ${path.relative(ROOT, jsonPath)}`,
  );
  console.log(`Failed checks: ${report.failedCount}`);

  if (failed.length > 0) process.exit(1);
}

main();
