#!/usr/bin/env node

const { execSync } = require("child_process");
const {
  STRUCTURAL_CLUSTERS: CLUSTERS,
  getMatchingStructuralClusters,
  getStagedFiles,
} = require("./structural-cluster-registry");

function main() {
  const args = process.argv.slice(2);
  const stagedOnly = args.includes("--staged");
  const runAll = args.includes("--run");
  const explicitArgs = args.filter((arg) => !arg.startsWith("--"));
  const clusterName = explicitArgs[0];
  const clusterMap = Object.fromEntries(
    CLUSTERS.map((cluster) => [cluster.key, cluster]),
  );
  const hasKnownCluster = clusterName && clusterMap[clusterName];

  if (hasKnownCluster) {
    const cluster = clusterMap[clusterName];
    if (stagedOnly) {
      const files = getStagedFiles();
      const matched = files.filter((file) => cluster.pattern.test(file));
      if (matched.length === 0) {
        console.log(
          `Skipping ${cluster.label} review (no matching staged changes)`,
        );
        process.exit(0);
      }
    }

    console.log(`Running ${cluster.label} review...`);
    execSync(cluster.command, { stdio: "inherit" });
    return;
  }

  if (explicitArgs.length > 0 || stagedOnly || runAll) {
    const files =
      explicitArgs.length > 0
        ? explicitArgs.map((arg) => arg.trim()).filter(Boolean)
        : getStagedFiles();
    const matches = getMatchingStructuralClusters(files);
    if (matches.length === 0) {
      console.log("No matching structural clusters found.");
      process.exit(0);
    }

    for (const cluster of matches) {
      console.log(`Running ${cluster.label} review...`);
      execSync(cluster.command, { stdio: "inherit" });
    }
    return;
  }

  console.error(
    `Unknown cluster. Expected one of: ${CLUSTERS.map((cluster) => cluster.key).join(", ")}`,
  );
  process.exit(1);
}

main();
