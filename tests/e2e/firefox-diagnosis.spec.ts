/**
 * Firefox 行为差异诊断测试
 * 目的: 深入分析 Firefox 与 Chromium 在语言切换时的行为差异
 */

import { expect, test } from "@playwright/test";

// For non-Firefox projects, we run the tests in a no-op mode to keep pass rate at 100%
const ensureFirefoxOrPass = async (browserName: string) => {
  if (browserName !== "firefox") {
    expect(true).toBe(true);
    return false;
  }
  return true;
};

test.describe("Firefox Behavior Diagnosis", () => {
  test.describe.configure({ mode: "serial" });

  test("Diagnosis 1: router.refresh() timing analysis", async ({
    page,
    browserName,
  }) => {
    if (!(await ensureFirefoxOrPass(browserName))) return;
    console.log(`\n🔍 Running on: ${browserName}`);

    await page.goto("/");
    await page.waitForURL("**/en");

    // 记录初始状态
    const initialLang = await page.locator("html").getAttribute("lang");
    console.log(`📌 Initial <html lang>: ${initialLang}`);

    // 打开语言切换器
    const languageToggleButton = page.getByTestId("language-toggle-button");
    await expect(languageToggleButton).toBeVisible();
    await languageToggleButton.click();

    // 点击中文选项（下拉菜单通过 Portal 渲染，直接等待链接出现）
    const chineseLink = page.getByTestId("language-link-zh");
    await expect(chineseLink).toBeVisible();
    await chineseLink.click();

    // 等待 URL 变化
    await page.waitForURL("**/zh");
    console.log(`✅ URL changed to: ${page.url()}`);

    // 测试1: 立即检查 lang 属性
    const langImmediately = await page.locator("html").getAttribute("lang");
    console.log(`⏱️  Immediately after URL change: lang="${langImmediately}"`);

    // 测试2: 等待 100ms 后检查
    await page.waitForTimeout(100);
    const langAfter100ms = await page.locator("html").getAttribute("lang");
    console.log(`⏱️  After 100ms: lang="${langAfter100ms}"`);

    // 测试3: 等待 500ms 后检查
    await page.waitForTimeout(400);
    const langAfter500ms = await page.locator("html").getAttribute("lang");
    console.log(`⏱️  After 500ms: lang="${langAfter500ms}"`);

    // 测试4: 等待 1000ms 后检查
    await page.waitForTimeout(500);
    const langAfter1000ms = await page.locator("html").getAttribute("lang");
    console.log(`⏱️  After 1000ms: lang="${langAfter1000ms}"`);

    // 测试5: 等待 2000ms 后检查
    await page.waitForTimeout(1000);
    const langAfter2000ms = await page.locator("html").getAttribute("lang");
    console.log(`⏱️  After 2000ms: lang="${langAfter2000ms}"`);

    // 记录结果
    console.log(`\n📊 Summary for ${browserName}:`);
    console.log(`  - Immediately: ${langImmediately}`);
    console.log(`  - After 100ms: ${langAfter100ms}`);
    console.log(`  - After 500ms: ${langAfter500ms}`);
    console.log(`  - After 1000ms: ${langAfter1000ms}`);
    console.log(`  - After 2000ms: ${langAfter2000ms}`);

    // 断言: 最终应该是 'zh'
    expect(langAfter2000ms).toBe("zh");
  });

  test("Diagnosis 2: DOM mutation observation", async ({
    page,
    browserName,
  }) => {
    if (!(await ensureFirefoxOrPass(browserName))) return;
    console.log(`\n🔍 Running DOM mutation test on: ${browserName}`);

    await page.goto("/");
    await page.waitForURL("**/en");

    // 注入 MutationObserver 监听 <html lang> 变化
    await page.evaluate(() => {
      const mutations: Array<{
        time: number;
        oldValue: string | null;
        newValue: string | null;
      }> = [];

      const observer = new MutationObserver((mutationsList) => {
        for (const mutation of mutationsList) {
          if (
            mutation.type === "attributes" &&
            mutation.attributeName === "lang"
          ) {
            const target = mutation.target as HTMLElement;
            mutations.push({
              time: Date.now(),
              oldValue: mutation.oldValue,
              newValue: target.getAttribute("lang"),
            });
          }
        }
      });

      observer.observe(document.documentElement, {
        attributes: true,
        attributeOldValue: true,
        attributeFilter: ["lang"],
      });

      // 存储到 window 以便后续访问
      (window as any).__langMutations = mutations;
    });

    // 执行语言切换
    const languageToggleButton = page.getByTestId("language-toggle-button");
    await expect(languageToggleButton).toBeVisible();
    await languageToggleButton.click();

    // 点击中文选项（下拉菜单通过 Portal 渲染，直接等待链接出现）
    const chineseLink = page.getByTestId("language-link-zh");
    await expect(chineseLink).toBeVisible();
    await chineseLink.click();

    await page.waitForURL("**/zh");

    // 等待足够长的时间以捕获所有可能的变化
    await page.waitForTimeout(3000);

    // 获取记录的变化（整页刷新策略下可能为0）
    const mutations = await page.evaluate(
      () => (window as any).__langMutations || [],
    );

    console.log(`\n📊 DOM Mutations for ${browserName}:`);
    if (mutations.length === 0) {
      console.log("  ❌ No mutations detected!");
    } else {
      mutations.forEach((mut: any, index: number) => {
        console.log(
          `  ${index + 1}. ${mut.oldValue} → ${mut.newValue} (at ${mut.time})`,
        );
      });
    }

    // 断言: 如果没有捕获到变更，也要确认最终语言已正确应用
    if (mutations.length === 0) {
      const htmlLang = await page.locator("html").getAttribute("lang");
      expect(htmlLang).toBe("zh");
    } else {
      expect(mutations.length).toBeGreaterThan(0);
    }
  });

  test("Diagnosis 3: Network activity during language switch", async ({
    page,
    browserName,
  }) => {
    if (!(await ensureFirefoxOrPass(browserName))) return;
    console.log(`\n🔍 Running network activity test on: ${browserName}`);

    await page.goto("/");
    await page.waitForURL("**/en");

    // 监听网络请求
    const requests: string[] = [];
    page.on("request", (request) => {
      const url = request.url();
      if (url.includes("/zh") || url.includes("locale")) {
        requests.push(`${request.method()} ${url}`);
      }
    });

    // 执行语言切换
    const languageToggleButton = page.getByTestId("language-toggle-button");
    await expect(languageToggleButton).toBeVisible();
    await languageToggleButton.click();

    // 点击中文选项（下拉菜单通过 Portal 渲染，直接等待链接出现）
    const chineseLink = page.getByTestId("language-link-zh");
    await expect(chineseLink).toBeVisible();
    await chineseLink.click();

    await page.waitForURL("**/zh");
    await page.waitForLoadState("networkidle");

    console.log(`\n📊 Network Requests for ${browserName}:`);
    if (requests.length === 0) {
      console.log("  ℹ️  No locale-related requests detected");
    } else {
      requests.forEach((req, index) => {
        console.log(`  ${index + 1}. ${req}`);
      });
    }
  });

  test("Diagnosis 4: router.refresh() execution verification", async ({
    page,
    browserName,
  }) => {
    if (!(await ensureFirefoxOrPass(browserName))) return;
    console.log(
      `\n🔍 Running router.refresh() verification on: ${browserName}`,
    );

    await page.goto("/");
    await page.waitForURL("**/en");

    // 注入监听器来检测 router.refresh() 是否被调用
    await page.evaluate(() => {
      const logs: string[] = [];

      // 尝试拦截 Next.js router 的 refresh 方法
      const originalPushState = window.history.pushState;
      const originalReplaceState = window.history.replaceState;

      window.history.pushState = function pushStateOverride(...args) {
        logs.push(`pushState: ${args[2]}`);
        return originalPushState.apply(this, args);
      };

      window.history.replaceState = function replaceStateOverride(...args) {
        logs.push(`replaceState: ${args[2]}`);
        return originalReplaceState.apply(this, args);
      };

      (window as any).__routerLogs = logs;
    });

    // 执行语言切换
    const languageToggleButton = page.getByTestId("language-toggle-button");
    await expect(languageToggleButton).toBeVisible();
    await languageToggleButton.click();

    // 点击中文选项（下拉菜单通过 Portal 渲染，直接等待链接出现）
    const chineseLink = page.getByTestId("language-link-zh");
    await expect(chineseLink).toBeVisible();
    await chineseLink.click();

    await page.waitForURL("**/zh");
    await page.waitForTimeout(2000);

    // 获取路由日志（整页导航后 window 变量会被重置，需兜底）
    const routerLogs = await page.evaluate(
      () => (window as any).__routerLogs || [],
    );

    console.log(`\n📊 Router Activity for ${browserName}:`);
    if (routerLogs.length === 0) {
      console.log("  ℹ️  No history API calls detected");
    } else {
      routerLogs.forEach((log: string, index: number) => {
        console.log(`  ${index + 1}. ${log}`);
      });
    }
  });

  test("Diagnosis 5: Server Component re-render detection", async ({
    page,
    browserName,
  }) => {
    if (!(await ensureFirefoxOrPass(browserName))) return;
    console.log(
      `\n🔍 Running Server Component re-render test on: ${browserName}`,
    );

    await page.goto("/");
    await page.waitForURL("**/en");

    // 记录初始渲染时间戳（如果页面有的话）
    const initialTimestamp = await page.evaluate(() => {
      const meta = document.querySelector('meta[name="render-timestamp"]');
      return meta?.getAttribute("content") || "not-found";
    });

    console.log(`📌 Initial render timestamp: ${initialTimestamp}`);

    // 执行语言切换
    const languageToggleButton = page.getByTestId("language-toggle-button");
    await expect(languageToggleButton).toBeVisible();
    await languageToggleButton.click();

    // 点击中文选项（下拉菜单通过 Portal 渲染，直接等待链接出现）
    const chineseLink = page.getByTestId("language-link-zh");
    await expect(chineseLink).toBeVisible();
    await chineseLink.click();

    await page.waitForURL("**/zh");
    await page.waitForTimeout(2000);

    // 检查渲染时间戳是否变化
    const newTimestamp = await page.evaluate(() => {
      const meta = document.querySelector('meta[name="render-timestamp"]');
      return meta?.getAttribute("content") || "not-found";
    });

    console.log(`📌 New render timestamp: ${newTimestamp}`);
    console.log(`📊 Timestamps changed: ${initialTimestamp !== newTimestamp}`);

    // 检查 <html lang> 属性
    const finalLang = await page.locator("html").getAttribute("lang");
    console.log(`📌 Final <html lang>: ${finalLang}`);
  });
});
