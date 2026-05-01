import { describe, expect, it } from "vitest";
import {
  collectMissingMarkersFromSource,
  collectRiskFindingsFromSource,
  RISK_SCAN_FILES,
} from "../../../scripts/check-translate-compat.js";

describe("check-translate-compat risk scanning", () => {
  it("flags direct JSX aliases backed by ternary text branches", () => {
    const findings = collectRiskFindingsFromSource(
      `
        export function Example({
          statusMessage,
          fallbackMessage,
          isReady,
        }: {
          statusMessage: string;
          fallbackMessage: string;
          isReady: boolean;
        }) {
          const resolvedMessage = isReady ? statusMessage : fallbackMessage;
          return <div>{resolvedMessage}</div>;
        }
      `,
      "src/components/forms/example.tsx",
    );

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "alias-direct-string",
          file: "src/components/forms/example.tsx",
        }),
      ]),
    );
  });

  it("flags direct JSX aliases backed by logical text branches", () => {
    const findings = collectRiskFindingsFromSource(
      `
        export function Example({
          shouldShow,
          statusMessage,
        }: {
          shouldShow: boolean;
          statusMessage: string;
        }) {
          const resolvedMessage = shouldShow && statusMessage;
          return <>{resolvedMessage}</>;
        }
      `,
      "src/components/forms/example.tsx",
    );

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "alias-direct-string",
        }),
      ]),
    );
  });

  it("flags direct JSX logical branches that resolve to template text", () => {
    const findings = collectRiskFindingsFromSource(
      `
        export function Example({
          shouldShow,
          count,
        }: {
          shouldShow: boolean;
          count: number;
        }) {
          return <div>{shouldShow && \`Ready \${count}\`}</div>;
        }
      `,
      "src/components/forms/example.tsx",
    );

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "logical-direct-string",
        }),
      ]),
    );
  });

  it("follows simple alias chains before JSX render", () => {
    const findings = collectRiskFindingsFromSource(
      `
        export function Example({
          successLabel,
          errorLabel,
          isSuccess,
        }: {
          successLabel: string;
          errorLabel: string;
          isSuccess: boolean;
        }) {
          const resolvedLabel = isSuccess ? successLabel : errorLabel;
          const forwardedLabel = resolvedLabel;
          return <span>{forwardedLabel}</span>;
        }
      `,
      "src/components/forms/example.tsx",
    );

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "alias-direct-string",
        }),
      ]),
    );
  });

  it("does not flag aliases inside protected wrappers", () => {
    const findings = collectRiskFindingsFromSource(
      `
        export function Example({
          statusMessage,
          fallbackMessage,
          isReady,
        }: {
          statusMessage: string;
          fallbackMessage: string;
          isReady: boolean;
        }) {
          const resolvedMessage = isReady ? statusMessage : fallbackMessage;
          return <span translate="no">{resolvedMessage}</span>;
        }
      `,
      "src/components/forms/example.tsx",
    );

    expect(findings).toEqual([]);
  });

  it("does not flag aliases that resolve to JSX elements", () => {
    const findings = collectRiskFindingsFromSource(
      `
        export function Example({ isReady }: { isReady: boolean }) {
          const resolvedContent = isReady ? <strong>Ready</strong> : null;
          return <div>{resolvedContent}</div>;
        }
      `,
      "src/components/forms/example.tsx",
    );

    expect(findings).toEqual([]);
  });
});

