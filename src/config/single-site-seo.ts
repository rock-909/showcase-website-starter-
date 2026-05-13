import type { PageType } from "@/config/paths/types";
import { getCanonicalPath, getProductMarketPath } from "@/config/paths/utils";
import { getAllMarketSlugs } from "@/constants/product-catalog";
import { getMarketSpecsBySlug } from "@/constants/product-specs/market-spec-registry";

type SingleSiteSitemapChangeFrequency =
  | "always"
  | "hourly"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"
  | "never";

/**
 * Canonical public-static SEO inputs for the current single-site baseline.
 *
 * Split of responsibility:
 * - `single-site.ts`: brand/contact/default SEO identity
 * - `single-site-page-expression.ts`: reusable page-expression inputs
 * - `single-site-seo.ts`: sitemap / robots / public static page SEO defaults
 */

export interface SingleSiteSitemapPageConfig {
  changeFrequency: SingleSiteSitemapChangeFrequency;
  priority: number;
}

const SINGLE_SITE_STATIC_LASTMOD_ISO = "2026-04-26T00:00:00Z";

function toSitemapStaticPath(path: string): string {
  return path === "/" ? "" : path;
}

function fromRouteConfig<T>(
  configByPageType: Partial<Record<PageType, T>>,
): Record<string, T> {
  return Object.fromEntries(
    (Object.entries(configByPageType) as Array<[PageType, T]>).map(
      ([pageType, config]) => [
        toSitemapStaticPath(getCanonicalPath(pageType)),
        config,
      ],
    ),
  );
}

export const SINGLE_SITE_PUBLIC_STATIC_PAGE_ROUTES = [
  "home",
  "about",
  "products",
  "blog",
  "contact",
  "privacy",
  "terms",
  "capabilities",
  "howItWorks",
  "customProject",
] as const satisfies readonly PageType[];

export const SINGLE_SITE_PUBLIC_STATIC_PAGES =
  SINGLE_SITE_PUBLIC_STATIC_PAGE_ROUTES.map((pageType) =>
    toSitemapStaticPath(getCanonicalPath(pageType)),
  );

const SINGLE_SITE_STATIC_SITEMAP_PAGE_CONFIG_BY_ROUTE = {
  home: { changeFrequency: "daily", priority: 1.0 },
  about: { changeFrequency: "monthly", priority: 0.8 },
  capabilities: { changeFrequency: "monthly", priority: 0.85 },
  contact: { changeFrequency: "monthly", priority: 0.8 },
  howItWorks: { changeFrequency: "monthly", priority: 0.85 },
  products: { changeFrequency: "weekly", priority: 0.9 },
  blog: { changeFrequency: "weekly", priority: 0.85 },
  privacy: { changeFrequency: "monthly", priority: 0.7 },
  terms: { changeFrequency: "monthly", priority: 0.7 },
  customProject: { changeFrequency: "monthly", priority: 0.8 },
} as const satisfies Record<PageType, SingleSiteSitemapPageConfig>;

export const SINGLE_SITE_SITEMAP_PAGE_CONFIG: Readonly<
  Record<string, SingleSiteSitemapPageConfig>
> = {
  ...fromRouteConfig<SingleSiteSitemapPageConfig>(
    SINGLE_SITE_STATIC_SITEMAP_PAGE_CONFIG_BY_ROUTE,
  ),
  productMarket: { changeFrequency: "weekly", priority: 0.8 },
} as const;

export const SINGLE_SITE_SITEMAP_DEFAULT_CONFIG = {
  changeFrequency: "weekly",
  priority: 0.5,
} as const satisfies SingleSiteSitemapPageConfig;

const SINGLE_SITE_STATIC_PAGE_LASTMOD_BY_ROUTE = {
  // Non-MDX routes and product market pages use this sidecar date source.
  // MDX-driven pages read updatedAt from content/pages/{locale}/*.mdx.
  home: SINGLE_SITE_STATIC_LASTMOD_ISO,
  products: SINGLE_SITE_STATIC_LASTMOD_ISO,
  blog: SINGLE_SITE_STATIC_LASTMOD_ISO,
} as const satisfies Partial<Record<PageType, string>>;

const SINGLE_SITE_PRODUCT_MARKET_LASTMOD: Record<string, string> =
  Object.fromEntries(
    getAllMarketSlugs().map((marketSlug) => [
      getProductMarketPath(marketSlug),
      getMarketSpecsBySlug(marketSlug)?.updatedAt ??
        SINGLE_SITE_STATIC_LASTMOD_ISO,
    ]),
  );

export const SINGLE_SITE_STATIC_PAGE_LASTMOD = {
  ...fromRouteConfig(SINGLE_SITE_STATIC_PAGE_LASTMOD_BY_ROUTE),
  ...SINGLE_SITE_PRODUCT_MARKET_LASTMOD,
} as const satisfies Record<string, string>;

export const SINGLE_SITE_ROBOTS_DISALLOW_PATHS = [
  "/api/",
  "/_next/",
  "/ops/",
  "/error-test/",
] as const;

export function getSingleSiteSitemapPageConfig(
  path: string,
): SingleSiteSitemapPageConfig {
  return (
    SINGLE_SITE_SITEMAP_PAGE_CONFIG[path] ?? SINGLE_SITE_SITEMAP_DEFAULT_CONFIG
  );
}
