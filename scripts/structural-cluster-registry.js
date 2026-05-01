const STRUCTURAL_CLUSTERS = [
  {
    key: "translation-quartet",
    name: "Translation critical quartet",
    label: "translation quartet",
    recommendedReview: "Inspect all four translation runtime bundles together",
    command: "pnpm review:translation-quartet",
    files: [
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
    pattern:
      /^(messages\/en\.json|messages\/zh\.json|messages\/en\/critical\.json|messages\/zh\/critical\.json|scripts\/translation-flat-utils\.js|scripts\/regenerate-flat-translations\.js|scripts\/translation-sync\.js|scripts\/validate-translations\.js|scripts\/i18n-shape-check\.js)$/,
  },
  {
    key: "lead-family",
    name: "Lead submission surfaces",
    label: "lead submission surfaces",
    recommendedReview:
      "Inspect contact action plus sibling write routes for contract/validation/rate-limit drift",
    command: "pnpm review:lead-family",
    files: [
      "src/lib/actions/contact.ts",
      "src/app/api/inquiry/route.ts",
      "src/app/api/subscribe/route.ts",
      "src/lib/api/lead-route-response.ts",
    ],
    pattern:
      /^(src\/lib\/actions\/contact\.ts|src\/app\/api\/(inquiry|subscribe)\/.+|src\/lib\/api\/lead-route-response\.ts)$/,
  },
  {
    key: "homepage-sections",
    name: "Homepage section cluster",
    label: "homepage sections cluster",
    recommendedReview:
      "Inspect adjacent homepage sections for rhythm/proof/CTA drift",
    command: "pnpm review:homepage-sections",
    files: [
      "src/components/sections/hero-section.tsx",
      "src/components/sections/products-section.tsx",
      "src/components/sections/final-cta.tsx",
      "src/components/sections/sample-cta.tsx",
      "src/components/sections/resources-section.tsx",
      "src/components/sections/scenarios-section.tsx",
      "src/components/sections/quality-section.tsx",
      "src/components/sections/chain-section.tsx",
      "src/components/sections/homepage-section-links.ts",
      "src/components/sections/homepage-section-shell.tsx",
      "src/components/sections/homepage-trust-strip.tsx",
    ],
    pattern:
      /^src\/components\/sections\/(hero-section|products-section|final-cta|sample-cta|resources-section|scenarios-section|quality-section|chain-section|homepage-section-links|homepage-section-shell|homepage-trust-strip)\.(tsx|ts)$/,
  },
  {
    key: "locale-runtime",
    name: "Locale runtime surface",
    label: "locale runtime surface",
    recommendedReview:
      "Inspect locale routing/runtime semantics, fallback behavior, and server-side locale presentation together",
    command: "pnpm review:locale-runtime",
    files: [
      "src/middleware.ts",
      "src/i18n/request.ts",
      "src/i18n/locale-utils.ts",
      "src/i18n/locale-presentation.ts",
      "src/lib/load-messages.ts",
      "src/app/[locale]/layout.tsx",
      "src/app/[locale]/head.tsx",
      "src/app/global-error.tsx",
      "src/lib/seo-metadata.ts",
      "src/lib/content-utils.ts",
    ],
    pattern:
      /^(src\/middleware\.ts|src\/i18n\/.+|src\/lib\/load-messages\.ts|src\/app\/\[locale\]\/layout\.tsx|src\/app\/\[locale\]\/head\.tsx|src\/app\/global-error\.tsx|src\/lib\/seo-metadata\.ts|src\/lib\/content-utils\.ts)$/,
  },
  {
    key: "cache-health",
    name: "Health signals + cache tag utilities",
    label: "health signals + cache tag utilities",
    recommendedReview:
      "Inspect health response semantics and shared cache tag utilities together",
    command: "pnpm review:health",
    files: [
      "src/app/api/health/route.ts",
      "src/lib/api/cache-health-response.ts",
      "src/lib/cache/index.ts",
      "src/lib/cache/cache-tags.ts",
      "tests/integration/api/health.test.ts",
    ],
    pattern:
      /^(src\/lib\/cache\/.+|src\/app\/api\/health\/route\.ts|src\/lib\/api\/cache-health-response\.ts|tests\/integration\/api\/health\.test\.ts)$/,
  },
];

function normalize(file) {
  return file.trim().replace(/^\.\//, "");
}

function getStagedFiles() {
  const { execSync } = require("child_process");
  return execSync("git diff --cached --name-only --diff-filter=ACMRD", {
    encoding: "utf8",
  })
    .split("\n")
    .map(normalize)
    .filter(Boolean);
}

function getMatchingStructuralClusters(files) {
  const targets = files.map(normalize);
  return STRUCTURAL_CLUSTERS.filter((cluster) =>
    targets.some((file) => cluster.pattern.test(file)),
  );
}

function getStructuralClusterByKey(key) {
  return STRUCTURAL_CLUSTERS.find((cluster) => cluster.key === key) ?? null;
}

function getStructuralReviewCommandForFiles(files) {
  const matches = getMatchingStructuralClusters(files);
  return matches.length === 1 ? matches[0].command : null;
}

module.exports = {
  STRUCTURAL_CLUSTERS,
  getMatchingStructuralClusters,
  getStructuralClusterByKey,
  getStructuralReviewCommandForFiles,
  getStagedFiles,
};
