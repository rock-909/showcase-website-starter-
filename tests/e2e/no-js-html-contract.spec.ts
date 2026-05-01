import { expect, test } from "@playwright/test";
import { getHeaderMobileMenuButton } from "./helpers/navigation";

const localeCases = [
  {
    locale: "en",
    skipLabel: "Skip to main content",
    contactHeading: /Contact Us/i,
  },
  {
    locale: "zh",
    skipLabel: "跳转到主要内容",
    contactHeading: /联系我们/i,
  },
] as const;

function expectExactlyOneMain(html: string) {
  expect((html.match(/<main\b/g) ?? []).length).toBe(1);
}

for (const localeCase of localeCases) {
  test.describe(`No-JS HTML contract (${localeCase.locale})`, () => {
    test.use({ javaScriptEnabled: false });

    test("homepage keeps meaningful structure without client boot", async ({
      page,
    }) => {
      await page.goto(`http://localhost:3000/${localeCase.locale}`, {
        waitUntil: "domcontentloaded",
      });

      await expect(
        page.getByRole("link", { name: localeCase.skipLabel }),
      ).toBeVisible();
      await expect(
        page.getByRole("navigation", { name: /main navigation/i }),
      ).toBeVisible();
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

      const html = await page.content();
      expectExactlyOneMain(html);
      expect(html).not.toContain("BAILOUT_TO_CLIENT_SIDE_RENDERING");
      expect(html).toContain('id="main-content"');
    });

    test("mobile homepage exposes navigation fallback without JavaScript", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`http://localhost:3000/${localeCase.locale}`, {
        waitUntil: "domcontentloaded",
      });

      const trigger = getHeaderMobileMenuButton(page);
      await expect(trigger).toBeVisible();
      await expect(trigger).toHaveAttribute("aria-haspopup", "dialog");

      await trigger.click();

      await expect(
        page.getByTestId("header-mobile-navigation-fallback-panel"),
      ).toBeVisible();
      await expect(
        page.getByRole("navigation", { name: /mobile navigation menu/i }),
      ).toBeVisible();
    });

    test("contact page renders form structure without JavaScript", async ({
      page,
    }) => {
      await page.goto(`http://localhost:3000/${localeCase.locale}/contact`, {
        waitUntil: "domcontentloaded",
      });

      await expect(
        page.getByRole("link", { name: localeCase.skipLabel }),
      ).toBeVisible();
      await expect(
        page.getByRole("navigation", { name: /main navigation/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: localeCase.contactHeading }),
      ).toBeVisible();

      const html = await page.content();
      expectExactlyOneMain(html);
      expect(html).toContain('id="main-content"');
      expect(html).toContain("<form");
      for (const fieldName of [
        "firstName",
        "lastName",
        "email",
        "company",
        "message",
        "acceptPrivacy",
      ]) {
        expect(html).toContain(`name="${fieldName}"`);
      }
    });

    test("key localized pages expose one composed main landmark", async ({
      page,
    }) => {
      for (const path of [
        `/${localeCase.locale}/about`,
        `/${localeCase.locale}/products`,
        `/${localeCase.locale}/products/north-america`,
        `/${localeCase.locale}/privacy`,
        `/${localeCase.locale}/terms`,
        `/${localeCase.locale}/custom-project-support`,
      ]) {
        await page.goto(`http://localhost:3000${path}`, {
          waitUntil: "domcontentloaded",
        });

        expectExactlyOneMain(await page.content());
      }
    });
  });
}
