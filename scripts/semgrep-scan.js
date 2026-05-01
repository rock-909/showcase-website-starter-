#!/usr/bin/env node

/**
 * Semgrep 扫描（与 CI 行为对齐）
 *
 * - ERROR: 阻断（exit code = 1），输出 JSON
 * - WARNING: 仅记录（不阻断），输出 JSON
 *
 * 输出：
 * - reports/semgrep-error-<timestamp>.json + reports/semgrep-error-latest.json
 * - reports/semgrep-warning-<timestamp>.json + reports/semgrep-warning-latest.json
 */

const fs = require("fs");
const path = require("path");
const { ensureSemgrep, run } = require("./semgrep-common");

function safeParseJsonFile(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeLatestCopy(srcPath, latestPath) {
  try {
    fs.copyFileSync(srcPath, latestPath);
  } catch {
    // best-effort
  }
}

function countFindings(reportJson) {
  const results = Array.isArray(reportJson?.results) ? reportJson.results : [];
  return results.length;
}

function scan({ semgrepPath, severity, outputPath }) {
  const args = [
    "scan",
    "--config",
    "semgrep.yml",
    "--severity",
    severity,
    "--json",
    "--output",
    outputPath,
    "src/",
  ];

  // 注意：这里不使用 --error，由我们自己根据结果决定退出码（便于统一解析）
  return run(semgrepPath, args);
}

function main() {
  const reportDir = path.join(process.cwd(), "reports");
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });

  const semgrepPath = ensureSemgrep();
  const ts = Date.now();

  const errorReportPath = path.join(reportDir, `semgrep-error-${ts}.json`);
  const warningReportPath = path.join(reportDir, `semgrep-warning-${ts}.json`);

  const errorRun = scan({
    semgrepPath,
    severity: "ERROR",
    outputPath: errorReportPath,
  });
  const errorJson = safeParseJsonFile(errorReportPath);
  const errorCount = countFindings(errorJson);
  writeLatestCopy(
    errorReportPath,
    path.join(reportDir, "semgrep-error-latest.json"),
  );

  const warningRun = scan({
    semgrepPath,
    severity: "WARNING",
    outputPath: warningReportPath,
  });
  const warningJson = safeParseJsonFile(warningReportPath);
  const warningCount = countFindings(warningJson);
  writeLatestCopy(
    warningReportPath,
    path.join(reportDir, "semgrep-warning-latest.json"),
  );

  console.log(
    `Semgrep ERROR findings: ${errorCount} (${path.relative(process.cwd(), errorReportPath)})`,
  );
  if ((errorRun.error || errorRun.status !== 0) && errorCount === 0) {
    console.log(
      `Semgrep ERROR scan failed (exit=${String(errorRun.status)}): ${String(
        errorRun.error?.message ||
          (errorRun.stderr || errorRun.stdout || "").trim(),
      ).slice(0, 300)}`,
    );
  }

  console.log(
    `Semgrep WARNING findings: ${warningCount} (${path.relative(process.cwd(), warningReportPath)})`,
  );
  if ((warningRun.error || warningRun.status !== 0) && warningCount === 0) {
    console.log(
      `Semgrep WARNING scan failed (ignored; scan may be incomplete): ${String(
        warningRun.error?.message ||
          (warningRun.stderr || warningRun.stdout || "").trim(),
      ).slice(0, 300)}`,
    );
  }

  // 阻断策略：ERROR 级 findings > 0
  if (errorCount > 0) process.exit(1);

  // 如果 semgrep 执行失败且没有任何可解析结果，也按失败退出
  if ((errorRun.error || errorRun.status !== 0) && errorCount === 0)
    process.exit(2);

  process.exit(0);
}

try {
  main();
} catch (error) {
  console.error(`Semgrep scan failed: ${error.message}`);
  process.exit(2);
}
