import { describe, expect, it } from "vitest";
import {
  assertDiagnosticCountBaseline,
  assertGovernance,
  assertSuppressionCoverage,
  buildDiagnosticCountBaseline,
  classifyDiagnostics,
} from "../../../scripts/quality/react-doctor-classify.mjs";

const diagnostics = [
  {
    severity: "error",
    rule: "effect-needs-cleanup",
    category: "State & Effects",
    plugin: "react-doctor",
    filePath: "src/components/example.tsx",
    line: 12,
    message: "effect needs cleanup",
  },
  {
    severity: "warning",
    rule: "no-danger",
    category: "Correctness",
    plugin: "react",
    filePath: "src/components/seo/json-ld-script.tsx",
    line: 74,
    message: "Do not use dangerouslySetInnerHTML prop",
  },
  {
    severity: "warning",
    rule: "design-no-vague-button-label",
    category: "Accessibility",
    plugin: "react-doctor",
    filePath: "src/components/ui/__tests__/button.test.tsx",
    line: 171,
    message: "Vague button label",
  },
  {
    severity: "warning",
    rule: "async-await-in-loop",
    category: "Performance",
    plugin: "react-doctor",
    filePath: "src/lib/api/safe-parse-json.ts",
    line: 74,
    message: "await inside loop",
  },
  {
    severity: "warning",
    rule: "server-sequential-independent-await",
    category: "Server",
    plugin: "react-doctor",
    filePath: "src/app/[locale]/products/page.tsx",
    line: 68,
    message: "sequential await",
  },
  {
    severity: "warning",
    rule: "design-no-redundant-size-axes",
    category: "Architecture",
    plugin: "react-doctor",
    filePath: "src/components/sections/quality-section-view.tsx",
    line: 83,
    message: "h-10 w-10",
  },
  {
    severity: "warning",
    rule: "no-array-index-as-key",
    category: "Correctness",
    plugin: "react-doctor",
    filePath: "src/components/product-list.tsx",
    line: 24,
    message: "Array index used as React key",
  },
  {
    severity: "warning",
    rule: "no-event-handler",
    category: "State & Effects",
    plugin: "effect",
    filePath: "src/components/security/turnstile.tsx",
    line: 122,
    message: "Avoid using props and effects as an event handler",
  },
  {
    severity: "warning",
    rule: "nextjs-no-use-search-params-without-suspense",
    category: "Next.js",
    plugin: "nextjs",
    filePath: "src/components/monitoring/enterprise-analytics-island.tsx",
    line: 30,
    message: "useSearchParams() requires a <Suspense> boundary",
  },
  {
    severity: "warning",
    rule: "nextjs-no-redirect-in-try-catch",
    category: "Next.js",
    plugin: "nextjs",
    filePath: "src/app/[locale]/blog/[slug]/page.tsx",
    line: 32,
    message: "notFound() inside try-catch",
  },
  {
    severity: "warning",
    rule: "no-array-index-as-key",
    category: "Correctness",
    plugin: "react-doctor",
    filePath: "src/app/[locale]/about/page.tsx",
    line: 66,
    message: "Array index used as React key",
  },
  {
    severity: "warning",
    rule: "no-array-index-as-key",
    category: "Correctness",
    plugin: "react-doctor",
    filePath: "src/components/grid/grid-frame.tsx",
    line: 49,
    message: "Array index used as React key",
  },
  {
    severity: "warning",
    rule: "no-array-index-as-key",
    category: "Correctness",
    plugin: "react-doctor",
    filePath: "src/emails/ContactFormEmail.tsx",
    line: 61,
    message: "Array index used as React key",
  },
  {
    severity: "warning",
    rule: "no-render-in-render",
    category: "Architecture",
    plugin: "react-doctor",
    filePath: "src/app/[locale]/capabilities/page.tsx",
    line: 80,
    message: "Inline render function renderLegalContent()",
  },
  {
    severity: "warning",
    rule: "js-set-map-lookups",
    category: "Performance",
    plugin: "react-doctor",
    filePath: "scripts/starter-checks.js",
    line: 253,
    message: "array.indexOf() in a loop is O(n) per call",
  },
  {
    severity: "warning",
    rule: "async-await-in-loop",
    category: "Performance",
    plugin: "react-doctor",
    filePath: "scripts/starter-checks.js",
    line: 4024,
    message: "await inside retry loop",
  },
  {
    severity: "warning",
    rule: "rerender-state-only-in-handlers",
    category: "State & Effects",
    plugin: "react-doctor",
    filePath: "src/components/ui/lazy-theme-switcher.tsx",
    line: 13,
    message: "useState is updated but never read in the component's return",
  },
  {
    severity: "warning",
    rule: "js-set-map-lookups",
    category: "Performance",
    plugin: "react-doctor",
    filePath: "src/lib/security-validation.ts",
    line: 195,
    message: "array.indexOf() in a loop is O(n) per call",
  },
  {
    severity: "warning",
    rule: "rendering-usetransition-loading",
    category: "State & Effects",
    plugin: "react-doctor",
    filePath: "src/components/security/turnstile.tsx",
    line: 218,
    message: "useState for isLoading; consider useTransition instead",
  },
  {
    severity: "warning",
    rule: "no-unused-component",
    category: "Architecture",
    plugin: "react-doctor",
    filePath: "src/components/legacy-unused.tsx",
    line: 1,
    message: "Component is not used anywhere",
  },
] as const;

