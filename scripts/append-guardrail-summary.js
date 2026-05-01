#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");
const { renderGuardrailSummaryMarkdown } = require("./lib/guardrail-report");

function usage() {
  console.error(
    "Usage: node scripts/append-guardrail-summary.js <summary-json> [<summary-json> ...]",
  );
}

function resolveReportPath(filePath) {
  return path.isAbsolute(filePath)
    ? filePath
    : path.join(process.cwd(), filePath);
}

function deriveTitle(filePath, payload) {
  if (filePath.includes("all-guardrails-summary")) {
    return "Guardrails Overview";
  }

  if (filePath.includes("scripts-env-summary")) {
    return "Scripts Env Guardrails";
  }

  return payload.title ?? path.basename(filePath, ".json");
}

function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    usage();
    process.exit(1);
  }

  const outputPath = process.env.GITHUB_STEP_SUMMARY;
  let markdown = "# Guardrails Summary\n\n";

  for (const file of files) {
    const reportPath = resolveReportPath(file);
    if (!fs.existsSync(reportPath)) {
      throw new Error(`[guardrails-summary] Report not found: ${reportPath}`);
    }

    const payload = JSON.parse(fs.readFileSync(reportPath, "utf8"));
    markdown += renderGuardrailSummaryMarkdown(
      deriveTitle(file, payload),
      payload,
    );
  }

  if (outputPath) {
    fs.appendFileSync(outputPath, markdown, "utf8");
    console.log(`[guardrails-summary] Appended summary to ${outputPath}`);
    return;
  }

  process.stdout.write(markdown);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
