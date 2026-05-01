#!/usr/bin/env node

const { execSync } = require("child_process");
const {
  STRUCTURAL_CLUSTERS: CLUSTERS,
} = require("./structural-cluster-registry");

function normalize(file) {
  return file.trim().replace(/^\.\//, "");
}

function parseInputFiles() {
  const args = process.argv.slice(2);
  const staged = args.includes("--staged");
  const run = args.includes("--run");
  const files = args.filter((arg) => !arg.startsWith("--")).map(normalize);
  return { staged, run, files };
}

function collectChangedFiles(mode) {
  const command =
    mode === "staged"
      ? "git diff --cached --name-only --diff-filter=ACMRD"
      : "git diff --name-only HEAD";
  const files = execSync(command, { encoding: "utf8" })
    .split("\n")
    .map(normalize)
    .filter(Boolean);
  // In clean CI checkouts git diff HEAD returns nothing;
  // fall back to comparing against the merge-base with main.
  if (files.length === 0 && mode !== "staged") {
    try {
      const base = execSync("git merge-base HEAD origin/main", {
        encoding: "utf8",
      }).trim();
      return execSync(`git diff --name-only ${base}`, { encoding: "utf8" })
        .split("\n")
        .map(normalize)
        .filter(Boolean);
    } catch {
      return files;
    }
  }
  return files;
}

function main() {
  const { staged, run, files } = parseInputFiles();
  const targets =
    files.length > 0 ? files : collectChangedFiles(staged ? "staged" : "head");

  if (targets.length === 0) {
    console.log("No changed files detected.");
    process.exit(0);
  }

  console.log("Structural change cluster scan");
  console.log("=============================");

  let hitCount = 0;
  for (const cluster of CLUSTERS) {
    const matched = cluster.files.filter((file) => targets.includes(file));
    if (matched.length === 0) continue;
    hitCount += 1;
    console.log(`Cluster: ${cluster.name}`);
    console.log(`Recommended review: ${cluster.recommendedReview}`);
    console.log("Matched files:");
    for (const file of matched) {
      console.log(`- ${file}`);
    }
    console.log("Related cluster files:");
    for (const file of cluster.files) {
      if (!matched.includes(file)) console.log(`- ${file}`);
    }
    console.log("");
  }

  if (hitCount === 0) {
    console.log("No known structural clusters matched.");
    return;
  }

  if (!run) {
    console.log("");
    console.log(
      "Add --run to execute the matching cluster reviews automatically.",
    );
    console.log("Example: pnpm review:clusters:staged");
    return;
  }

  console.log("");
  for (const cluster of CLUSTERS) {
    const matched = cluster.files.filter((file) => targets.includes(file));
    if (matched.length === 0) continue;
    console.log(`Running ${cluster.name} review...`);
    execSync(cluster.command, { stdio: "inherit" });
  }

  console.log("Reference doc: docs/guides/STRUCTURAL-CHANGE-CLUSTERS.md");
}

main();
