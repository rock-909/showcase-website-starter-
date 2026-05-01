"use strict";

const fs = require("fs");
const path = require("path");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getGuardrailReportDir() {
  return path.join(process.cwd(), "reports", "guardrails");
}

function writeGuardrailSummary(baseName, payload) {
  const reportDir = getGuardrailReportDir();
  ensureDir(reportDir);

  const timestamp = Date.now();
  const stampedPath = path.join(reportDir, `${baseName}-${timestamp}.json`);
  const latestPath = path.join(reportDir, `latest-${baseName}.json`);
  const content = `${JSON.stringify(payload, null, 2)}\n`;

  fs.writeFileSync(stampedPath, content, "utf8");
  fs.writeFileSync(latestPath, content, "utf8");

  return {
    latestPath,
    stampedPath,
  };
}

function getStatusEmoji(status) {
  if (status === "passed") return "✅";
  if (status === "failed") return "❌";
  return "⚪";
}

function formatDuration(ms) {
  if (typeof ms !== "number" || Number.isNaN(ms)) {
    return "unknown";
  }

  if (ms < 1000) {
    return `${ms}ms`;
  }

  return `${(ms / 1000).toFixed(2)}s`;
}

function renderGuardrailSummaryMarkdown(title, payload) {
  const lines = [
    `## ${title}`,
    "",
    `- Overall status: ${getStatusEmoji(payload.status)} ${payload.status}`,
    `- Generated at: ${payload.createdAt}`,
    "",
    "| Scope | Status | Exit Code | Duration |",
    "| --- | --- | --- | --- |",
  ];

  for (const result of payload.results ?? []) {
    lines.push(
      `| ${result.label ?? result.name ?? "unknown"} | ${getStatusEmoji(result.status)} ${result.status ?? "unknown"} | ${result.exitCode ?? "-"} | ${formatDuration(result.durationMs)} |`,
    );
  }

  lines.push("");

  return `${lines.join("\n")}\n`;
}

module.exports = {
  formatDuration,
  renderGuardrailSummaryMarkdown,
  writeGuardrailSummary,
};
