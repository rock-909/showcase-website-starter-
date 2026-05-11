import { describe, expect, it } from "vitest";
import { classifyDiagnostics } from "../../../scripts/quality/react-doctor-classify.mjs";

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
] as const;

describe("react doctor classifier", () => {
  it("classifies diagnostics into stable governance buckets", () => {
    const result = classifyDiagnostics(diagnostics);

    expect(result.summary.total).toBe(10);
    expect(result.byBucket["blocking-error"]).toBe(1);
    expect(result.byBucket["project-exception"]).toBe(4);
    expect(result.byBucket["test-fixture-noise"]).toBe(1);
    expect(result.byBucket["needs-manual-proof"]).toBe(2);
    expect(result.byBucket["low-value-style"]).toBe(1);
    expect(result.byBucket["confirmed-real"]).toBe(1);
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

  it("keeps proven Suspense-covered analytics as an exception while leaving blog notFound for proof", () => {
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
      bucket: "needs-manual-proof",
      rule: "nextjs-no-redirect-in-try-catch",
    });
  });
});
