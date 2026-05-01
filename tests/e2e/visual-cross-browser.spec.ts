import { expect, test } from "@playwright/test";

/**
 * Cross-Browser Visual Regression (Phase 2)
 *
 * Captures screenshots of key pages across browsers and compares
 * against baselines. Only runs when CI_DAILY=true (full matrix).
 *
 * To update baselines (must be done in CI Linux environment):
 *   CI_DAILY=true pnpm test:e2e -- --update-snapshots tests/e2e/visual-cross-browser.spec.ts
 *
 * Key pages selected based on visual complexity:
 * - Homepage: hero + multi-section layout
 * - Products: grid of market cards
 * - Contact: form layout
 */

const isDaily = process.env.CI_DAILY === "true";
test.skip(!isDaily, "Visual regression only runs in CI_DAILY mode");

const VISUAL_PAGES = [
  { path: "/en", name: "homepage" },
  { path: "/en/products", name: "products" },
  { path: "/en/contact", name: "contact" },
];

for (const { path, name } of VISUAL_PAGES) {
  test(`visual: ${name}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");

    // Mask dynamic content that changes between runs
    const masks = [
      page.locator('[data-testid="proof-counter"]'), // animated counters
      page.locator("time"), // dates
      page.locator('[class*="turnstile"]'), // Turnstile widget
      page.locator(".animate-pulse"), // loading placeholders
    ];

    await expect(page).toHaveScreenshot(`${name}.png`, {
      fullPage: true,
      animations: "disabled",
      mask: masks,
      maxDiffPixelRatio: 0.02,
    });
  });
}
