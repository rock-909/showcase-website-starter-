import fs from "node:fs";
import path from "node:path";

const TEST_FILE_PATTERN =
  /(__tests__|\/test\/|\/testing\/|^tests\/|\.test\.|\.spec\.)/;

const LOW_VALUE_STYLE_RULES = new Set([
  "design-no-bold-heading",
  "design-no-default-tailwind-palette",
  "design-no-redundant-size-axes",
  "design-no-space-on-flex-children",
  "design-no-three-period-ellipsis",
  "no-generic-handler-names",
]);

const NEEDS_PROOF_RULES = new Set([
  "async-await-in-loop",
  "async-parallel",
  "nextjs-no-use-search-params-without-suspense",
  "server-sequential-independent-await",
]);

const PROJECT_EXCEPTIONS = [
  {
    filePath: "src/components/seo/json-ld-script.tsx",
    rule: "no-danger",
    reason: "JSON-LD injection is centralized and escaped by generateJSONLD.",
  },
  {
    filePath: "src/components/layout/logo.tsx",
    rule: "nextjs-no-img-element",
    reason:
      "Local SVG logo intentionally avoids next/image runtime in shared layout.",
  },
  {
    filePath: "src/app/[locale]/layout.tsx",
    rule: "nextjs-no-native-script",
    reason: "Native scripts are development-only helper scripts.",
  },
  {
    filePath: "src/app/[locale]/[...rest]/page.tsx",
    rule: "nextjs-missing-metadata",
    reason: "Catch-all route only calls notFound for localized 404 behavior.",
  },
  {
    filePath: "src/components/monitoring/enterprise-analytics-island.tsx",
    rule: "nextjs-no-use-search-params-without-suspense",
    reason:
      "Enterprise analytics is lazy-rendered under CookieConsentIsland Suspense.",
  },
  {
    filePath: "src/lib/api/safe-parse-json.ts",
    rule: "async-await-in-loop",
    reason: "Request body stream reader must be read sequentially.",
  },
  {
    filePath: "src/components/ui/textarea.tsx",
    rule: "no-react19-deprecated-apis",
    reason:
      "Radix/shadcn compatibility migration is a separate UI primitive wave.",
  },
  {
    filePath: "src/components/ui/separator.tsx",
    rule: "no-react19-deprecated-apis",
    reason:
      "Radix/shadcn compatibility migration is a separate UI primitive wave.",
  },
  {
    filePath: "src/components/ui/badge.tsx",
    rule: "no-react19-deprecated-apis",
    reason:
      "Radix/shadcn compatibility migration is a separate UI primitive wave.",
  },
  {
    filePath: "src/components/security/turnstile.tsx",
    rule: "no-prop-callback-in-effect",
    reason:
      "Turnstile availability callbacks bridge third-party widget state to the parent.",
  },
  {
    filePath: "src/components/security/turnstile.tsx",
    rule: "no-event-handler",
    reason:
      "Turnstile dev bypass and missing-site-key callbacks are external widget adapter events.",
  },
  {
    filePath: "src/components/cookie/lazy-cookie-consent-island.tsx",
    rule: "rerender-state-only-in-handlers",
    reason:
      "Idle-render state is read by an early return and must trigger lazy island mount.",
  },
  {
    filePath: "src/components/ui/lazy-theme-switcher.tsx",
    rule: "rerender-state-only-in-handlers",
    reason:
      "Idle-render and module state are read by lazy import/render gates and must trigger rerenders.",
  },
  {
    filePath: "src/components/layout/header-client.tsx",
    rule: "rerender-state-only-in-handlers",
    reason:
      "Activation state switches fallback header controls to interactive lazy islands.",
  },
  {
    filePath: "src/components/security/turnstile.tsx",
    rule: "rendering-usetransition-loading",
    reason:
      "Turnstile loading state mirrors an external widget lifecycle, not a React transition.",
  },
];

