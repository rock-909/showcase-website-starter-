#!/usr/bin/env node

const { execSync } = require("child_process");

const AREAS = [
  {
    name: "Runtime entry + locale routing",
    minimumProof: "local-full / release-proof when runtime semantics change",
    primaryOwnerRole: "Runtime / i18n maintainer",
    backupOwnerRole: "Platform maintainer",
    crossReview: "Security review when headers/nonce/cookies change",
    reviewCommand: "pnpm review:locale-runtime",
    patterns: [
      "src/middleware.ts",
      "src/i18n/",
      "src/lib/seo-metadata.ts",
      "src/lib/content-utils.ts",
      "src/app/[locale]/layout.tsx",
      "src/app/[locale]/head.tsx",
    ],
  },
  {
    name: "Contact + inquiry + subscribe pipeline",
    minimumProof: "local-full minimum; ci-proof before release branch merge",
    primaryOwnerRole: "Lead pipeline maintainer",
    backupOwnerRole: "Runtime maintainer",
    crossReview: "Security review when validation/rate-limit/abuse changes",
    reviewCommand: "pnpm review:lead-family",
    patterns: [
      "src/lib/actions/contact.ts",
      "src/app/api/inquiry/",
      "src/app/api/subscribe/",
      "src/lib/contact-form-processing.ts",
      "src/lib/api/lead-route-response.ts",
      "src/lib/lead-pipeline/",
      "src/components/forms/",
    ],
  },
  {
    name: "Abuse protection + request security",
    minimumProof:
      "ci-proof minimum; release-proof for policy/header/nonce changes",
    primaryOwnerRole: "Security maintainer",
    backupOwnerRole: "Runtime maintainer",
    crossReview: "Platform review when Cloudflare/Vercel behavior may differ",
    patterns: [
      "src/config/security.ts",
      "src/lib/security/",
      "src/app/api/verify-turnstile/",
      "src/app/api/csp-report/",
    ],
  },
  {
    name: "Platform build + deployment chain",
    minimumProof: "release-proof",
    primaryOwnerRole: "Platform maintainer",
    backupOwnerRole: "Runtime maintainer",
    crossReview: "Runtime review when request path behavior is affected",
    patterns: [
      "open-next.config.ts",
      "next.config.ts",
      ".github/workflows/",
      "scripts/cloudflare/",
      "wrangler.jsonc",
      "vercel.json",
    ],
  },
  {
    name: "Translation critical path",
    minimumProof:
      "local-full minimum; ci-proof for user-facing entry-path impact",
    primaryOwnerRole: "i18n maintainer",
    backupOwnerRole: "Runtime maintainer",
    crossReview: "Runtime review when SSR/critical-path keys change",
    reviewCommand: "pnpm review:translation-quartet",
    patterns: [
      "messages/en.json",
      "messages/zh.json",
      "messages/en/critical.json",
      "messages/zh/critical.json",
      "scripts/translation-flat-utils.js",
      "scripts/regenerate-flat-translations.js",
      "scripts/translation-sync.js",
      "scripts/validate-translations.js",
      "scripts/i18n-shape-check.js",
    ],
  },
  {
    name: "Health signals + cache tag utilities",
    minimumProof: "ci-proof minimum",
    primaryOwnerRole: "Platform maintainer",
    backupOwnerRole: "Runtime maintainer",
    crossReview: "Security review for public health or cache policy changes",
    reviewCommand: "pnpm review:health",
    patterns: [
      "src/lib/cache/",
      "src/app/api/health/",
      "src/lib/api/cache-health-response.ts",
      "tests/integration/api/health.test.ts",
    ],
  },
];

function normalize(file) {
  return file.trim().replace(/^\.\//, "");
}

function matchesPattern(file, pattern) {
  return file === pattern || file.startsWith(pattern);
}

function collectChangedFiles(mode) {
  if (mode === "staged") {
    return execSync("git diff --cached --name-only --diff-filter=ACM", {
      encoding: "utf8",
    })
      .split("\n")
      .map(normalize)
      .filter(Boolean);
  }

  return execSync("git diff --name-only HEAD", {
    encoding: "utf8",
  })
    .split("\n")
    .map(normalize)
    .filter(Boolean);
}

function parseInputFiles() {
  const args = process.argv.slice(2);
  const staged = args.includes("--staged");
  const files = args.filter((arg) => !arg.startsWith("--")).map(normalize);
  return {
    staged,
    files,
  };
}

function main() {
  const { staged, files } = parseInputFiles();
  const targets =
    files.length > 0 ? files : collectChangedFiles(staged ? "staged" : "head");

  if (targets.length === 0) {
    console.log("No changed files detected.");
    process.exit(0);
  }

  const matches = AREAS.map((area) => {
    const matchedFiles = targets.filter((file) =>
      area.patterns.some((pattern) => matchesPattern(file, pattern)),
    );
    return matchedFiles.length > 0 ? { ...area, matchedFiles } : null;
  }).filter(Boolean);

  console.log("Tier A impact scan");
  console.log("==================");
  console.log(`Files analyzed: ${targets.length}`);

  if (matches.length === 0) {
    console.log("No Tier A paths matched.");
    process.exit(0);
  }

  console.log(`Tier A areas impacted: ${matches.length}`);
  console.log("");

  for (const match of matches) {
    console.log(`Area: ${match.name}`);
    console.log(`Primary owner role: ${match.primaryOwnerRole}`);
    console.log(`Backup owner role: ${match.backupOwnerRole}`);
    console.log(`Cross-review: ${match.crossReview}`);
    console.log(`Minimum proof: ${match.minimumProof}`);
    if (match.reviewCommand) {
      console.log(`Suggested review: ${match.reviewCommand}`);
    }
    console.log("Matched files:");
    for (const file of match.matchedFiles) {
      console.log(`- ${file}`);
    }
    console.log("");
  }

  console.log(
    "Reference docs: docs/guides/TIER-A-OWNER-MAP.md and docs/guides/QUALITY-PROOF-LEVELS.md",
  );
}

main();
