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
  "nextjs-no-redirect-in-try-catch",
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
    filePath: "src/components/ui/accordion.tsx",
    rule: "no-react19-deprecated-apis",
    reason:
      "Radix wrapper compatibility migration is a separate UI primitive wave.",
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
];

function isTestFile(filePath) {
  return TEST_FILE_PATTERN.test(filePath);
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

export function classifyDiagnostics(diagnostics) {
  const classifiedDiagnostics = diagnostics.map((diagnostic) => {
    const classification = classifyDiagnostic(diagnostic);
    return {
      ...diagnostic,
      bucket: classification.bucket,
      bucketReason: classification.reason,
    };
  });

  const byBucket = Object.create(null);
  const byRule = Object.create(null);
  const byScope = Object.create(null);

  for (const diagnostic of classifiedDiagnostics) {
    byBucket[diagnostic.bucket] = (byBucket[diagnostic.bucket] ?? 0) + 1;
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
    },
    byBucket,
    byRule,
    byScope,
    diagnostics: classifiedDiagnostics,
  };
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
  const outputPath =
    process.argv[3] ?? "reports/quality/react-doctor-classified.json";

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
}