const STATIC_SKELETON_INDEX_KEY_FILES = new Set([
  "src/app/[locale]/about/page.tsx",
  "src/app/[locale]/capabilities/page.tsx",
  "src/app/[locale]/custom-project-support/page.tsx",
  "src/app/[locale]/how-it-works/page.tsx",
  "src/app/[locale]/privacy/page.tsx",
  "src/app/[locale]/terms/page.tsx",
]);

const DECORATIVE_GRID_INDEX_KEY_FILES = new Set([
  "src/components/grid/grid-frame.tsx",
  "src/components/grid/grid-system.tsx",
]);

const PURE_RENDER_HELPER_FILES = new Set([
  "src/app/[locale]/capabilities/page.tsx",
  "src/app/[locale]/contact/page.tsx",
  "src/app/[locale]/how-it-works/page.tsx",
]);

const QUALITY_SCRIPT_RULES = new Set([
  "js-combine-iterations",
  "js-flatmap-filter",
  "js-set-map-lookups",
  "js-tosorted-immutable",
]);

const STARTER_CHECKS_STRING_SCAN_RULES = new Set(["js-set-map-lookups"]);

const STARTER_CHECKS_SEQUENTIAL_PROOF_RULES = new Set([
  "async-await-in-loop",
  "async-parallel",
  "server-sequential-independent-await",
]);

function isTestFile(filePath) {
  return TEST_FILE_PATTERN.test(filePath);
}

function getRuleIdentifier(diagnostic) {
  return diagnostic.plugin
    ? `${diagnostic.plugin}/${diagnostic.rule}`
    : diagnostic.rule;
}

function findProjectException(diagnostic) {
  return PROJECT_EXCEPTIONS.find(
    (exception) =>
      exception.filePath === diagnostic.filePath &&
      exception.rule === diagnostic.rule,
  );
}

function classifyDiagnostic(diagnostic) {
  if (diagnostic.severity === "error") {
    return {
      bucket: "blocking-error",
      reason: "React Doctor error blocks CI.",
    };
  }

  const exception = findProjectException(diagnostic);
  if (exception) {
    return {
      bucket: "project-exception",
      reason: exception.reason,
    };
  }

  if (isTestFile(diagnostic.filePath)) {
    return {
      bucket: "test-fixture-noise",
      reason: "Diagnostic is in test or fixture code.",
    };
  }

  if (
    diagnostic.filePath.startsWith("scripts/") &&
    diagnostic.filePath === "scripts/starter-checks.js" &&
    STARTER_CHECKS_STRING_SCAN_RULES.has(diagnostic.rule)
  ) {
    return {
      bucket: "project-exception",
      reason:
        "starter-checks scans strings and docs; React Doctor reports these string searches as array lookup optimizations.",
    };
  }

  if (
    diagnostic.filePath === "scripts/starter-checks.js" &&
    STARTER_CHECKS_SEQUENTIAL_PROOF_RULES.has(diagnostic.rule)
  ) {
    return {
      bucket: "project-exception",
      reason:
        "Cloudflare smoke and retry probes intentionally preserve request order, retry timing, and readable failure output.",
    };
  }

  if (
    diagnostic.filePath.startsWith("scripts/") &&
    QUALITY_SCRIPT_RULES.has(diagnostic.rule)
  ) {
    return {
      bucket: "needs-manual-proof",
      reason: "Quality scripts need a separate proof lane before performance rewrites.",
    };
  }

  if (
    diagnostic.rule === "no-array-index-as-key" &&
    STATIC_SKELETON_INDEX_KEY_FILES.has(diagnostic.filePath)
  ) {
    return {
      bucket: "low-value-style",
      reason: "Static loading skeleton rows have no business identity or reorder path.",
    };
  }

  if (
    diagnostic.rule === "no-array-index-as-key" &&
    DECORATIVE_GRID_INDEX_KEY_FILES.has(diagnostic.filePath)
  ) {
    return {
      bucket: "low-value-style",
      reason: "Decorative grid crosshairs have no business identity.",
    };
  }

  if (
    diagnostic.rule === "no-render-in-render" &&
    PURE_RENDER_HELPER_FILES.has(diagnostic.filePath)
  ) {
    return {
      bucket: "low-value-style",
      reason: "Pure content render helper extraction is structural cleanup, not a proven behavior risk.",
    };
  }

  if (LOW_VALUE_STYLE_RULES.has(diagnostic.rule)) {
    return {
      bucket: "low-value-style",
      reason: "Style cleanup or low-risk readability suggestion.",
    };
  }

  if (NEEDS_PROOF_RULES.has(diagnostic.rule)) {
    return {
      bucket: "needs-manual-proof",
      reason: "Rule needs runtime, ordering, or framework proof before repair.",
    };
  }

  return {
    bucket: "confirmed-real",
    reason: "Production warning without a documented exception.",
  };
}

