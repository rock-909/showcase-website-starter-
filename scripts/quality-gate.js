#!/usr/bin/env node

/**
 * 质量门禁系统
 *
 * 在CI/CD流程中执行质量检查，确保代码质量标准
 *
 * 运行模式：
 * - 完整模式 (默认): node scripts/quality-gate.js
 *   执行所有检查：代码质量、覆盖率、性能、安全
 *
 * - 快速模式: node scripts/quality-gate.js --mode=fast
 *   仅执行快速检查：代码质量、安全（跳过覆盖率和性能测试）
 *   适用于本地 pre-push hook，保持 <2 分钟的快速反馈
 *
 * - CI 模式: node scripts/quality-gate.js --mode=ci
 *   仅执行 CI 所需的阻断检查：代码质量、覆盖率（跳过性能计时）
 *   用于在 CI 中消费 tests job 产出的覆盖率报告，避免重复 build/test
 *
 * 覆盖率检查行为：
 * - CI 环境（CI=true）或 --skip-test-run 参数：
 *   仅读取已有覆盖率报告（reports/coverage/coverage-summary.json）
 *   确保 CI 中 pnpm test:coverage 只执行一次
 *
 * - 本地环境（无参数）：
 *   执行 pnpm test:coverage 生成覆盖率报告
 */

const fs = require("fs");
const path = require("path");
const glob = require("glob");
const { execSync, spawnSync } = require("child_process");
const {
  isNodeEnv,
  readEnvBoolean,
  readEnvNumber,
  readEnvString,
} = require("./lib/runtime-env");

// 解析命令行参数
const args = process.argv.slice(2);
const isFastMode = args.includes("--mode=fast");
const isCiMode = args.includes("--mode=ci");
const isFullMode = args.includes("--mode=full") || (!isFastMode && !isCiMode);
const isJsonOutput = args.includes("--output=json") || args.includes("--json");
const isSilent = args.includes("--silent");

const ESLINT_PACKAGE_PATH = require.resolve("eslint/package.json");
const ESLINT_CLI_PATH = path.join(
  path.dirname(ESLINT_PACKAGE_PATH),
  "bin",
  "eslint.js",
);
const ESLINT_BASE_ARGS = [
  ".",
  "--ext",
  ".js,.jsx,.ts,.tsx",
  "--config",
  "eslint.config.mjs",
  "--cache",
  "--cache-location",
  ".eslintcache",
];

function parseEslintJsonOutput(rawOutput) {
  if (typeof rawOutput !== "string") {
    throw new Error("ESLint output is not a string");
  }

  const trimmed = rawOutput.trim();
  const start = trimmed.indexOf("[");
  const end = trimmed.lastIndexOf("]");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Unable to locate ESLint JSON payload in output");
  }

  const jsonText = trimmed.slice(start, end + 1);
  return JSON.parse(jsonText);
}

function parseEslintDisableUsageIssueCount(rawOutput) {
  const violationSummary = rawOutput.match(
    /\[eslint-disable-check\]\s+Violations:\s+(\d+)/,
  );
  if (violationSummary) {
    return Number.parseInt(violationSummary[1], 10);
  }

  const issueLineCount = rawOutput
    .split("\n")
    .filter((line) => line.trim().startsWith("- ")).length;

  return issueLineCount > 0 ? issueLineCount : 1;
}

function runEslintWithJson() {
  const result = spawnSync(
    process.execPath,
    [ESLINT_CLI_PATH, ...ESLINT_BASE_ARGS, "--format", "json"],
    {
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024, // 10MB
    },
  );

  if (result.error) {
    throw result.error;
  }

  const rawOutput = (result.stdout || result.stderr || "").toString();
  const lintResults = parseEslintJsonOutput(rawOutput);

  return {
    lintResults,
    exitCode: result.status ?? 0,
    rawOutput,
  };
}

