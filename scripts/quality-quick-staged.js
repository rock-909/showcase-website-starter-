#!/usr/bin/env node
/*
 * 快速质量检查（仅针对暂存文件）
 * - 读取 Git 暂存区的文件列表
 * - 过滤出 .js/.jsx/.ts/.tsx 文件
 * - 仅对这些文件运行 ESLint（使用当前项目的 eslint.config.mjs）
 */

const { execSync, spawnSync } = require("child_process");

function getStagedFiles() {
  try {
    const output = execSync(
      "git diff --name-only --cached --diff-filter=ACMR",
      { stdio: ["ignore", "pipe", "ignore"] },
    )
      .toString()
      .trim();
    if (!output) return [];
    return output.split("\n").filter((f) => /\.(js|jsx|ts|tsx)$/i.test(f));
  } catch {
    return [];
  }
}

function runESLint(files) {
  if (files.length === 0) {
    console.log("[quality:quick:staged] 无需检查：没有暂存的 JS/TS 文件");
    return 0;
  }

  // 使用pnpm exec调用ESLint，避免路径解析问题
  const args = [
    "exec",
    "eslint",
    ...files,
    "--config",
    "eslint.config.mjs",
    "--no-warn-ignored",
    "--max-warnings",
    "0",
  ];

  const res = spawnSync("pnpm", args, { stdio: "inherit" });
  return res.status ?? 1;
}

const files = getStagedFiles();
const code = runESLint(files);
process.exit(code);