describe("check-translate-compat marker scanning", () => {
  it("matches real JSX markers without relying on raw substring search", () => {
    const missing = collectMissingMarkersFromSource(
      `
        export function Example({ item }: { item: { key: string } }) {
          return (
            <nav className="header-nav-center notranslate" translate="no">
              <span data-testid={\`header-nav-label-\${item.key}\`} translate="no">
                Label
              </span>
            </nav>
          );
        }
      `,
      "src/components/layout/header.tsx",
      ["header-nav-label-", "notranslate", 'translate="no"'],
    );

    expect(missing).toEqual([]);
  });

  it("does not require broad container notranslate when leaf labels are protected", () => {
    const missing = collectMissingMarkersFromSource(
      `
        export function Example() {
          return (
            <nav data-testid="header-desktop-nav">
              <span data-testid="header-nav-label-products" translate="no">
                Products
              </span>
            </nav>
          );
        }
      `,
      "src/components/layout/header.tsx",
      ["header-nav-label-", 'translate="no"'],
    );

    expect(missing).toEqual([]);
  });

  it("does not let an unrelated translate guard satisfy a protected leaf label", () => {
    const missing = collectMissingMarkersFromSource(
      `
        export function Example() {
          return (
            <nav data-testid="header-desktop-nav">
              <span data-testid="header-nav-label-products">Products</span>
              <span translate="no">Other protected copy</span>
            </nav>
          );
        }
      `,
      "src/components/layout/header.tsx",
      ["header-nav-label-", 'translate="no"'],
    );

    expect(missing).toEqual([
      expect.objectContaining({ marker: 'translate="no"' }),
    ]);
  });

  it("requires FAQ markers to include the translation guard", () => {
    const missing = collectMissingMarkersFromSource(
      `
        export function Example({ item }: { item: { key: string } }) {
          return (
            <div data-testid="faq-accordion">
              <span data-testid={\`faq-question-\${item.key}\`} translate="no">
                Question
              </span>
            </div>
          );
        }
      `,
      "src/components/sections/faq-accordion.tsx",
      ["faq-accordion", "faq-question-", 'translate="no"'],
    );

    expect(missing).toEqual([]);
  });

  it("does not let comments satisfy required markers", () => {
    const missing = collectMissingMarkersFromSource(
      `
        // header-nav-label-
        // notranslate
        // translate="no"
        export function Example() {
          return <nav><span>Label</span></nav>;
        }
      `,
      "src/components/layout/header.tsx",
      ["header-nav-label-", "notranslate", 'translate="no"'],
    );

    expect(missing).toEqual([
      expect.objectContaining({ marker: "header-nav-label-" }),
      expect.objectContaining({ marker: "notranslate" }),
      expect.objectContaining({ marker: 'translate="no"' }),
    ]);
  });
});

describe("check-translate-compat protected surface coverage", () => {
  it("risk-scans only pages that still have targeted translation protection contracts", () => {
    expect(RISK_SCAN_FILES).toEqual(
      expect.arrayContaining([
        "src/app/[locale]/contact/contact-form-static-fallback.tsx",
        "src/components/contact/product-family-context-notice.tsx",
      ]),
    );
    expect(RISK_SCAN_FILES).not.toEqual(
      expect.arrayContaining(["src/app/[locale]/contact/page.tsx"]),
    );
    expect(RISK_SCAN_FILES).not.toEqual(
      expect.arrayContaining(["src/app/[locale]/products/[market]/page.tsx"]),
    );
  });

  it("tracks only existing protected component surfaces", () => {
    expect(RISK_SCAN_FILES).toEqual(
      expect.arrayContaining([
        "src/components/layout/header-language-menu.tsx",
        "src/components/layout/mobile-navigation-interactive.tsx",
      ]),
    );
    expect(RISK_SCAN_FILES).not.toEqual(
      expect.arrayContaining([
        "src/components/blog/blog-newsletter.tsx",
        "src/components/language-toggle.tsx",
        "src/components/layout/vercel-navigation.tsx",
        "src/components/products/inquiry-drawer.tsx",
        "src/components/products/product-inquiry-form.tsx",
      ]),
    );
  });

  it("keeps the protected surface list pinned to current component paths", () => {
    expect(RISK_SCAN_FILES).toEqual([
      "src/app/[locale]/contact/contact-form-static-fallback.tsx",
      "src/components/contact/product-family-context-notice.tsx",
      "src/components/layout/header-language-menu.tsx",
      "src/components/layout/mobile-navigation-interactive.tsx",
      "src/components/forms/contact-form-container.tsx",
      "src/components/forms/contact-form-feedback.tsx",
      "src/components/layout/header.tsx",
      "src/components/layout/header-client.tsx",
      "src/components/sections/faq-accordion.tsx",
      "src/components/sections/final-cta.tsx",
      "src/components/sections/sample-cta.tsx",
    ]);
  });
});
