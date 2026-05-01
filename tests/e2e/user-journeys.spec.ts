import { expect, test } from "@playwright/test";
import { getNav } from "./helpers/navigation";
import {
  removeInterferingElements,
  waitForLoadWithFallback,
  waitForStablePage,
} from "./test-environment-setup";

/**
 * User Journey E2E Tests
 *
 * Aligned to Behavioral Contracts (docs/specs/behavioral-contracts.md).
 * Each test covers a real user journey, not individual component checks.
 *
 * BC-002: Navigate to all main pages from header
 * BC-005: 404 for invalid routes
 * BC-013: Products page shows market cards
 * BC-014: Market page shows product specs
 * BC-020: All internal links point to real routes
 */

test.describe("Journey: Browse Products (BC-013, BC-014)", () => {
  test("user navigates from homepage to products to a market page", async ({
    page,
  }) => {
    // Start at homepage
    await page.goto("/en");
    await waitForLoadWithFallback(page, {
      context: "homepage for product journey",
      loadTimeout: 5_000,
      fallbackDelay: 500,
    });
    await removeInterferingElements(page);
    await waitForStablePage(page);

    // Click Products in navigation
    const nav = getNav(page);
    const productsLink = nav.getByRole("link", { name: /Products/i });
    await expect(productsLink).toBeVisible({ timeout: 10_000 });
    await productsLink.click();
    await expect(page).toHaveURL(/\/products/);

    // BC-013: Products page should show market cards
    // Verify at least one market card link exists
    const marketLinks = page.locator('a[href*="/products/"]');
    await expect(marketLinks.first()).toBeVisible({ timeout: 10_000 });
    const marketCount = await marketLinks.count();
    expect(marketCount).toBeGreaterThanOrEqual(3); // At least 3 markets

    // Click the first market card
    await marketLinks.first().click();
    await expect(page).toHaveURL(/\/products\//);

    // BC-014: Market page should show product content
    // Verify the page loaded with meaningful content
    const heading = page.locator("h1").first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
    const headingText = await heading.textContent();
    expect(headingText?.length).toBeGreaterThan(0);

    // Verify product specs or family sections are present
    const contentSections = page.locator("section, [data-section]");
    const sectionCount = await contentSections.count();
    expect(sectionCount).toBeGreaterThanOrEqual(1);

    // Verify the URL contains a valid market slug
    const url = page.url();
    expect(url).toMatch(
      /\/products\/(north-america|australia-new-zealand|mexico|europe|specialty-product-systems)/,
    );
  });
});

test.describe("Journey: Navigate All Pages (BC-002)", () => {
  const pages = [
    { path: "/en", titlePattern: /Example Showcase Company/i },
    { path: "/en/about", titlePattern: /About/i },
    { path: "/en/products", titlePattern: /Product/i },
    { path: "/en/contact", titlePattern: /Contact|Example/i },
    {
      path: "/en/custom-project-support",
      titlePattern: /Custom|Example/i,
    },
    { path: "/en/privacy", titlePattern: /Privacy|Example/i },
    { path: "/en/terms", titlePattern: /Terms|Example/i },
  ];

  for (const { path, titlePattern } of pages) {
    test(`page ${path} loads and has title`, async ({ page }) => {
      const response = await page.goto(path);

      // Page should return 200
      expect(response?.status()).toBe(200);

      // Page should have a matching title
      await expect(page).toHaveTitle(titlePattern);

      // Page should have a visible main heading
      const heading = page.locator("h1").first();
      await expect(heading).toBeVisible({ timeout: 10_000 });
    });
  }
});

test.describe("Journey: 404 for Invalid Routes (BC-005)", () => {
  test("invalid route shows 404 page", async ({ page }) => {
    const response = await page.goto("/en/this-page-does-not-exist");

    // Should return 404
    expect(response?.status()).toBe(404);

    // Should show 404 text
    const notFoundText = page.getByText("404");
    await expect(notFoundText).toBeVisible({ timeout: 5_000 });

    // The 404 body should offer a dedicated recovery action, not just reuse nav/footer links
    const homeLink = page
      .getByRole("main")
      .getByRole("link", { name: /back to homepage|go back/i });
    await expect(homeLink).toBeVisible();
  });
});

test.describe("Journey: CTA Links Resolve (BC-020)", () => {
  test("homepage CTAs link to valid destinations", async ({ page }) => {
    await page.goto("/en");
    await waitForLoadWithFallback(page, {
      context: "homepage CTA check",
      loadTimeout: 5_000,
      fallbackDelay: 500,
    });
    await removeInterferingElements(page);
    await waitForStablePage(page);

    // Find all CTA-like links (buttons inside links, or prominent links)
    const ctaLinks = page.locator(
      'a:has(button), a[class*="cta"], a[class*="primary"]',
    );

    const count = await ctaLinks.count();
    expect(count).toBeGreaterThan(0);

    // Verify each CTA href points to a valid internal path
    for (let i = 0; i < count; i++) {
      const href = await ctaLinks.nth(i).getAttribute("href");
      if (href && href.startsWith("/")) {
        // Navigate and verify no 404/500
        const response = await page.goto(href);
        expect(response?.status()).toBeLessThan(400);
        // Go back for next CTA
        await page.goto("/en");
        await waitForStablePage(page);
      }
    }
  });
});

test.describe("Journey: Language Parity (BC-003)", () => {
  test("key pages exist in both en and zh", async ({ page }) => {
    const paths = ["/", "/about", "/products", "/contact"];

    for (const path of paths) {
      // English version
      const enResponse = await page.goto(`/en${path}`);
      expect(enResponse?.status()).toBe(200);

      // Chinese version
      const zhResponse = await page.goto(`/zh${path}`);
      expect(zhResponse?.status()).toBe(200);
    }
  });
});