describe("react doctor classifier", () => {
  it("classifies diagnostics into stable governance buckets", () => {
    const result = classifyDiagnostics(diagnostics);

    expect(result.summary.total).toBe(20);
    expect(result.byBucket["blocking-error"]).toBe(1);
    expect(result.byBucket["project-exception"]).toBe(8);
    expect(result.byBucket["test-fixture-noise"]).toBe(1);
    expect(result.byBucket["needs-manual-proof"]).toBe(1);
    expect(result.byBucket["low-value-style"]).toBe(4);
    expect(result.byBucket["confirmed-real"]).toBe(5);
    expect(result.byBucket["delete-after-proof"]).toBeUndefined();
  });

  it("maps every diagnostic to an explicit disposition, owner, and unresolved flag", () => {
    const result = classifyDiagnostics(diagnostics);
    const byBucket = Object.fromEntries(
      result.diagnostics.map((diagnostic) => [diagnostic.bucket, diagnostic]),
    );

    expect(byBucket["blocking-error"]).toMatchObject({
      disposition: "fix",
      owner: "engineering",
      unresolved: true,
    });
    expect(byBucket["confirmed-real"]).toMatchObject({
      disposition: "fix",
      owner: "engineering",
      unresolved: true,
    });
    expect(byBucket["project-exception"]).toMatchObject({
      disposition: "exempt-after-proof",
      owner: "quality-governance",
      unresolved: false,
    });
    expect(byBucket["test-fixture-noise"]).toMatchObject({
      disposition: "exempt-after-proof",
      owner: "test-governance",
      unresolved: false,
    });
    expect(byBucket["needs-manual-proof"]).toMatchObject({
      disposition: "temporarily-retain",
      owner: "proof-lane",
      unresolved: false,
    });
    expect(byBucket["low-value-style"]).toMatchObject({
      disposition: "temporarily-retain",
      owner: "quality-governance",
      unresolved: false,
    });
  });

  it("summarizes unresolved diagnostics separately from raw warnings", () => {
    const result = classifyDiagnostics(diagnostics);

    expect(result.summary.unresolved).toBe(6);
    expect(result.byDisposition).toEqual({
      fix: 6,
      "exempt-after-proof": 9,
      "temporarily-retain": 5,
    });
  });

  it("fails the governance gate when unresolved diagnostics remain", () => {
    const result = classifyDiagnostics(diagnostics);

    expect(() => assertGovernance(result)).toThrow(
      "React Doctor governance has 6 unresolved diagnostics",
    );
  });

  it("passes the governance gate when every warning has a non-blocking disposition", () => {
    const governedDiagnostics = diagnostics.filter(
      (diagnostic) =>
        diagnostic.severity !== "error" &&
        diagnostic.filePath !== "src/app/[locale]/blog/[slug]/page.tsx" &&
        diagnostic.filePath !== "src/emails/ContactFormEmail.tsx" &&
        diagnostic.filePath !== "src/lib/security-validation.ts" &&
        diagnostic.filePath !== "src/components/product-list.tsx" &&
        diagnostic.filePath !== "src/components/legacy-unused.tsx",
    );
    const result = classifyDiagnostics(governedDiagnostics);

    expect(result.summary.unresolved).toBe(0);
    expect(() => assertGovernance(result)).not.toThrow();
  });

  it("keeps bucket entries traceable to file, rule, and line", () => {
    const result = classifyDiagnostics(diagnostics);
    const jsonLd = result.diagnostics.find(
      (diagnostic) =>
        diagnostic.filePath === "src/components/seo/json-ld-script.tsx",
    );

    expect(jsonLd).toMatchObject({
      bucket: "project-exception",
      rule: "no-danger",
      line: 74,
    });
  });

  it("keeps proven Suspense-covered analytics as an exception while treating returning blog notFound diagnostics as regressions", () => {
    const result = classifyDiagnostics(diagnostics);
    const analytics = result.diagnostics.find(
      (diagnostic) =>
        diagnostic.filePath ===
        "src/components/monitoring/enterprise-analytics-island.tsx",
    );
    const blogNotFound = result.diagnostics.find(
      (diagnostic) =>
        diagnostic.filePath === "src/app/[locale]/blog/[slug]/page.tsx",
    );

    expect(analytics).toMatchObject({
      bucket: "project-exception",
      rule: "nextjs-no-use-search-params-without-suspense",
    });
    expect(blogNotFound).toMatchObject({
      bucket: "confirmed-real",
      rule: "nextjs-no-redirect-in-try-catch",
    });
  });

  it("does not keep proven low-signal key and render warnings in confirmed-real", () => {
    const result = classifyDiagnostics(diagnostics);
    const skeletonKey = result.diagnostics.find(
      (diagnostic) => diagnostic.filePath === "src/app/[locale]/about/page.tsx",
    );
    const decorativeGridKey = result.diagnostics.find(
      (diagnostic) =>
        diagnostic.filePath === "src/components/grid/grid-frame.tsx",
    );
    const emailLineKey = result.diagnostics.find(
      (diagnostic) => diagnostic.filePath === "src/emails/ContactFormEmail.tsx",
    );
    const legalContentRender = result.diagnostics.find(
      (diagnostic) =>
        diagnostic.filePath === "src/app/[locale]/capabilities/page.tsx",
    );

    expect(skeletonKey).toMatchObject({
      bucket: "low-value-style",
      rule: "no-array-index-as-key",
    });
    expect(decorativeGridKey).toMatchObject({
      bucket: "low-value-style",
      rule: "no-array-index-as-key",
    });
    expect(emailLineKey).toMatchObject({
      bucket: "confirmed-real",
      rule: "no-array-index-as-key",
    });
    expect(legalContentRender).toMatchObject({
      bucket: "low-value-style",
      rule: "no-render-in-render",
    });
  });

  it("keeps proven quality script false positives out of confirmed-real", () => {
    const result = classifyDiagnostics(diagnostics);
    const starterChecks = result.diagnostics.find(
      (diagnostic) =>
        diagnostic.filePath === "scripts/starter-checks.js" &&
        diagnostic.rule === "js-set-map-lookups",
    );
    const retryLoop = result.diagnostics.find(
      (diagnostic) =>
        diagnostic.filePath === "scripts/starter-checks.js" &&
        diagnostic.rule === "async-await-in-loop",
    );

    expect(starterChecks).toMatchObject({
      bucket: "project-exception",
      rule: "js-set-map-lookups",
    });
    expect(retryLoop).toMatchObject({
      bucket: "project-exception",
      rule: "async-await-in-loop",
    });
  });

  it("keeps lazy island activation state warnings out of confirmed-real", () => {
    const result = classifyDiagnostics(diagnostics);
    const lazyThemeSwitcher = result.diagnostics.find(
      (diagnostic) =>
        diagnostic.filePath === "src/components/ui/lazy-theme-switcher.tsx",
    );

    expect(lazyThemeSwitcher).toMatchObject({
      bucket: "project-exception",
      rule: "rerender-state-only-in-handlers",
    });
  });

  it("treats returning sanitizer string scans as regressions after the proof lane", () => {
    const result = classifyDiagnostics(diagnostics);
    const sanitizerScan = result.diagnostics.find(
      (diagnostic) =>
        diagnostic.filePath === "src/lib/security-validation.ts" &&
        diagnostic.rule === "js-set-map-lookups",
    );

    expect(sanitizerScan).toMatchObject({
      bucket: "confirmed-real",
      rule: "js-set-map-lookups",
    });
  });

  it("keeps external Turnstile loading state as a documented exception", () => {
    const result = classifyDiagnostics(diagnostics);
    const turnstileLoading = result.diagnostics.find(
      (diagnostic) =>
        diagnostic.filePath === "src/components/security/turnstile.tsx" &&
        diagnostic.rule === "rendering-usetransition-loading",
    );

    expect(turnstileLoading).toMatchObject({
      bucket: "project-exception",
      rule: "rendering-usetransition-loading",
    });
  });

  it("proves suppression config matches the classified raw file/rule pairs", () => {
    const governedDiagnostics = diagnostics.filter(
      (diagnostic) =>
        diagnostic.severity !== "error" &&
        diagnostic.filePath !== "src/components/product-list.tsx" &&
        diagnostic.filePath !== "src/components/legacy-unused.tsx",
    );
    const result = classifyDiagnostics(governedDiagnostics);
    const config = {
      ignore: {
        overrides: governedDiagnostics.map((diagnostic) => ({
          files: [diagnostic.filePath],
          rules: [`${diagnostic.plugin}/${diagnostic.rule}`],
        })),
      },
    };

    expect(() => assertSuppressionCoverage(result, config)).not.toThrow();
  });

  it("rejects suppression config that misses current raw diagnostics", () => {
    const governedDiagnostics = diagnostics.filter(
      (diagnostic) =>
        diagnostic.severity !== "error" &&
        diagnostic.filePath !== "src/components/product-list.tsx" &&
        diagnostic.filePath !== "src/components/legacy-unused.tsx",
    );
    const result = classifyDiagnostics(governedDiagnostics);
    const config = {
      ignore: {
        overrides: [],
      },
    };

    expect(() => assertSuppressionCoverage(result, config)).toThrow(
      "React Doctor suppression config does not match",
    );
  });

  it("tracks raw diagnostic counts separately from file and rule suppression coverage", () => {
    const governedDiagnostics = diagnostics.filter(
      (diagnostic) =>
        diagnostic.severity !== "error" &&
        diagnostic.filePath !== "src/components/product-list.tsx" &&
        diagnostic.filePath !== "src/components/legacy-unused.tsx",
    );
    const firstDiagnostic = governedDiagnostics[0];
    if (!firstDiagnostic) {
      throw new Error("Expected governed diagnostics fixture to be non-empty");
    }
    const extraDiagnostic = {
      ...firstDiagnostic,
      line: 999,
      message: "Second diagnostic for the same file and rule",
    };
    const result = classifyDiagnostics([
      ...governedDiagnostics,
      extraDiagnostic,
    ]);
    const config = {
      ignore: {
        overrides: governedDiagnostics.map((diagnostic) => ({
          files: [diagnostic.filePath],
          rules: [`${diagnostic.plugin}/${diagnostic.rule}`],
        })),
      },
    };

    expect(() => assertSuppressionCoverage(result, config)).not.toThrow();
    expect(() =>
      assertDiagnosticCountBaseline(
        result,
        buildDiagnosticCountBaseline(classifyDiagnostics(governedDiagnostics)),
      ),
    ).toThrow("React Doctor raw diagnostic count baseline does not match");
  });

  it("rejects broad suppression config shapes", () => {
    const result = classifyDiagnostics([]);

    expect(() =>
      assertSuppressionCoverage(result, {
        ignore: { rules: ["react/no-danger"] },
      }),
    ).toThrow("ignore.rules");
    expect(() =>
      assertSuppressionCoverage(result, {
        ignore: { files: ["src/components/example.tsx"] },
      }),
    ).toThrow("ignore.files");
    expect(() =>
      assertSuppressionCoverage(result, {
        ignore: { overrides: [{ files: ["src/components/example.tsx"] }] },
      }),
    ).toThrow("suppresses whole files");
  });
});
