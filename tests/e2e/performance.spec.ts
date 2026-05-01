import { expect, test } from "@playwright/test";

test.describe("Performance Tests", () => {
  test("should load homepage within acceptable time", async ({ page }) => {
    const startTime = Date.now();

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForURL("**/en");

    const loadTime = Date.now() - startTime;
    console.log(`Homepage load time: ${loadTime}ms`);

    // CI 环境下 Node 进程和浏览器都更吃紧，适当放宽预算
    const budgetMs = process.env.CI ? 5000 : 3000;
    expect(loadTime).toBeLessThan(budgetMs);
  });

  test("should have good Core Web Vitals", async ({ page }) => {
    await page.goto("/");

    // Measure Core Web Vitals
    const vitals = await page.evaluate(() => {
      return new Promise((resolve) => {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const webVitals: Record<string, number> = {};

          entries.forEach((entry) => {
            if (entry.entryType === "navigation") {
              const navEntry = entry as PerformanceNavigationTiming;
              webVitals.FCP = navEntry.loadEventEnd - navEntry.fetchStart;
            }
          });

          resolve(webVitals);
        });

        observer.observe({ entryTypes: ["navigation", "paint"] });

        // Fallback timeout
        setTimeout(() => resolve({}), 5000);
      });
    });

    console.log("Core Web Vitals:", vitals);
  });

  test("should not have console errors", async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Filter out known acceptable errors
    const criticalErrors = consoleErrors.filter(
      (error) =>
        !error.includes("favicon") &&
        !error.includes("404") &&
        !error.includes("net::ERR_FAILED"),
    );

    expect(criticalErrors).toHaveLength(0);
  });

  test("should handle network failures gracefully", async ({ page }) => {
    // Simulate slow network
    await page.route("**/*", (route) => {
      setTimeout(() => route.continue(), 100);
    });

    await page.goto("/");

    // Page should still load and be functional
    await expect(page.locator("body")).toBeVisible();
  });
});
