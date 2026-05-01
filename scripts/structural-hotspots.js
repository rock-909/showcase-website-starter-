#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { readEnvNumber, readEnvString } = require("./lib/runtime-env");

const ROOT = process.cwd();
const REPORT_DIR = path.join(ROOT, "reports", "architecture");
const DAYS = readEnvNumber("STRUCTURAL_HOTSPOT_DAYS") || 180;
const MAX_HOTSPOTS = readEnvNumber("STRUCTURAL_HOTSPOT_TOP") || 25;
const MAX_COUPLINGS = readEnvNumber("STRUCTURAL_COUPLING_TOP") || 25;

const INCLUDED_PREFIXES = [
  "src/",
  "messages/",
  "scripts/",
  ".github/workflows/",
  "package.json",
  "next.config.ts",
  "open-next.config.ts",
  "wrangler.jsonc",
  "vercel.json",
  "lefthook.yml",
];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function normalizeFile(file) {
  return file.split(path.sep).join("/");
}

function isIncluded(file) {
  return INCLUDED_PREFIXES.some(
    (prefix) => file === prefix || file.startsWith(prefix),
  );
}

function safePercent(num) {
  return Number.isFinite(num) ? Number(num.toFixed(3)) : 0;
}

function gitLogOutput() {
  return execSync(
    `git log --since="${DAYS} days ago" --name-only --pretty=format:__COMMIT__:%H`,
    { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
}

function parseCommits(raw) {
  const commits = [];
  let current = null;

  for (const line of raw.split("\n")) {
    if (line.startsWith("__COMMIT__:")) {
      if (current) commits.push(current);
      current = { sha: line.slice("__COMMIT__:".length), files: [] };
      continue;
    }

    if (!current) continue;
    const trimmed = line.trim();
    if (!trimmed) continue;
    const file = normalizeFile(trimmed);
    if (!isIncluded(file)) continue;
    current.files.push(file);
  }

  if (current) commits.push(current);

  return commits
    .map((commit) => ({
      ...commit,
      files: [...new Set(commit.files)],
    }))
    .filter((commit) => commit.files.length > 0);
}

function computeStats(commits) {
  const fileCounts = new Map();
  const dirCounts = new Map();
  const pairCounts = new Map();

  for (const commit of commits) {
    for (const file of commit.files) {
      fileCounts.set(file, (fileCounts.get(file) || 0) + 1);

      const segments = file.split("/");
      const topDir =
        segments.length > 1 ? `${segments[0]}/${segments[1]}` : file;
      dirCounts.set(topDir, (dirCounts.get(topDir) || 0) + 1);
    }

    const files = [...commit.files].sort();
    for (let i = 0; i < files.length; i += 1) {
      for (let j = i + 1; j < files.length; j += 1) {
        const key = `${files[i]}|||${files[j]}`;
        pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
      }
    }
  }

  const hotspots = [...fileCounts.entries()]
    .map(([file, count]) => ({ file, commits: count }))
    .sort((a, b) => b.commits - a.commits || a.file.localeCompare(b.file))
    .slice(0, MAX_HOTSPOTS);

  const directories = [...dirCounts.entries()]
    .map(([directory, count]) => ({ directory, touches: count }))
    .sort(
      (a, b) => b.touches - a.touches || a.directory.localeCompare(b.directory),
    )
    .slice(0, 15);

  const couplings = [...pairCounts.entries()]
    .map(([key, count]) => {
      const [left, right] = key.split("|||");
      const leftCount = fileCounts.get(left) || 0;
      const rightCount = fileCounts.get(right) || 0;
      return {
        left,
        right,
        coChanges: count,
        leftTouches: leftCount,
        rightTouches: rightCount,
        support: safePercent(count / Math.min(leftCount, rightCount || 1)),
        jaccard: safePercent(count / (leftCount + rightCount - count || 1)),
      };
    })
    .filter((pair) => pair.coChanges >= 2)
    .sort((a, b) => {
      if (b.coChanges !== a.coChanges) return b.coChanges - a.coChanges;
      if (b.support !== a.support) return b.support - a.support;
      return a.left.localeCompare(b.left) || a.right.localeCompare(b.right);
    })
    .slice(0, MAX_COUPLINGS);

  return {
    commitsAnalyzed: commits.length,
    uniqueFilesTouched: fileCounts.size,
    hotspots,
    directories,
    couplings,
  };
}

function buildMarkdown(report) {
  const lines = [];
  lines.push("# Structural Hotspots Report");
  lines.push("");
  lines.push(`- Window: last ${report.windowDays} days`);
  lines.push(`- Commits analyzed: ${report.summary.commitsAnalyzed}`);
  lines.push(`- Unique files touched: ${report.summary.uniqueFilesTouched}`);
  lines.push("");
  lines.push("## Top File Hotspots");
  lines.push("");
  lines.push("| Rank | File | Commit Touches |");
  lines.push("|---|---|---:|");
  report.summary.hotspots.forEach((item, index) => {
    lines.push(`| ${index + 1} | \`${item.file}\` | ${item.commits} |`);
  });
  lines.push("");
  lines.push("## Top Directory Hotspots");
  lines.push("");
  lines.push("| Rank | Directory | Touches |");
  lines.push("|---|---|---:|");
  report.summary.directories.forEach((item, index) => {
    lines.push(`| ${index + 1} | \`${item.directory}\` | ${item.touches} |`);
  });
  lines.push("");
  lines.push("## Logical Coupling Pairs");
  lines.push("");
  lines.push("| Rank | File A | File B | Co-Changes | Support | Jaccard |");
  lines.push("|---|---|---|---:|---:|---:|");
  report.summary.couplings.forEach((item, index) => {
    lines.push(
      `| ${index + 1} | \`${item.left}\` | \`${item.right}\` | ${item.coChanges} | ${item.support} | ${item.jaccard} |`,
    );
  });
  lines.push("");
  lines.push("## Interpretation Notes");
  lines.push("");
  lines.push(
    "- High file-touch count suggests frequent change, not necessarily poor quality by itself.",
  );
  lines.push(
    "- Coupling pairs indicate files that often move together in the same commit history window.",
  );
  lines.push(
    "- Use this artifact together with architecture rules and runtime critical-path analysis.",
  );
  return `${lines.join("\n")}\n`;
}

function main() {
  ensureDir(REPORT_DIR);
  const raw = gitLogOutput();
  const commits = parseCommits(raw);
  const summary = computeStats(commits);
  const timestamp = Date.now();

  const report = {
    metadata: {
      generatedAt: new Date().toISOString(),
      version: "1.0.0",
      windowDays: DAYS,
      includedPrefixes: INCLUDED_PREFIXES,
    },
    windowDays: DAYS,
    summary,
  };

  const jsonName = `structural-hotspots-${timestamp}.json`;
  const mdName = `structural-hotspots-${timestamp}.md`;
  const jsonPath = path.join(REPORT_DIR, jsonName);
  const mdPath = path.join(REPORT_DIR, mdName);
  const latestJson = path.join(REPORT_DIR, "structural-hotspots-latest.json");
  const latestMd = path.join(REPORT_DIR, "structural-hotspots-latest.md");

  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(mdPath, buildMarkdown(report));
  fs.copyFileSync(jsonPath, latestJson);
  fs.copyFileSync(mdPath, latestMd);

  console.log(
    `Structural hotspot report written: ${path.relative(ROOT, jsonPath)}`,
  );
  console.log(`Structural hotspot markdown: ${path.relative(ROOT, mdPath)}`);
  console.log(`Commits analyzed: ${summary.commitsAnalyzed}`);
  console.log(`Unique files touched: ${summary.uniqueFilesTouched}`);
}

main();
