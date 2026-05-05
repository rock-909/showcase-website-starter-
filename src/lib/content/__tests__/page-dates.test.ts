import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCanonicalPath } from "@/config/paths/utils";
import {
  SINGLE_SITE_PUBLIC_STATIC_PAGE_ROUTES,
  SINGLE_SITE_PUBLIC_STATIC_PAGES,
} from "@/config/single-site-seo";
import {
  getMdxPageLastModified,
  isMdxDrivenPage,
} from "@/lib/content/page-dates";

const { mockGetPageBySlug, mockLoggerWarn } = vi.hoisted(() => ({
  mockGetPageBySlug: vi.fn(),
  mockLoggerWarn: vi.fn(),
}));

vi.mock("@/lib/content", () => ({
  getPageBySlug: mockGetPageBySlug,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: mockLoggerWarn,
  },
}));

describe("page-dates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps sitemap MDX page detection aligned with public static routes", () => {
    const nonMdxPages = new Set([
      "",
      getCanonicalPath("capabilities"),
      getCanonicalPath("howItWorks"),
      getCanonicalPath("products"),
    ]);
    const representativePageContracts = [
      { path: "", isMdx: false },
      { path: "/capabilities", isMdx: false },
      { path: "/how-it-works", isMdx: false },
      { path: "/products", isMdx: false },
      { path: "/about", isMdx: true },
      { path: "/custom-project-support", isMdx: true },
    ] as const;

    for (const pagePath of SINGLE_SITE_PUBLIC_STATIC_PAGES) {
      expect(isMdxDrivenPage(pagePath)).toBe(!nonMdxPages.has(pagePath));
    }

    for (const { path, isMdx } of representativePageContracts) {
      expect(isMdxDrivenPage(path)).toBe(isMdx);
    }

    expect(SINGLE_SITE_PUBLIC_STATIC_PAGE_ROUTES).toContain("customProject");
    expect(isMdxDrivenPage(getCanonicalPath("customProject"))).toBe(true);
  });

  it("loads the latest MDX updatedAt across locales for route-derived paths", async () => {
    mockGetPageBySlug.mockImplementation(
      async (slug: string, locale: string) => ({
        metadata: {
          publishedAt: "2026-01-01T00:00:00Z",
          updatedAt:
            locale === "zh"
              ? "2026-04-20T00:00:00Z"
              : "2026-04-01T00:00:00Z",
        },
        slug,
      }),
    );

    const lastModified = await getMdxPageLastModified(
      getCanonicalPath("about"),
    );

    expect(lastModified).toEqual(new Date("2026-04-20T00:00:00Z"));
    expect(mockGetPageBySlug).toHaveBeenCalledWith("about", "en");
    expect(mockGetPageBySlug).toHaveBeenCalledWith("about", "zh");
  });

  it("rejects paths that are not mapped from a static route id", async () => {
    await expect(getMdxPageLastModified("/unknown")).rejects.toThrow(
      "No MDX slug mapping for path: /unknown",
    );
  });
});