function getDisposition(bucket) {
  switch (bucket) {
    case "blocking-error":
    case "confirmed-real":
      return {
        disposition: "fix",
        owner: "engineering",
        unresolved: true,
      };
    case "delete-after-proof":
      return {
        disposition: "delete-after-proof",
        owner: "engineering",
        unresolved: false,
      };
    case "project-exception":
      return {
        disposition: "exempt-after-proof",
        owner: "quality-governance",
        unresolved: false,
      };
    case "test-fixture-noise":
      return {
        disposition: "exempt-after-proof",
        owner: "test-governance",
        unresolved: false,
      };
    case "needs-manual-proof":
      return {
        disposition: "temporarily-retain",
        owner: "proof-lane",
        unresolved: false,
      };
    case "low-value-style":
      return {
        disposition: "temporarily-retain",
        owner: "quality-governance",
        unresolved: false,
      };
    default:
      return {
        disposition: "fix",
        owner: "engineering",
        unresolved: true,
      };
  }
}

export function classifyDiagnostics(diagnostics) {
  const classifiedDiagnostics = diagnostics.map((diagnostic) => {
    const classification = classifyDiagnostic(diagnostic);
    const disposition = getDisposition(classification.bucket);
    return {
      ...diagnostic,
      bucket: classification.bucket,
      bucketReason: classification.reason,
      ...disposition,
    };
  });

  const byBucket = {};
  const byDisposition = {};
  const byOwner = {};
  const byRule = {};
  const byScope = {};

  for (const diagnostic of classifiedDiagnostics) {
    byBucket[diagnostic.bucket] = (byBucket[diagnostic.bucket] ?? 0) + 1;
    byDisposition[diagnostic.disposition] =
      (byDisposition[diagnostic.disposition] ?? 0) + 1;
    byOwner[diagnostic.owner] = (byOwner[diagnostic.owner] ?? 0) + 1;
    byRule[diagnostic.rule] = (byRule[diagnostic.rule] ?? 0) + 1;
    const scope = isTestFile(diagnostic.filePath)
      ? "tests"
      : diagnostic.filePath.startsWith("scripts/")
        ? "scripts"
        : "production";
    byScope[scope] = (byScope[scope] ?? 0) + 1;
  }

  return {
    summary: {
      total: classifiedDiagnostics.length,
      errors: classifiedDiagnostics.filter(
        (diagnostic) => diagnostic.severity === "error",
      ).length,
      warnings: classifiedDiagnostics.filter(
        (diagnostic) => diagnostic.severity === "warning",
      ).length,
      unresolved: classifiedDiagnostics.filter(
        (diagnostic) => diagnostic.unresolved,
      ).length,
    },
    byBucket,
    byDisposition,
    byOwner,
    byRule,
    byScope,
    diagnostics: classifiedDiagnostics,
  };
}