// 日志输出函数 - 支持静默模式
function log(...args) {
  if (!isSilent && !isJsonOutput) {
    console.log(...args);
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchesGlob(pattern, value) {
  // Minimal glob matcher for repo-local paths.
  // Supports: **, *, and literal path separators (/).
  const normalizedPattern = pattern.split(path.sep).join("/");
  const normalizedValue = value.split(path.sep).join("/");

  const regexText = `^${normalizedPattern
    .split("/")
    .map((part, index, parts) => {
      if (part === "**") {
        const isLast = index === parts.length - 1;
        return isLast ? "(?:.+/)?[^/]*" : "(?:.+/)?";
      }
      const segment = escapeRegExp(part).replace(/\\\*/g, "[^/]*");
      return `${segment}/`;
    })
    .join("")
    .replace(/\/$/, "")}$`;

  try {
    return new RegExp(regexText).test(normalizedValue);
  } catch {
    return false;
  }
}

class QualityGate {
  constructor() {
    const coverageEnabledByMode =
      isFullMode ||
      isCiMode ||
      readEnvBoolean("QUALITY_ENABLE_COVERAGE") === true;
    const coverageDisabledByEnv =
      readEnvBoolean("QUALITY_DISABLE_COVERAGE") === true;
    const performanceEnabledByMode =
      (isFullMode || readEnvBoolean("QUALITY_ENABLE_PERFORMANCE") === true) &&
      !isCiMode;
    const performanceDisabledByEnv =
      readEnvBoolean("QUALITY_DISABLE_PERFORMANCE") === true;

    const diffCoverageThreshold = readEnvNumber(
      "QUALITY_DIFF_COVERAGE_THRESHOLD",
    );
    const diffWarningThreshold = readEnvNumber(
      "QUALITY_DIFF_COVERAGE_DROP_WARNING_THRESHOLD",
    );

    this.config = {
      // 运行模式
      fastMode: isFastMode,
      ciGateMode: isCiMode,
      fullMode: isFullMode,
      jsonOutput: isJsonOutput,
      silent: isSilent,
      // 质量门禁标准
      gates: {
        coverage: {
          enabled: coverageEnabledByMode && !coverageDisabledByEnv,
          // Phase 1 渐进式覆盖率目标（≥65%），与 .augment/rules 规范对齐
          // 当前实际覆盖率 ~72%，目标路线：Phase 2 (75%) → Phase 3 (80%)
          thresholds: {
            lines: 65,
            functions: 65,
            branches: 65,
            statements: 65,
          },
          blocking: true, // 启用阻断模式：覆盖率不达标时阻塞构建
          // 增量覆盖率分层阻断策略：
          // - diffBlockingThreshold (70%): 低于此值阻断构建（硬门禁，确保新代码优于存量 65%）
          // - diffCoverageThreshold (90%): 低于此值警告但不阻断（软门禁，鼓励高标准）
          // 根据：大型重构/安全 PR 常碰到已有低覆盖率文件导致连锁惩罚，
          // 硬阻断 90% 对此类 PR 不公平。行业惯例（Google/Codecov）均以高阈值作警告而非阻断。
          diffBlockingThreshold: 70,
          diffCoverageThreshold:
            Number.isFinite(diffCoverageThreshold) && diffCoverageThreshold > 0
              ? diffCoverageThreshold
              : 90, // 增量覆盖率警告阈值：低于此值 warning
          // 最小可执行语句数：低于此值的增量变更跳过阈值检查（样本量不足，百分比无统计意义）
          diffMinStatements: 10,
          diffWarningThreshold:
            Number.isFinite(diffWarningThreshold) && diffWarningThreshold >= 0
              ? diffWarningThreshold
              : 1.5, // 变更覆盖率较全量下降超过该阈值触发 warning（目标 1-2% 区间）
          // 增量覆盖率排除列表：仅限纯类型/纯配置/无运行时逻辑的文件
          // 安全/业务逻辑文件禁止加入此列表
          diffCoverageExclude: [
            "src/middleware.ts",
            "src/components/forms/use-rate-limit.ts",
            "src/components/ui/badge.tsx",
            "src/components/ui/button.tsx",
            "src/components/ui/card.tsx",
            "src/components/ui/container.tsx",
            "src/components/ui/input.tsx",
            "src/components/ui/label.tsx",
            "src/components/ui/section-head.tsx",
            "src/components/ui/section.tsx",
            "src/components/ui/separator.tsx",
            "src/components/ui/textarea.tsx",
            "src/types/react19.ts",
            "src/types/i18n.ts",
            // error.tsx 已被 diffCoverageExcludeGlobs 中 src/app/**/error.tsx 覆盖
          ],
          // 增量覆盖率排除（glob）：生成文件/声明文件/无逻辑代码默认不纳入 diff-line coverage
          diffCoverageExcludeGlobs: [
            "**/*.generated.*",
            "**/*.d.ts",
            "**/*-types.ts", // 纯类型定义文件（如 theme-transition-types.ts）
            "**/*.types.ts", // 另一种类型文件命名约定
            "**/*.test.*",
            "**/*.spec.*",
            "**/*.stories.ts",
            "**/*.stories.tsx",
            "**/*.stories.js",
            "**/*.stories.jsx",
            "**/__tests__/**",
            "src/test/**",
            "src/testing/**",
            // 无逻辑代码：JSX 模板和数据声明被 Istanbul 计为可执行语句，
            // 但不含分支逻辑，测试价值极低
            // 注意：禁止再按整个目录豁免 src/components/ui/**。
            // 有行为/状态的 UI 组件必须继续接受 diff coverage 检查。
            "src/components/blocks/_templates/**", // 开发模板（无运行时逻辑）
            "src/components/dev-tools/**", // 开发态调试组件，不进入生产主路径
            "src/app/**/dev-tools/**", // App Router 下的开发态调试入口
            "src/templates/**", // React 19 / DX 模板文件（不参与生产运行时）
            "src/constants/**", // 纯数据声明（as const 对象）
            "src/config/**", // 静态配置对象（零条件分支）
            // App Router 固定模板文件（error boundary / loading skeleton）
            "src/app/**/error.tsx",
            "src/app/**/loading.tsx",
          ],
        },
        codeQuality: {
          enabled: true, // 始终启用代码质量检查
          thresholds: {
            eslintErrors: 0,
            eslintWarnings: 10,
            eslintDisableUsageErrors: 0,
            typeErrors: 0,
            reviewHygieneErrors: 0,
          },
          blocking: true, // 代码质量问题阻塞部署
        },
        performance: {
          enabled: performanceEnabledByMode && !performanceDisabledByEnv,
          thresholds: {
            buildTime: 120000, // 2分钟
            testTime: 180000, // 3分钟
          },
          blocking: false, // 性能问题不阻塞，但会警告
        },
        security: {
          enabled: true, // 始终启用安全检查（速度快）
          thresholds: {
            vulnerabilities: 0,
            highSeverity: 0,
            semgrepErrors: 0,
          },
          blocking: true,
        },
      },
      // 环境配置
      environment: readEnvString("NODE_ENV") || "development",
      ciMode: readEnvBoolean("CI") === true,
      branch: readEnvString("GITHUB_REF_NAME") || "unknown",
      pilotDomain: {
        prefix: "src/lib/web-vitals/",
        testGlobs: [
          "**/*.test.{ts,tsx}",
          "**/*.spec.{ts,tsx}",
          "**/__tests__/**/*.{ts,tsx}",
        ],
      },
      diffBaseRef: readEnvString("QUALITY_DIFF_BASE") || "origin/main",
    };

    this.results = {
      gates: {},
      summary: {
        passed: 0,
        failed: 0,
        warnings: 0,
        blocked: false,
      },
    };
  }

  getMergeBase() {
    const candidates = [this.config.diffBaseRef, "origin/main", "main"];
    for (const ref of candidates) {
      if (!ref) continue;
      try {
        const base = execSync(`git merge-base HEAD ${ref}`, {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        })
          .toString()
          .trim();
        if (base) return base;
      } catch {
        // ignore
      }
    }
    try {
      return execSync("git rev-parse HEAD~1", {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      })
        .toString()
        .trim();
    } catch {
      return "";
    }
  }

  getChangedFiles(filter = "ACM") {
    const base = this.getMergeBase();
    const range = base ? `${base}...HEAD` : "";
    const cmd = base
      ? `git diff --name-only --diff-filter=${filter} ${range}`
      : `git diff --name-only --diff-filter=${filter}`;
    try {
      const output = execSync(cmd, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      })
        .toString()
        .trim();
      if (!output) return [];
      return output.split("\n");
    } catch {
      return [];
    }
  }

  findCoverageSummaryPath() {
    const candidates = [
      path.join(process.cwd(), "reports", "coverage", "coverage-summary.json"),
      path.join(process.cwd(), "coverage", "coverage-summary.json"),
    ];
    return candidates.find((p) => fs.existsSync(p));
  }

  findCoverageDetailsPath() {
    const candidates = [
      path.join(process.cwd(), "reports", "coverage", "coverage-final.json"),
      path.join(process.cwd(), "reports", "coverage", "coverage.json"),
      path.join(process.cwd(), "coverage", "coverage-final.json"),
      path.join(process.cwd(), "coverage", "coverage.json"),
    ];
    return candidates.find((p) => fs.existsSync(p));
  }

  normalizeCoverageEntries(coverageData) {
    const entries = new Map();
    Object.keys(coverageData || {})
      .filter((key) => key !== "total")
      .forEach((key) => {
        const rel = path.relative(process.cwd(), key);
        entries.set(rel, coverageData[key]);
        entries.set(key, coverageData[key]);
      });
    return entries;
  }

  normalizeIstanbulCoverageEntries(istanbulCoverageMap) {
    const entries = new Map();
    Object.keys(istanbulCoverageMap || {}).forEach((key) => {
      const rel = path.relative(process.cwd(), key);
      entries.set(rel, istanbulCoverageMap[key]);
      entries.set(key, istanbulCoverageMap[key]);
    });
    return entries;
  }

  getLineHitsFromIstanbulEntry(entry) {
    const lineHits = new Map();
    if (!entry || typeof entry !== "object") return lineHits;

    // Istanbul format typically provides a "l" map { [lineNumber]: hits }
    if (entry.l && typeof entry.l === "object") {
      Object.entries(entry.l).forEach(([line, hits]) => {
        const lineNumber = Number(line);
        if (!Number.isFinite(lineNumber)) return;
        const hitCount = Number(hits);
        lineHits.set(lineNumber, Number.isFinite(hitCount) ? hitCount : 0);
      });
      return lineHits;
    }

    // Fallback: approximate line hits from statement map
    if (
      entry.statementMap &&
      entry.s &&
      typeof entry.statementMap === "object" &&
      typeof entry.s === "object"
    ) {
      Object.entries(entry.statementMap).forEach(([id, loc]) => {
        const startLine = loc?.start?.line;
        const hitCount = Number(entry.s[id] ?? 0);
        if (!Number.isFinite(startLine)) return;
        const prev = lineHits.get(startLine) ?? 0;
        lineHits.set(startLine, Math.max(prev, hitCount));
      });
    }

    return lineHits;
  }

  getChangedStatementCoverage(entry, changedLines) {
    const result = { total: 0, covered: 0 };
    if (!entry || typeof entry !== "object") return result;
    if (!entry.statementMap || typeof entry.statementMap !== "object") {
      return result;
    }
    if (!entry.s || typeof entry.s !== "object") return result;

    for (const [id, loc] of Object.entries(entry.statementMap)) {
      const startLine = Number(loc?.start?.line);
      if (!Number.isFinite(startLine)) continue;
      // Fallback: missing end.line treated as single-line statement
      const rawEndLine = Number(loc?.end?.line);
      const endLine = Number.isFinite(rawEndLine) ? rawEndLine : startLine;

      const rangeStart = Math.min(startLine, endLine);
      const rangeEnd = Math.max(startLine, endLine);

      let intersects = false;
      for (const lineNumber of changedLines) {
        if (lineNumber >= rangeStart && lineNumber <= rangeEnd) {
          intersects = true;
          break;
        }
      }
      if (!intersects) continue;

      result.total += 1;
      if (Number(entry.s[id] ?? 0) > 0) {
        result.covered += 1;
      }
    }

    return result;
  }

  getChangedLinesByFile() {
    const base = this.getMergeBase();
    const range = base ? `${base}...HEAD` : "";
    const cmd = base
      ? `git diff --unified=0 --no-color ${range} -- '*.ts' '*.tsx' '*.js' '*.jsx'`
      : `git diff --unified=0 --no-color -- '*.ts' '*.tsx' '*.js' '*.jsx'`;

    const output = execSync(cmd, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 50 * 1024 * 1024,
    })
      .toString()
      .split("\n");

    const changedLinesByFile = new Map();
    let currentFile = "";
    let newLineNumber = 0;
    let inHunk = false;

    for (const rawLine of output) {
      const line = rawLine || "";

      if (line.startsWith("diff --git ")) {
        inHunk = false;
        newLineNumber = 0;
        currentFile = "";
        const match = line.match(/^diff --git a\/(.+?) b\/(.+?)$/);
        if (match && match[2] && match[2] !== "/dev/null") {
          const nextFile = match[2];
          // Diff-line coverage only applies to production sources covered by Vitest.
          if (!nextFile.startsWith("src/")) {
            continue;
          }
          if (this.shouldExcludeFromDiffCoverage(nextFile)) {
            continue;
          }
          currentFile = nextFile;
          if (!changedLinesByFile.has(currentFile)) {
            changedLinesByFile.set(currentFile, new Set());
          }
        }
        continue;
      }

      if (!currentFile) continue;

      // Detect deleted files: +++ /dev/null means file was removed
      if (line === "+++ /dev/null") {
        // Remove from map since deleted files should not be in diff coverage
        changedLinesByFile.delete(currentFile);
        currentFile = "";
        continue;
      }

      if (line.startsWith("@@")) {
        const match = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
        if (!match) {
          inHunk = false;
          continue;
        }
        inHunk = true;
        newLineNumber = Number(match[1] || 0);
        continue;
      }

      if (!inHunk) continue;

      if (line.startsWith("+++") || line.startsWith("---")) {
        continue;
      }

      if (line.startsWith("+")) {
        const set = changedLinesByFile.get(currentFile);
        if (set && Number.isFinite(newLineNumber) && newLineNumber > 0) {
          set.add(newLineNumber);
        }
        newLineNumber += 1;
        continue;
      }

      if (line.startsWith("-")) {
        // deletion: does not advance new line counter
        continue;
      }

      // context line (rare with --unified=0 but possible)
      newLineNumber += 1;
    }

    // Remove files with empty changedLines (only deletions, no additions)
    for (const [file, lines] of changedLinesByFile.entries()) {
      if (lines.size === 0) {
        changedLinesByFile.delete(file);
      }
    }

    return changedLinesByFile;
  }

  shouldExcludeFromDiffCoverage(file) {
    const excludeList = this.config.gates.coverage.diffCoverageExclude || [];
    if (excludeList.includes(file)) return true;

    const globPatterns =
      this.config.gates.coverage.diffCoverageExcludeGlobs || [];
    return globPatterns.some((pattern) => matchesGlob(pattern, file));
  }

  calculateDiffCoverage(coverageSummaryData, istanbulCoverageMap) {
    const excludeList = this.config.gates.coverage.diffCoverageExclude || [];

    // Prefer diff-statement coverage when detailed coverage is available.
    if (istanbulCoverageMap && typeof istanbulCoverageMap === "object") {
      const changedLinesByFile = this.getChangedLinesByFile();
      const excludedFiles = [...changedLinesByFile.keys()].filter((file) =>
        this.shouldExcludeFromDiffCoverage(file),
      );
      if (excludedFiles.length > 0) {
        log(`⏭️  增量覆盖率排除文件: ${excludedFiles.join(", ")}`);
      }

      const entries =
        this.normalizeIstanbulCoverageEntries(istanbulCoverageMap);
      const fileMetrics = [];
      let totalCovered = 0;
      let totalStatements = 0;
      let missingCoverageData = false;
      const missingCoverageFiles = [];
      const skippedNonExecutableFiles = [];

      for (const [file, changedLines] of changedLinesByFile.entries()) {
        if (this.shouldExcludeFromDiffCoverage(file)) continue;

        const entry = entries.get(file);

        // Strategy A: Fail explicitly when entry is missing from coverage map
        if (!entry) {
          missingCoverageData = true;
          missingCoverageFiles.push(file);
          fileMetrics.push({
            file,
            covered: 0,
            total: 0,
            pct: 0,
            missingCoverageData: true,
          });
          continue;
        }

        const statementMap = entry.statementMap;
        const hasStatements =
          statementMap &&
          typeof statementMap === "object" &&
          Object.keys(statementMap).length > 0;

        // Skip type-only files (empty statementMap)
        if (!hasStatements) {
          skippedNonExecutableFiles.push(file);
          fileMetrics.push({
            file,
            covered: 0,
            total: 0,
            pct: 100,
            skippedNonExecutable: true,
          });
          continue;
        }

        // Strategy A: If statementMap exists but s (hit counts) is missing/invalid,
        // treat as corrupted coverage data - fail explicitly
        const hasValidHitCounts = entry.s && typeof entry.s === "object";
        if (!hasValidHitCounts) {
          missingCoverageData = true;
          missingCoverageFiles.push(file);
          fileMetrics.push({
            file,
            covered: 0,
            total: 0,
            pct: 0,
            missingCoverageData: true,
          });
          continue;
        }

        const { total: fileTotal, covered: fileCovered } =
          this.getChangedStatementCoverage(entry, changedLines);

        if (fileTotal === 0) {
          fileMetrics.push({
            file,
            covered: 0,
            total: 0,
            pct: 100,
            skippedNonExecutable: true,
          });
          continue;
        }

        const filePct = (fileCovered / fileTotal) * 100;
        fileMetrics.push({
          file,
          covered: fileCovered,
          total: fileTotal,
          pct: filePct,
        });

        totalCovered += fileCovered;
        totalStatements += fileTotal;
      }

      if (skippedNonExecutableFiles.length > 0) {
        log(
          `⏭️  跳过（无可执行语句）: ${skippedNonExecutableFiles.join(", ")}`,
        );
      }

      if (totalStatements === 0 && !missingCoverageData) return null;

      const pct =
        totalStatements > 0 ? (totalCovered / totalStatements) * 100 : 0;
      const overall = coverageSummaryData?.total?.statements?.pct || pct;

      return {
        pct,
        drop: overall - pct,
        fileMetrics,
        totalCovered,
        totalStatements,
        changedFilesCount: [...changedLinesByFile.keys()].filter(
          (file) => !this.shouldExcludeFromDiffCoverage(file),
        ).length,
        metric: "statements",
        unitLabel: "可执行语句",
        missingCoverageData,
        missingCoverageFiles,
      };
    }

    // Fallback: file-level diff coverage based on summary only (legacy behavior).
    const changedFilesWithCode = this.getChangedFiles("ACM").filter((file) =>
      file.match(/\.(js|jsx|ts|tsx)$/),
    );
    const excludedFiles = changedFilesWithCode.filter((file) =>
      this.shouldExcludeFromDiffCoverage(file),
    );
    if (excludedFiles.length > 0) {
      log(`⏭️  增量覆盖率排除文件: ${excludedFiles.join(", ")}`);
    }
    const changedFiles = changedFilesWithCode.filter(
      (file) => !this.shouldExcludeFromDiffCoverage(file),
    );
    if (changedFiles.length === 0) return null;

    const entries = this.normalizeCoverageEntries(coverageSummaryData);
    const fileMetrics = [];
    let totalCovered = 0;
    let totalStatements = 0;

    changedFiles.forEach((file) => {
      const summary = entries.get(file);
      if (summary?.statements?.total) {
        const fileCovered = summary.statements.covered || 0;
        const fileTotal = summary.statements.total || 0;
        const filePct = fileTotal > 0 ? (fileCovered / fileTotal) * 100 : 0;

        fileMetrics.push({
          file,
          covered: fileCovered,
          total: fileTotal,
          pct: filePct,
        });

        totalCovered += fileCovered;
        totalStatements += fileTotal;
      }
    });

    if (totalStatements === 0) return null;

    const pct = (totalCovered / totalStatements) * 100;
    const overall = coverageSummaryData?.total?.statements?.pct || pct;

    return {
      pct,
      drop: overall - pct,
      fileMetrics,
      totalCovered,
      totalStatements,
      changedFilesCount: changedFiles.length,
      metric: "statements",
      unitLabel: "可执行语句",
      missingCoverageData: false,
      missingCoverageFiles: [],
    };
  }

  getAddedPilotDomainFiles() {
    const added = this.getChangedFiles("A");
    const prefix = this.config.pilotDomain.prefix;
    if (!prefix) return [];
    return added.filter(
      (file) =>
        file.startsWith(prefix) && !file.match(/\.(test|spec)\.(ts|tsx)$/),
    );
  }

  hasTestForFile(filePath) {
    const dir = path.dirname(filePath);
    const base = path.basename(filePath, path.extname(filePath));
    const candidates = [
      path.join(dir, `${base}.test.ts`),
      path.join(dir, `${base}.test.tsx`),
      path.join(dir, `${base}.spec.ts`),
      path.join(dir, `${base}.spec.tsx`),
      path.join(dir, "__tests__", `${base}.test.ts`),
      path.join(dir, "__tests__", `${base}.spec.ts`),
      path.join(dir, "__tests__", `${base}.test.tsx`),
      path.join(dir, "__tests__", `${base}.spec.tsx`),
    ];

    if (candidates.some((p) => fs.existsSync(p))) {
      return true;
    }

    const globs = (this.config.pilotDomain.testGlobs || []).map((pattern) =>
      path.join(dir, pattern),
    );
    return globs.some((pattern) => glob.sync(pattern).length > 0);
  }

  /**
   * 执行所有质量门禁检查
   */
  async executeQualityGates() {
    log("🚪 开始执行质量门禁检查...\n");
    log(`🌿 分支: ${this.config.branch}`);
    log(`🏗️  环境: ${this.config.environment}`);
    log(`🤖 CI模式: ${this.config.ciMode ? "是" : "否"}`);
    const modeLabel = this.config.fastMode
      ? "快速 (--mode=fast)"
      : this.config.ciGateMode
        ? "CI (--mode=ci)"
        : "完整";
    log(`⚡ 运行模式: ${modeLabel}`);
    if (this.config.fastMode) {
      log("   跳过: 覆盖率检查、性能测试（将在 CI 中执行）");
    }
    if (this.config.ciGateMode) {
      log("   跳过: 性能计时（建议由 CI performance job 负责）");
    }
    log("");

    // SEO/Config placeholder check (production only)
    if (this.config.environment === "production") {
      this.results.gates.seoConfig = await this.checkSeoConfigPlaceholders();
      this.results.gates.livePlaceholders =
        await this.checkLivePlaceholderArtifacts();
    }

    // 执行各项门禁检查
    if (this.config.gates.codeQuality.enabled) {
      this.results.gates.codeQuality = await this.checkCodeQuality();
    }

    if (this.config.gates.coverage.enabled) {
      this.results.gates.coverage = await this.checkCoverage();
    } else {
      this.results.gates.coverage = {
        name: "Coverage",
        status: "skipped",
        checks: {},
        blocking: false,
        issues: ["覆盖率门禁已禁用（fast 模式或显式禁用）"],
      };
    }

    if (this.config.gates.performance.enabled) {
      this.results.gates.performance = await this.checkPerformance();
    } else {
      this.results.gates.performance = {
        name: "Performance",
        status: "skipped",
        checks: {},
        blocking: false,
        issues: [
          this.config.fastMode
            ? "快速模式下跳过性能计时"
            : this.config.ciGateMode
              ? "CI 模式下跳过性能计时"
              : "性能门禁已禁用",
        ],
      };
    }

    if (this.config.gates.security.enabled) {
      this.results.gates.security = await this.checkSecurity();
    }

    // 汇总结果
    this.summarizeResults();

    // 生成报告
    this.generateGateReport();

    // 返回结果
    return this.results;
  }

  /**
   * 代码质量门禁检查
   */
  async checkCodeQuality() {
    log("🔍 执行代码质量门禁检查...");

    const gate = {
      name: "Code Quality",
      status: "unknown",
      checks: {},
      blocking: this.config.gates.codeQuality.blocking,
      issues: [],
    };

    try {
      // TypeScript 类型检查
      gate.checks.typeCheck = await this.runTypeCheck();

      // ESLint 检查
      gate.checks.eslint = await this.runESLintCheck();

      // ESLint disable exception registry check
      gate.checks.eslintDisableUsage = await this.runEslintDisableUsageCheck();

      // Review hygiene 检查
      gate.checks.reviewHygiene = await this.runReviewHygieneCheck();

      // 汇总代码质量结果
      const hasErrors =
        gate.checks.typeCheck.errors > 0 ||
        gate.checks.eslint.errors >
          this.config.gates.codeQuality.thresholds.eslintErrors ||
        gate.checks.eslintDisableUsage.errors >
          this.config.gates.codeQuality.thresholds.eslintDisableUsageErrors ||
        gate.checks.reviewHygiene.errors >
          this.config.gates.codeQuality.thresholds.reviewHygieneErrors;

      const hasWarnings =
        gate.checks.eslint.warnings >
        this.config.gates.codeQuality.thresholds.eslintWarnings;

      if (hasErrors) {
        gate.status = "failed";
        gate.issues.push("代码质量检查发现错误");
        if (gate.checks.reviewHygiene.errors > 0) {
          gate.issues.push(
            ...gate.checks.reviewHygiene.issues.map(
              (issue) => `review hygiene: ${issue}`,
            ),
          );
        }
        if (gate.checks.eslintDisableUsage.errors > 0) {
          gate.issues.push(
            ...gate.checks.eslintDisableUsage.issues.map(
              (issue) => `eslint disable usage: ${issue}`,
            ),
          );
        }
      } else if (hasWarnings) {
        gate.status = "warning";
        gate.issues.push("代码质量检查发现警告");
      } else {
        gate.status = "passed";
      }
    } catch (error) {
      gate.status = "error";
      gate.issues.push(`代码质量检查失败: ${error.message}`);
    }

    log(`${this.getStatusEmoji(gate.status)} 代码质量门禁: ${gate.status}`);
    return gate;
  }

  /**
   * 覆盖率门禁检查
   *
   * 支持两种模式：
   * - CI 环境（CI=true 或 --skip-test-run）：仅读取已有覆盖率报告
   * - 本地环境：执行测试并生成覆盖率报告
   *
   * 这确保 CI 中覆盖率测试只执行一次（由 tests job 生成），
   * quality-gate 仅负责阈值检查和阻断决策。
   */
  async checkCoverage() {
    log("📊 执行覆盖率门禁检查...");

    const gate = {
      name: "Coverage",
      status: "unknown",
      checks: {},
      blocking: this.config.gates.coverage.blocking,
      issues: [],
    };

    // 检查是否应跳过测试执行（CI 环境或显式参数）
    const skipTestRun = this.config.ciMode || args.includes("--skip-test-run");

    try {
      // 检查是否已有覆盖率报告
      let coverageJsonPath = this.findCoverageSummaryPath();

      if (skipTestRun) {
        // CI 模式：仅读取已有报告
        log("📖 CI 模式：读取已有覆盖率报告...");
        if (!coverageJsonPath) {
          gate.status = "error";
          gate.issues.push(
            "覆盖率报告不存在。请确保在调用 quality:gate 前已执行 pnpm test:coverage",
          );
          log(`${this.getStatusEmoji(gate.status)} 覆盖率门禁: ${gate.status}`);
          return gate;
        }
      } else {
        // 本地模式：运行覆盖率测试
        log("🧪 运行测试以生成覆盖率...");
        const coverageTimeout =
          readEnvNumber("QUALITY_COVERAGE_TIMEOUT_MS") || 480000; // 8min default
        execSync("pnpm test:coverage --run --reporter=json", {
          stdio: "pipe",
          timeout: coverageTimeout,
          maxBuffer: 50 * 1024 * 1024, // 50MB to handle long test output
        });
        // 重新查找报告路径
        coverageJsonPath = this.findCoverageSummaryPath();
      }

      // 读取覆盖率数据

      if (coverageJsonPath && fs.existsSync(coverageJsonPath)) {
        const rawData = fs.readFileSync(coverageJsonPath, "utf8");
        const coverageData = JSON.parse(rawData);
        gate.checks.coverage = coverageData.total;

        // Optional: detailed coverage for diff-line coverage
        let istanbulCoverageMap = null;
        const coverageDetailsPath = this.findCoverageDetailsPath();
        if (coverageDetailsPath && fs.existsSync(coverageDetailsPath)) {
          try {
            const rawDetails = fs.readFileSync(coverageDetailsPath, "utf8");
            istanbulCoverageMap = JSON.parse(rawDetails);
          } catch {
            istanbulCoverageMap = null;
          }
        }

        // 检查覆盖率阈值
        const { thresholds } = this.config.gates.coverage;
        const failedMetrics = [];

        Object.keys(thresholds).forEach((metric) => {
          const current = gate.checks.coverage[metric]?.pct || 0;
          const threshold = thresholds[metric];

          if (current < threshold) {
            failedMetrics.push(`${metric}: ${current}% < ${threshold}%`);
          }
        });

        if (failedMetrics.length > 0) {
          gate.status = gate.blocking ? "failed" : "warning";
          gate.issues.push(`覆盖率不达标: ${failedMetrics.join(", ")}`);
        } else {
          gate.status = "passed";
        }

        // 增量覆盖率检查（diff coverage）
        const diffCoverage = this.calculateDiffCoverage(
          coverageData,
          istanbulCoverageMap,
        );
        if (diffCoverage) {
          const softThreshold =
            this.config.gates.coverage.diffCoverageThreshold;
          const hardThreshold =
            this.config.gates.coverage.diffBlockingThreshold || softThreshold;
          const warningThreshold =
            this.config.gates.coverage.diffWarningThreshold;

          // 检查是否有文件缺少覆盖率数据（Strategy A: 严格失败）
          if (diffCoverage.missingCoverageData) {
            gate.status = gate.blocking ? "failed" : "warning";
            const missingFiles = diffCoverage.missingCoverageFiles || [];
            if (missingFiles.length > 0) {
              gate.issues.push(
                `新增文件未被覆盖率收录: ${missingFiles.join(", ")}`,
              );
              gate.issues.push("  请确保测试已执行并覆盖率配置包含所有源文件");
            }
          }

          // 最小语句守卫：变更语句数低于阈值时跳过百分比检查
          const minStatements =
            this.config.gates.coverage.diffMinStatements || 0;
          if (
            !diffCoverage.missingCoverageData &&
            minStatements > 0 &&
            diffCoverage.totalStatements < minStatements
          ) {
            log(
              `ℹ️  增量覆盖率: ${diffCoverage.totalCovered}/${diffCoverage.totalStatements} 语句（低于最小阈值 ${minStatements}，跳过百分比检查）`,
            );
          }

          // 分层阻断：硬门禁（hardThreshold）阻断构建，软门禁（softThreshold）仅警告
          if (
            !diffCoverage.missingCoverageData &&
            diffCoverage.totalStatements >= minStatements
          ) {
            const unitLabel = diffCoverage.unitLabel || "行";

            if (diffCoverage.pct < hardThreshold) {
              // 低于硬门禁 → 阻断
              const shortfall = hardThreshold - diffCoverage.pct;
              gate.status = gate.blocking ? "failed" : "warning";
              gate.issues.push(
                `增量覆盖率不达标: ${diffCoverage.pct.toFixed(2)}% < ${hardThreshold}%（差距 ${shortfall.toFixed(2)}%，变更 ${diffCoverage.changedFilesCount} 个文件，${diffCoverage.totalCovered}/${diffCoverage.totalStatements} ${unitLabel}覆盖）`,
              );
            } else if (diffCoverage.pct < softThreshold) {
              // 介于硬门禁和软门禁之间 → 警告不阻断
              gate.status = gate.status === "passed" ? "warning" : gate.status;
              gate.issues.push(
                `增量覆盖率低于目标: ${diffCoverage.pct.toFixed(2)}% < ${softThreshold}%（硬门禁 ${hardThreshold}% 已通过，变更 ${diffCoverage.changedFilesCount} 个文件，${diffCoverage.totalCovered}/${diffCoverage.totalStatements} ${unitLabel}覆盖）`,
              );
            }

            // 列出覆盖率低于软阈值的文件（无论阻断还是警告都列出）
            if (diffCoverage.pct < softThreshold) {
              const lowCoverageFiles = diffCoverage.fileMetrics.filter(
                (f) =>
                  f.pct < softThreshold &&
                  !f.skippedNonExecutable &&
                  !f.missingCoverageData,
              );
              if (lowCoverageFiles.length > 0 && lowCoverageFiles.length <= 5) {
                lowCoverageFiles.forEach((f) => {
                  gate.issues.push(
                    `  - ${f.file}: ${f.pct.toFixed(2)}% (${f.covered}/${f.total})`,
                  );
                });
              } else if (lowCoverageFiles.length > 5) {
                gate.issues.push(
                  `  共 ${lowCoverageFiles.length} 个文件覆盖率不达标（仅显示前5个）`,
                );
                lowCoverageFiles.slice(0, 5).forEach((f) => {
                  gate.issues.push(
                    `  - ${f.file}: ${f.pct.toFixed(2)}% (${f.covered}/${f.total})`,
                  );
                });
              }
            }
          }

          // 检查增量覆盖率下降幅度（同样受最小语句守卫约束）
          if (
            !diffCoverage.missingCoverageData &&
            diffCoverage.totalStatements >= minStatements &&
            diffCoverage.drop > warningThreshold
          ) {
            gate.status = gate.status === "passed" ? "warning" : gate.status;
            gate.issues.push(
              `增量覆盖率较全量下降 ${diffCoverage.drop.toFixed(2)}%（增量 ${diffCoverage.pct.toFixed(2)}% vs 全量 ${(coverageData.total?.statements?.pct || 0).toFixed(2)}%）`,
            );
          }
        }
      } else {
        gate.status = "error";
        gate.issues.push("覆盖率报告文件不存在");
      }
    } catch (error) {
      gate.status = gate.blocking ? "error" : "warning";
      gate.issues.push(`覆盖率检查失败: ${error.message}`);
    }

    // 试点域（web-vitals）新增文件需配套测试的提示
    const addedPilotFiles = this.getAddedPilotDomainFiles();
    const missingTests = addedPilotFiles.filter(
      (file) => !this.hasTestForFile(file),
    );
    if (missingTests.length > 0) {
      gate.status = gate.status === "passed" ? "warning" : gate.status;
      gate.issues.push(
        `试点域缺少测试（新增文件未找到配套测试）: ${missingTests.join(", ")}`,
      );
    }

    log(`${this.getStatusEmoji(gate.status)} 覆盖率门禁: ${gate.status}`);
    return gate;
  }

  runBuildCommand() {
    return spawnSync("pnpm", ["build"], {
      encoding: "utf8",
      shell: true,
      maxBuffer: 50 * 1024 * 1024,
    });
  }

  runPerformanceTests(timeoutMs) {
    return execSync("pnpm test --run --reporter=json", {
      stdio: "pipe",
      timeout: timeoutMs,
      maxBuffer: 50 * 1024 * 1024,
    });
  }

  /**
   * 性能门禁检查
   */
  async checkPerformance() {
    log("⚡ 执行性能门禁检查...");

    const gate = {
      name: "Performance",
      status: "unknown",
      checks: {},
      blocking: this.config.gates.performance.blocking,
      issues: [],
    };

    try {
      let hasExecutionFailure = false;
      // 构建性能检查
      const buildStart = Date.now();
      const buildRes = this.runBuildCommand();
      const buildOutput = (buildRes.stdout || "") + (buildRes.stderr || "");
      const buildTime = Date.now() - buildStart;

      gate.checks.buildTime = buildTime;

      // 构建失败时直接阻断并输出节选日志，便于诊断
      if (typeof buildRes.status === "number" && buildRes.status !== 0) {
        gate.issues.push(`构建失败（退出码 ${buildRes.status}）`);
        gate.issues.push("构建输出（节选）：");
        gate.issues.push(buildOutput.slice(0, 2000));
        gate.status = "failed";
        gate.blocking = true;
        hasExecutionFailure = true;
      } else {
        // Zero-tolerance i18n smoke test: fail if next-intl reports missing messages（stdout 或 stderr 均可识别）
        if (/MISSING_MESSAGE/i.test(buildOutput)) {
          gate.issues.push("next-intl MISSING_MESSAGE detected in build logs");
          gate.status = "failed";
          gate.blocking = true; // enforce blocking when i18n is broken
          hasExecutionFailure = true;
        }
      }

      if (!hasExecutionFailure) {
        // 测试性能检查
        const testStart = Date.now();
        const perfTestTimeout =
          readEnvNumber("QUALITY_PERF_TEST_TIMEOUT_MS") || 360000; // 6min default
        this.runPerformanceTests(perfTestTimeout);
        const testTime = Date.now() - testStart;

        gate.checks.testTime = testTime;

        // 检查性能阈值
        const issues = [];
        if (buildTime > this.config.gates.performance.thresholds.buildTime) {
          issues.push(
            `构建时间 ${Math.round(buildTime / 1000)}s 超过阈值 ${Math.round(this.config.gates.performance.thresholds.buildTime / 1000)}s`,
          );
        }

        if (testTime > this.config.gates.performance.thresholds.testTime) {
          issues.push(
            `测试时间 ${Math.round(testTime / 1000)}s 超过阈值 ${Math.round(this.config.gates.performance.thresholds.testTime / 1000)}s`,
          );
        }

        if (issues.length > 0) {
          gate.status = gate.blocking ? "failed" : "warning";
          gate.issues.push(...issues);
        } else {
          gate.status = "passed";
        }
      }
    } catch (error) {
      gate.status = gate.blocking ? "error" : "warning";
      gate.issues.push(`性能检查失败: ${error.message}`);
    }

    log(`${this.getStatusEmoji(gate.status)} 性能门禁: ${gate.status}`);
    return gate;
  }

  /**
   * 安全门禁检查
   */
  async checkSecurity() {
    log("🔒 执行安全门禁检查...");

    const gate = {
      name: "Security",
      status: "unknown",
      checks: {},
      blocking: this.config.gates.security.blocking,
      issues: [],
    };

    try {
      // npm audit 检查
      gate.checks.audit = await this.runSecurityAudit();

      // Semgrep（本地门禁可见；CI 由 .github/workflows/ci.yml 的 security job 执行）
      const shouldRunSemgrep =
        !this.config.ciGateMode ||
        readEnvBoolean("QUALITY_FORCE_SEMGREP") === true;

      if (shouldRunSemgrep) {
        gate.checks.semgrep = await this.runSemgrepScan();
      } else {
        gate.checks.semgrep = {
          status: "skipped",
          reason: "CI pipeline runs Semgrep in a dedicated security job",
          errors: 0,
          warnings: 0,
        };
      }

      // 检查安全阈值
      const vulnerabilities = gate.checks.audit.vulnerabilities || 0;
      const highSeverity = gate.checks.audit.high || 0;
      const semgrepErrors = gate.checks.semgrep?.errors || 0;
      const semgrepStatus = gate.checks.semgrep?.status;

      const issues = [];
      const warningIssues = [];
      if (
        vulnerabilities >
          this.config.gates.security.thresholds.vulnerabilities ||
        highSeverity > this.config.gates.security.thresholds.highSeverity
      ) {
        issues.push(
          `发现 ${vulnerabilities} 个安全漏洞，其中 ${highSeverity} 个高危`,
        );
      }

      if (
        semgrepErrors >
        (this.config.gates.security.thresholds.semgrepErrors ?? 0)
      ) {
        issues.push(`Semgrep ERROR 发现 ${semgrepErrors} 个问题`);
      }

      if (semgrepStatus === "failed") {
        warningIssues.push("Semgrep 扫描执行失败（仅告警，不阻塞）");
      }

      if (issues.length > 0) {
        gate.status = "failed";
        gate.issues.push(...issues, ...warningIssues);
      } else if (warningIssues.length > 0) {
        gate.status = "warning";
        gate.issues.push(...warningIssues);
      } else {
        gate.status = "passed";
      }
    } catch (error) {
      gate.status = "warning"; // 安全检查失败不阻塞，但发出警告
      gate.issues.push(`安全检查失败: ${error.message}`);
    }

    log(`${this.getStatusEmoji(gate.status)} 安全门禁: ${gate.status}`);
    return gate;
  }

  /**
   * SEO/Config placeholder check for production
   * Detects unconfigured [PLACEHOLDER] values in SITE_CONFIG
   */
  async checkSeoConfigPlaceholders() {
    log("🔍 执行 SEO/Config 占位符检查...");

    const gate = {
      name: "SEO Config",
      status: "unknown",
      checks: {},
      blocking: true, // Block production builds with placeholders
      issues: [],
    };

    try {
      const siteConfigPath = path.join(
        process.cwd(),
        "src",
        "config",
        "paths",
        "site-config.ts",
      );

      if (!fs.existsSync(siteConfigPath)) {
        gate.status = "warning";
        gate.issues.push("site-config.ts not found");
        return gate;
      }

      const content = fs.readFileSync(siteConfigPath, "utf8");

      // Check for placeholder patterns [SOMETHING]
      const placeholderPattern = /\[([A-Z_]+)\]/g;
      const matches = [...content.matchAll(placeholderPattern)];
      const uniquePlaceholders = [...new Set(matches.map((m) => m[0]))];

      // Check for example.com in baseUrl
      const hasExampleUrl = content.includes("'https://example.com'");

      gate.checks.placeholders = uniquePlaceholders;
      gate.checks.hasExampleUrl = hasExampleUrl;

      if (uniquePlaceholders.length > 0 || hasExampleUrl) {
        gate.status = "failed";
        if (uniquePlaceholders.length > 0) {
          gate.issues.push(
            `发现未配置的占位符: ${uniquePlaceholders.join(", ")}`,
          );
        }
        if (hasExampleUrl) {
          gate.issues.push(
            "NEXT_PUBLIC_BASE_URL 未配置（使用默认 example.com）",
          );
        }
        gate.issues.push(
          "请在 .env.production 中配置这些值，或更新 src/config/paths/site-config.ts",
        );
      } else {
        gate.status = "passed";
      }
    } catch (error) {
      gate.status = "error";
      gate.issues.push(`SEO/Config 检查失败: ${error.message}`);
    }

    log(`${this.getStatusEmoji(gate.status)} SEO/Config 门禁: ${gate.status}`);
    return gate;
  }

  /**
   * Live placeholder artifact check for production-facing source files.
   * Blocks obvious placeholder assets/copy from shipping in app/components.
   */
  async checkLivePlaceholderArtifacts() {
    log("🔍 执行 live placeholder 产物检查...");

    const gate = {
      name: "Live Placeholders",
      status: "unknown",
      checks: {},
      blocking: true,
      issues: [],
    };

    const targetFiles = [
      ...glob.sync("src/app/**/*.{ts,tsx}"),
      ...glob.sync("src/components/**/*.{ts,tsx}"),
      ...glob.sync("src/constants/**/*.{ts,tsx}"),
    ].filter((filePath) => {
      return ![
        "__tests__",
        ".test.",
        ".spec.",
        "src/components/blocks/_templates/",
      ].some((segment) => filePath.includes(segment));
    });

    const placeholderPatterns = [
      /\/images\/products\/placeholder[-\w]*\.svg/g,
      /\bLogo wall placeholder\b/g,
      /\bImage placeholder\b/g,
      /\bComing Soon\b/g,
      /Customer and partner logo placeholders/g,
      /客户与合作伙伴 Logo 展位/g,
    ];

    const findings = [];

    for (const filePath of targetFiles) {
      const content = fs.readFileSync(filePath, "utf8");
      const matched = placeholderPatterns.flatMap((pattern) =>
        [...content.matchAll(pattern)].map((match) => match[0]),
      );

      if (matched.length > 0) {
        findings.push({
          file: filePath,
          matches: [...new Set(matched)],
        });
      }
    }

    gate.checks.filesScanned = targetFiles.length;
    gate.checks.findings = findings;

    if (findings.length > 0) {
      gate.status = "failed";
      gate.issues.push(
        ...findings.map(
          ({ file, matches }) =>
            `${file}: 发现 live placeholder 信号 (${matches.join(", ")})`,
        ),
      );
    } else {
      gate.status = "passed";
    }

    log(
      `${this.getStatusEmoji(gate.status)} Live placeholder 门禁: ${gate.status}`,
    );
    return gate;
  }

  /**
   * 运行 TypeScript 类型检查
   */
  async runTypeCheck() {
    try {
      execSync("pnpm type-check", {
        stdio: "pipe",
        maxBuffer: 20 * 1024 * 1024, // 20MB for potential many type errors
      });
      return { errors: 0, status: "passed" };
    } catch (error) {
      return { errors: 1, status: "failed", message: error.message };
    }
  }

  /**
   * 运行 ESLint 检查
   */
  async runESLintCheck() {
    try {
      const { lintResults, exitCode } = runEslintWithJson();
      const totals = lintResults.reduce(
        (acc, fileResult) => {
          acc.errors += fileResult.errorCount || 0;
          acc.warnings += fileResult.warningCount || 0;
          return acc;
        },
        { errors: 0, warnings: 0 },
      );

      return {
        ...totals,
        status: exitCode === 0 && totals.errors === 0 ? "passed" : "failed",
      };
    } catch (error) {
      return {
        errors: 0,
        warnings: 0,
        status: "error",
        message: error.message,
      };
    }
  }

  async runEslintDisableUsageCheck() {
    const result = spawnSync(
      process.execPath,
      [path.join(process.cwd(), "scripts", "check-eslint-disable-usage.js")],
      {
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
      },
    );

    if (result.error) {
      return {
        errors: 1,
        status: "error",
        issues: [result.error.message],
      };
    }

    const rawOutput = (result.stdout || result.stderr || "").toString().trim();
    if (result.status === 0) {
      return {
        errors: 0,
        status: "passed",
        issues: [],
      };
    }

    const issueCount = parseEslintDisableUsageIssueCount(rawOutput);

    return {
      errors: issueCount,
      status: "failed",
      issues:
        rawOutput.length > 0
          ? rawOutput.split("\n").filter(Boolean).slice(0, 20)
          : ["ESLint disable usage check failed without output"],
    };
  }

  async runReviewHygieneCheck() {
    const result = spawnSync(
      process.execPath,
      [
        path.join(process.cwd(), "scripts", "check-review-hygiene.js"),
        "--json",
      ],
      {
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
      },
    );

    const rawOutput = (result.stdout || result.stderr || "").toString().trim();

    try {
      if (!rawOutput) {
        return {
          errors: 1,
          status: "error",
          issues: ["Review hygiene check produced empty output"],
        };
      }

      const parsed = JSON.parse(rawOutput);
      const hasValidIssueCount =
        typeof parsed.issueCount === "number" &&
        Number.isInteger(parsed.issueCount) &&
        parsed.issueCount >= 0;
      const hasValidStatus =
        parsed.status === "passed" || parsed.status === "failed";
      const hasValidIssues = Array.isArray(parsed.issues);

      if (!hasValidIssueCount || !hasValidStatus || !hasValidIssues) {
        return {
          errors: 1,
          status: "error",
          issues: [
            "Review hygiene output did not match the expected JSON contract",
          ],
        };
      }

      return {
        errors: parsed.issueCount,
        status: parsed.status,
        issues: parsed.issues.map((issue) =>
          typeof issue === "string"
            ? issue
            : `${issue.file}: ${issue.message}${
                issue.consumers?.length
                  ? ` (${issue.consumers.join(", ")})`
                  : ""
              }`,
        ),
      };
    } catch (error) {
      return {
        errors: 1,
        status: "error",
        issues: [
          rawOutput ||
            `Unable to parse review hygiene output: ${error.message}`,
        ],
      };
    }
  }

  /**
   * 运行安全审计
   */
  async runSecurityAudit() {
    try {
      // Only audit production dependencies - dev dependencies don't affect production
      const output = execSync("pnpm audit --prod --json", {
        encoding: "utf8",
        stdio: "pipe",
        maxBuffer: 10 * 1024 * 1024, // 10MB for audit results
      });
      const auditData = JSON.parse(output);

      return {
        vulnerabilities: auditData.metadata?.vulnerabilities?.total || 0,
        high: auditData.metadata?.vulnerabilities?.high || 0,
        critical: auditData.metadata?.vulnerabilities?.critical || 0,
        status: "completed",
      };
    } catch (error) {
      // npm audit 在发现漏洞时会返回非零退出码
      try {
        const output = error.stdout || "";
        if (output) {
          const auditData = JSON.parse(output);
          return {
            vulnerabilities: auditData.metadata?.vulnerabilities?.total || 0,
            high: auditData.metadata?.vulnerabilities?.high || 0,
            critical: auditData.metadata?.vulnerabilities?.critical || 0,
            status: "completed",
          };
        }
      } catch (parseError) {
        // 解析失败，返回默认值
      }

      return {
        vulnerabilities: 0,
        high: 0,
        critical: 0,
        status: "failed",
        error: error.message,
      };
    }
  }

  /**
   * 运行 Semgrep 扫描（仅统计 ERROR/WARNING 数量）
   *
   * 注意：CI 中 Semgrep 由 .github/workflows/ci.yml 的 security job 负责，
   * quality gate 默认不重复执行（除非 QUALITY_FORCE_SEMGREP=true）。
   */
  async runSemgrepScan() {
    const reportDir = path.join(process.cwd(), "reports");
    const errorLatest = path.join(reportDir, "semgrep-error-latest.json");
    const warningLatest = path.join(reportDir, "semgrep-warning-latest.json");

    let exitCode = 0;
    let status = "completed";
    let output;

    try {
      output = execSync("pnpm security:semgrep", {
        encoding: "utf8",
        stdio: "pipe",
        maxBuffer: 10 * 1024 * 1024,
      });
    } catch (error) {
      exitCode = typeof error.status === "number" ? error.status : 1;
      output = (error.stdout || error.stderr || "").toString();

      // exitCode=1 通常表示存在 ERROR findings（扫描本身成功）
      status = exitCode === 1 ? "completed" : "failed";
    }

    let errors = 0;
    let warnings = 0;

    try {
      if (fs.existsSync(errorLatest)) {
        const json = JSON.parse(fs.readFileSync(errorLatest, "utf8"));
        errors = Array.isArray(json?.results) ? json.results.length : 0;
      }
    } catch {
      // ignore
    }

    try {
      if (fs.existsSync(warningLatest)) {
        const json = JSON.parse(fs.readFileSync(warningLatest, "utf8"));
        warnings = Array.isArray(json?.results) ? json.results.length : 0;
      }
    } catch {
      // ignore
    }

    return {
      errors,
      warnings,
      exitCode,
      status,
      reports: {
        error: fs.existsSync(errorLatest)
          ? path.relative(process.cwd(), errorLatest)
          : null,
        warning: fs.existsSync(warningLatest)
          ? path.relative(process.cwd(), warningLatest)
          : null,
      },
      output: typeof output === "string" ? output.trim() : "",
    };
  }

  /**
   * 汇总结果
   */
  summarizeResults() {
    Object.values(this.results.gates).forEach((gate) => {
      switch (gate.status) {
        case "passed":
          this.results.summary.passed++;
          break;
        case "failed":
          this.results.summary.failed++;
          if (gate.blocking) {
            this.results.summary.blocked = true;
          }
          break;
        case "error":
          this.results.summary.failed++;
          if (gate.blocking) {
            this.results.summary.blocked = true;
          }
          break;
        case "warning":
          this.results.summary.warnings++;
          break;
        case "skipped":
          // skipped 状态不计入通过/失败，仅记录
          if (!this.results.summary.skipped) {
            this.results.summary.skipped = 0;
          }
          this.results.summary.skipped++;
          break;
      }
    });
  }

  /**
   * 生成门禁报告
   */
  generateGateReport() {
    // JSON 输出模式：仅输出 JSON 到 stdout
    if (this.config.jsonOutput) {
      return this.generateJsonReport();
    }

    log("\n🚪 质量门禁检查报告");
    log("=".repeat(50));

    log(`✅ 通过: ${this.results.summary.passed}`);
    log(`❌ 失败: ${this.results.summary.failed}`);
    log(`⚠️  警告: ${this.results.summary.warnings}`);
    if (this.results.summary.skipped) {
      log(`⏭️  跳过: ${this.results.summary.skipped}`);
    }
    log(`🚫 阻塞构建: ${this.results.summary.blocked ? "是" : "否"}`);

    log("\n📋 详细结果:");
    Object.values(this.results.gates).forEach((gate) => {
      log(`${this.getStatusEmoji(gate.status)} ${gate.name}: ${gate.status}`);
      if (gate.issues && gate.issues.length > 0) {
        gate.issues.forEach((issue) => {
          log(`   - ${issue}`);
        });
      }
    });

    // 保存报告
    const reportPath = path.join(
      process.cwd(),
      "reports",
      `quality-gate-${Date.now()}.json`,
    );
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(
      reportPath,
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          config: this.config,
          results: this.results,
        },
        null,
        2,
      ),
    );

    log(`\n💾 报告已保存: ${reportPath}`);

    // CI 环境下的特殊处理
    if (this.config.ciMode) {
      this.handleCIOutput();
    }
  }

  /**
   * 生成 JSON 格式报告（用于 CI 消费）
   */
  generateJsonReport() {
    const report = {
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      mode: this.config.fastMode
        ? "fast"
        : this.config.ciGateMode
          ? "ci"
          : "full",
      branch: this.config.branch,
      environment: this.config.environment,
      ci: this.config.ciMode,
      summary: {
        passed: this.results.summary.passed,
        failed: this.results.summary.failed,
        warnings: this.results.summary.warnings,
        skipped: this.results.summary.skipped || 0,
        blocked: this.results.summary.blocked,
        score: this.calculateQualityScore(),
      },
      thresholds: {
        coverage: this.config.gates.coverage.thresholds,
        codeQuality: this.config.gates.codeQuality.thresholds,
        security: this.config.gates.security.thresholds,
      },
      gates: {},
    };

    // 格式化每个门禁的结果
    Object.entries(this.results.gates).forEach(([key, gate]) => {
      report.gates[key] = {
        name: gate.name,
        status: gate.status,
        blocking: gate.blocking,
        issues: gate.issues || [],
        checks: gate.checks || {},
      };
    });

    // 输出 JSON 到 stdout（便于 CI 捕获）
    console.log(JSON.stringify(report, null, 2));

    // 同时保存到文件
    const reportPath = path.join(
      process.cwd(),
      "reports",
      "quality-gate-latest.json",
    );
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  }

  /**
   * 处理 CI 环境输出
   */
  handleCIOutput() {
    // GitHub Actions 注解
    if (readEnvString("GITHUB_ACTIONS")) {
      Object.values(this.results.gates).forEach((gate) => {
        if (gate.status === "failed" && gate.blocking) {
          console.log(
            `::error::质量门禁失败: ${gate.name} - ${gate.issues.join(", ")}`,
          );
        } else if (gate.status === "warning") {
          console.log(
            `::warning::质量门禁警告: ${gate.name} - ${gate.issues.join(", ")}`,
          );
        }
      });
    }

    // GitHub Actions outputs: use Environment Files (set-output is deprecated)
    const outputPath = readEnvString("GITHUB_OUTPUT");
    if (outputPath) {
      try {
        fs.appendFileSync(
          outputPath,
          `quality-gate-passed=${String(!this.results.summary.blocked)}\n`,
          "utf8",
        );
        fs.appendFileSync(
          outputPath,
          `quality-gate-score=${String(this.calculateQualityScore())}\n`,
          "utf8",
        );
      } catch {
        // Ignore output write failures to avoid blocking the gate itself.
      }
    }
  }

  /**
   * 计算质量评分
   */
  calculateQualityScore() {
    const totalGates = Object.keys(this.results.gates).length;
    if (totalGates === 0) return 0;

    const score = (this.results.summary.passed / totalGates) * 100;
    return Math.round(score);
  }

  getStatusEmoji(status) {
    switch (status) {
      case "passed":
        return "✅";
      case "failed":
        return "❌";
      case "warning":
        return "⚠️";
      case "error":
        return "💥";
      case "skipped":
        return "⏭️";
      default:
        return "❓";
    }
  }
}

// 主执行函数
async function main() {
  const gate = new QualityGate();

  try {
    const results = await gate.executeQualityGates();

    // JSON 输出模式：静默退出（状态已通过 JSON 传递）
    if (isJsonOutput) {
      process.exit(results.summary.blocked ? 1 : 0);
    }

    if (results.summary.blocked) {
      log("\n🚫 质量门禁检查失败，构建被阻塞！");
      process.exit(1);
    } else if (results.summary.failed > 0 || results.summary.warnings > 0) {
      log("\n⚠️  质量门禁检查发现问题，但不阻塞构建");
      log("请及时修复相关问题以提高代码质量");
    } else {
      log("\n🎉 所有质量门禁检查通过！");
    }
  } catch (error) {
    if (isJsonOutput) {
      console.log(
        JSON.stringify(
          {
            timestamp: new Date().toISOString(),
            version: "1.0.0",
            error: true,
            message: error.message,
            summary: {
              blocked: true,
              passed: 0,
              failed: 1,
              warnings: 0,
              skipped: 0,
              score: 0,
            },
            gates: {},
          },
          null,
          2,
        ),
      );
      process.exit(1);
    }
    console.error("❌ 质量门禁检查失败:", error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { QualityGate };
