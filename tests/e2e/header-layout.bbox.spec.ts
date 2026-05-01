import { expect, test, type Locator } from "@playwright/test";
import { getHeaderMobileMenuButton, getNav } from "./helpers/navigation";
import {
  removeInterferingElements,
  waitForLoadWithFallback,
  waitForStablePage,
} from "./test-environment-setup";

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

function boxesOverlap(a: Box, b: Box, padding = 1): boolean {
  const leftA = a.x + padding;
  const rightA = a.x + a.width - padding;
  const topA = a.y + padding;
  const bottomA = a.y + a.height - padding;

  const leftB = b.x + padding;
  const rightB = b.x + b.width - padding;
  const topB = b.y + padding;
  const bottomB = b.y + b.height - padding;

  const overlapX = leftA < rightB && rightA > leftB;
  const overlapY = topA < bottomB && bottomA > topB;
  return overlapX && overlapY;
}

async function expectBoundingBox(locator: Locator, name: string): Promise<Box> {
  await expect(locator, `${name} should be visible`).toBeVisible();
  const box = await locator.boundingBox();
  expect(box, `${name} should have a bounding box`).not.toBeNull();
  return box as Box;
}

const LOCALES = ["en", "zh"] as const;

const VIEWPORTS = [
  {
    name: "mobile-375",
    viewport: { width: 375, height: 800 },
    mode: "mobile",
  },
  {
    name: "mobile-839",
    viewport: { width: 839, height: 800 },
    mode: "mobile",
  },
  {
    name: "compact-desktop-840",
    viewport: { width: 840, height: 800 },
    mode: "compactDesktop",
  },
  {
    name: "compact-desktop-1024",
    viewport: { width: 1024, height: 800 },
    mode: "compactDesktop",
  },
  {
    name: "full-desktop-1200",
    viewport: { width: 1200, height: 800 },
    mode: "fullDesktop",
  },
] as const;

test.describe("Header layout (bbox regression)", () => {
  for (const locale of LOCALES) {
    for (const { name, viewport, mode } of VIEWPORTS) {
      test(`${locale} / ${name}`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await page.goto(`/${locale}`);
        await page.waitForURL(`**/${locale}`);
        await waitForLoadWithFallback(page, {
          context: `header-layout ${locale} ${name}`,
          loadTimeout: 10_000,
          fallbackDelay: 500,
        });
        await removeInterferingElements(page);
        await waitForStablePage(page);

        const mobileMenuButton = getHeaderMobileMenuButton(page);
        const nav = getNav(page);
        const cta = page.getByTestId("header-cta").first();
        const languageToggle = page
          .getByTestId("language-toggle-button")
          .first();

        if (mode === "mobile") {
          await expect(mobileMenuButton).toBeVisible({ timeout: 10_000 });
          await expect(nav).not.toBeVisible({ timeout: 10_000 });
          await expect(cta).not.toBeVisible({ timeout: 10_000 });
          await expect(languageToggle).not.toBeVisible({ timeout: 10_000 });
          return;
        }

        await expect(nav).toBeVisible({ timeout: 10_000 });
        await expect(mobileMenuButton).not.toBeVisible({ timeout: 10_000 });

        if (mode === "compactDesktop") {
          await expect(cta).not.toBeVisible({ timeout: 10_000 });
          await expect(languageToggle).not.toBeVisible({ timeout: 10_000 });
        } else {
          await expect(cta).toBeVisible({ timeout: 10_000 });
          await expect(languageToggle).toBeVisible({ timeout: 10_000 });
        }

        const logoLink = page
          .getByRole("link", { name: /Example Showcase Company/ })
          .first();

        const logoBox = await expectBoundingBox(logoLink, "Logo link");
        const navBox = await expectBoundingBox(nav, "Desktop navigation");

        expect(
          boxesOverlap(logoBox, navBox),
          "Logo should not overlap desktop navigation",
        ).toBe(false);

        if (await cta.isVisible().catch(() => false)) {
          const ctaBox = await expectBoundingBox(cta, "Header CTA");
          expect(
            boxesOverlap(navBox, ctaBox),
            "Desktop navigation should not overlap CTA",
          ).toBe(false);
          expect(
            boxesOverlap(logoBox, ctaBox),
            "Logo should not overlap CTA",
          ).toBe(false);
        }

        if (await languageToggle.isVisible().catch(() => false)) {
          const languageBox = await expectBoundingBox(
            languageToggle,
            "Language toggle",
          );
          expect(
            boxesOverlap(navBox, languageBox),
            "Desktop navigation should not overlap language toggle",
          ).toBe(false);
        }
      });
    }
  }
});