export function assertGovernance(result) {
  const missingGovernanceFields = result.diagnostics.filter(
    (diagnostic) =>
      !diagnostic.disposition ||
      !diagnostic.owner ||
      !diagnostic.bucketReason,
  );

  if (missingGovernanceFields.length > 0) {
    const preview = missingGovernanceFields
      .slice(0, 10)
      .map(
        (diagnostic) =>
          `- ${diagnostic.filePath}:${diagnostic.line} ${diagnostic.rule}`,
      )
      .join("\n");

    throw new Error(
      [
        `React Doctor governance has ${missingGovernanceFields.length} diagnostics without disposition, owner, or reason.`,
        "Every diagnostic must have an explicit governance outcome before merge.",
        preview,
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  if (result.summary.unresolved === 0) {
    return;
  }

  const unresolvedDiagnostics = result.diagnostics.filter(
    (diagnostic) => diagnostic.unresolved,
  );
  const preview = unresolvedDiagnostics
    .slice(0, 10)
    .map(
      (diagnostic) =>
        `- ${diagnostic.bucket}: ${diagnostic.filePath}:${diagnostic.line} ${diagnostic.rule}`,
    )
    .join("\n");

  throw new Error(
    [
      `React Doctor governance has ${result.summary.unresolved} unresolved diagnostics.`,
      "Unresolved diagnostics must be fixed or classified with owner/reason before merge.",
      preview,
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

function pairKey(filePath, ruleIdentifier) {
  return `${filePath}\u0000${ruleIdentifier}`;
}

function countKey(filePath, ruleIdentifier, count) {
  return `${filePath}\u0000${ruleIdentifier}\u0000${count}`;
}

function formatPair(key) {
  const [filePath, ruleIdentifier] = key.split("\u0000");
  return `${filePath} ${ruleIdentifier}`;
}

function formatCountPair(key) {
  const [filePath, ruleIdentifier, count] = key.split("\u0000");
  return `${filePath} ${ruleIdentifier} x${count}`;
}

function pairSet(pairs) {
  return new Set(
    pairs.map((pair) => pairKey(pair.filePath, pair.ruleIdentifier)),
  );
}

function countedPairSet(pairs) {
  const counts = new Map();
  for (const pair of pairs) {
    const baseKey = `${pair.filePath}\u0000${pair.ruleIdentifier}`;
    counts.set(baseKey, (counts.get(baseKey) ?? 0) + 1);
  }
  return new Set(
    [...counts.entries()].map(([baseKey, count]) => {
      const [filePath, ruleIdentifier] = baseKey.split("\u0000");
      return countKey(filePath, ruleIdentifier, count);
    }),
  );
}

export function assertSuppressionCoverage(result, config) {
  const ignore = config.ignore ?? {};
  const globalRules = Array.isArray(ignore.rules) ? ignore.rules : [];
  const globalFiles = Array.isArray(ignore.files) ? ignore.files : [];

  if (globalRules.length > 0) {
    throw new Error(
      "React Doctor config uses ignore.rules. Use narrow ignore.overrides instead.",
    );
  }

  if (globalFiles.length > 0) {
    throw new Error(
      "React Doctor config uses ignore.files. Use narrow ignore.overrides instead.",
    );
  }

  const rawPairs = pairSet(
    result.diagnostics.map((diagnostic) => ({
      filePath: diagnostic.filePath,
      ruleIdentifier: getRuleIdentifier(diagnostic),
    })),
  );
  const overridePairInputs = [];

  for (const [index, override] of (ignore.overrides ?? []).entries()) {
    if (!Array.isArray(override.files) || override.files.length === 0) {
      throw new Error(
        `React Doctor config ignore.overrides[${index}] has no file list.`,
      );
    }

    if (!Array.isArray(override.rules) || override.rules.length === 0) {
      throw new Error(
        `React Doctor config ignore.overrides[${index}] suppresses whole files. Add explicit rules.`,
      );
    }

    for (const filePath of override.files) {
      for (const ruleIdentifier of override.rules) {
        overridePairInputs.push({ filePath, ruleIdentifier });
      }
    }
  }
  const overridePairs = pairSet(overridePairInputs);

  const missingPairs = [...rawPairs].filter((key) => !overridePairs.has(key));
  const stalePairs = [...overridePairs].filter((key) => !rawPairs.has(key));

  if (missingPairs.length > 0 || stalePairs.length > 0) {
    const missingPreview = missingPairs
      .slice(0, 10)
      .map(formatPair)
      .join("\n");
    const stalePreview = stalePairs.slice(0, 10).map(formatPair).join("\n");

    throw new Error(
      [
        "React Doctor suppression config does not match the pre-config diagnostic set.",
        missingPairs.length > 0
          ? `Missing overrides (${missingPairs.length}):\n${missingPreview}`
          : "",
        stalePairs.length > 0
          ? `Stale overrides (${stalePairs.length}):\n${stalePreview}`
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }
}

export function buildDiagnosticCountBaseline(result) {
  return {
    diagnostics: [...countedPairSet(
      result.diagnostics.map((diagnostic) => ({
        filePath: diagnostic.filePath,
        ruleIdentifier: getRuleIdentifier(diagnostic),
      })),
    )]
      .map((key) => {
        const [filePath, ruleIdentifier, count] = key.split("\u0000");
        return {
          filePath,
          rule: ruleIdentifier,
          count: Number(count),
        };
      })
      .sort((left, right) =>
        `${left.filePath}\u0000${left.rule}`.localeCompare(
          `${right.filePath}\u0000${right.rule}`,
        ),
      ),
  };
}

export function assertDiagnosticCountBaseline(result, baseline) {
  const currentPairs = countedPairSet(
    result.diagnostics.map((diagnostic) => ({
      filePath: diagnostic.filePath,
      ruleIdentifier: getRuleIdentifier(diagnostic),
    })),
  );
  const baselinePairs = new Set(
    (baseline.diagnostics ?? []).map((diagnostic) =>
      countKey(diagnostic.filePath, diagnostic.rule, diagnostic.count),
    ),
  );
  const missingPairs = [...currentPairs].filter((key) => !baselinePairs.has(key));
  const stalePairs = [...baselinePairs].filter((key) => !currentPairs.has(key));

  if (missingPairs.length > 0 || stalePairs.length > 0) {
    const missingPreview = missingPairs
      .slice(0, 10)
      .map(formatCountPair)
      .join("\n");
    const stalePreview = stalePairs
      .slice(0, 10)
      .map(formatCountPair)
      .join("\n");

    throw new Error(
      [
        "React Doctor raw diagnostic count baseline does not match.",
        missingPairs.length > 0
          ? `Missing baseline entries (${missingPairs.length}):\n${missingPreview}`
          : "",
        stalePairs.length > 0
          ? `Stale baseline entries (${stalePairs.length}):\n${stalePreview}`
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }
}

function loadReport(reportPath) {
  return JSON.parse(fs.readFileSync(reportPath, "utf8"));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const reportPath = process.argv[2];
  const args = process.argv.slice(3);
  const check = args.includes("--check");
  const configArgPrefix = "--suppression-config=";
  const suppressionConfigPath = args
    .find((arg) => arg.startsWith(configArgPrefix))
    ?.slice(configArgPrefix.length);
  const outputPath =
    args.find((arg) => !arg.startsWith("--") && arg !== suppressionConfigPath) ??
    "reports/quality/react-doctor-classified.json";

  if (!reportPath) {
    console.error(
      "Usage: node scripts/quality/react-doctor-classify.mjs <react-doctor-report.json> [output.json]",
    );
    process.exit(2);
  }

  const report = loadReport(reportPath);
  const diagnostics = report.projects?.[0]?.diagnostics ?? [];
  const result = classifyDiagnostics(diagnostics);
  writeJson(outputPath, result);
  console.log(
    `[react-doctor-classify] wrote ${outputPath} with ${result.summary.total} diagnostics`,
  );

  if (check) {
    assertGovernance(result);
    if (suppressionConfigPath) {
      assertSuppressionCoverage(result, loadReport(suppressionConfigPath));
      console.log("[react-doctor-classify] suppression coverage check passed");
    }
    console.log("[react-doctor-classify] governance check passed");
  }
}
