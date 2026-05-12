import type { Metadata } from "next";
import { SITE_CONFIG, type Locale, type PageType } from "@/config/paths";
import { siteFacts } from "@/config/site-facts";
import { ONE } from "@/constants";
import { routing } from "@/i18n/routing-config";
import { getRuntimeEnvString } from "@/lib/env";
import { hasOwn } from "@/lib/security/object-guards";
import {
  generateCanonicalURL,
  generateLanguageAlternates,
} from "@/lib/seo/url-generator";

// 重新导出类型以保持向后兼容
export type { Locale, PageType } from "@/config/paths";

interface SEOConfig {
  title?: string;
  description?: string;
  keywords?: string[];
  image?: string;
  type?: "website" | "article" | "product";
  publishedTime?: string;
  modifiedTime?: string;
  authors?: string[];
  section?: string;
}

const FALLBACK_LOCALE: Locale = "en";

function resolveLocale(locale: Locale): Locale {
  return locale === "zh" ? "zh" : FALLBACK_LOCALE;
}

/** Replace ICU-style {placeholders} with siteFacts values in SEO strings. */
const SEO_INTERPOLATION_MAP: Record<string, string | number> = {
  established: siteFacts.company.established,
  countries: siteFacts.stats.exportCountries,
  employees: siteFacts.company.employees,
};

function interpolateSeoString(text: string): string {
  return text.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = SEO_INTERPOLATION_MAP[key];
    return value !== undefined ? String(value) : match;
  });
}

function normalizePath(path: string): string {
  const trimmed = path.trim();
  if (trimmed === "" || trimmed === "/") {
    return "";
  }
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function buildCanonicalForPath(locale: Locale, path: string): string {
  const safeLocale = resolveLocale(locale);
  const normalizedPath = normalizePath(path);
  return new URL(
    `/${safeLocale}${normalizedPath}`,
    SITE_CONFIG.baseUrl,
  ).toString();
}

function buildLanguagesForPath(path: string): Record<string, string> {
  const normalizedPath = normalizePath(path);

  const entries: Array<[string, string]> = routing.locales.map((locale) => [
    locale,
    new URL(`/${locale}${normalizedPath}`, SITE_CONFIG.baseUrl).toString(),
  ]);
  entries.push([
    "x-default",
    new URL(
      `/${routing.defaultLocale}${normalizedPath}`,
      SITE_CONFIG.baseUrl,
    ).toString(),
  ]);

  return Object.fromEntries(entries);
}

/**
 * Apply base fields to merged config
 */
function applyBaseFields(target: SEOConfig, base: SEOConfig): void {
  if (base.type !== undefined) target.type = base.type;
  if (base.keywords !== undefined) target.keywords = base.keywords;
  if (base.image !== undefined) target.image = base.image;
}

/**
 * Apply custom fields to merged config
 */
function applyCustomFields(
  target: SEOConfig,
  custom: Partial<SEOConfig>,
): void {
  if (custom.type !== undefined) target.type = custom.type;
  if (custom.keywords !== undefined) target.keywords = custom.keywords;
  if (custom.image !== undefined) target.image = custom.image;
  if (custom.title !== undefined) target.title = custom.title;
  if (custom.description !== undefined) target.description = custom.description;
  if (custom.publishedTime !== undefined)
    target.publishedTime = custom.publishedTime;
  if (custom.modifiedTime !== undefined)
    target.modifiedTime = custom.modifiedTime;
  if (custom.authors !== undefined) target.authors = custom.authors;
  if (custom.section !== undefined) target.section = custom.section;
}

function mergeSEOConfig(
  baseConfig: SEOConfig,
  customConfig?: Partial<SEOConfig> | null,
): SEOConfig {
  const mergedConfig: SEOConfig = {};

  applyBaseFields(mergedConfig, baseConfig);

  if (customConfig === null || customConfig === undefined) {
    return mergedConfig;
  }

  applyCustomFields(mergedConfig, customConfig);

  return mergedConfig;
}

export function generateLocalizedMetadata(
  locale: Locale,
  pageType: PageType,
  config: SEOConfig = {},
): Metadata {
  const safeLocale = resolveLocale(locale);
  const title =
    config.title !== undefined && config.title.trim().length > 0
      ? interpolateSeoString(config.title)
      : SITE_CONFIG.seo.defaultTitle;
  const description =
    config.description !== undefined && config.description.trim().length > 0
      ? interpolateSeoString(config.description)
      : SITE_CONFIG.seo.defaultDescription;
  const siteName = SITE_CONFIG.name;

  const metadata: Metadata = {
    title,
    description,
    keywords: config.keywords ?? SITE_CONFIG.seo.keywords,

    // Open Graph本地化
    openGraph: {
      title,
      description,
      siteName,
      locale: safeLocale,
      type: (config.type === "product" ? "website" : config.type) || "website",
      images: config.image ? [{ url: config.image }] : undefined,
      publishedTime: config.publishedTime,
      modifiedTime: config.modifiedTime,
      authors: config.authors,
      section: config.section,
    },

    // Twitter Card
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: config.image ? [config.image] : undefined,
    },

    // hreflang和canonical链接
    alternates: {
      canonical: generateCanonicalURL(pageType, safeLocale),
      languages: generateLanguageAlternates(pageType),
    },

    // 其他元数据
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -ONE,
        "max-image-preview": "large",
        "max-snippet": -ONE,
      },
    },

    // 验证标签
    verification: {
      google: getRuntimeEnvString("GOOGLE_SITE_VERIFICATION"),
      yandex: getRuntimeEnvString("YANDEX_VERIFICATION"),
    },
  };

  return metadata;
}

/**
 * Generate path-aware metadata for App Router pages.
 *
 * Next.js metadata uses shallow merges: if a page does not explicitly return
 * `alternates` or `openGraph.url`, it may inherit those fields from a parent layout.
 * This helper ensures canonical/hreflang and OG URL are always derived from the
 * actual route path.
 */
interface GenerateMetadataForPathParams {
  locale: Locale;
  pageType: PageType;
  path: string;
  config?: Partial<SEOConfig>;
}

export function generateMetadataForPath(
  params: GenerateMetadataForPathParams,
): Metadata {
  const { locale, pageType, path, config } = params;

  const seoConfig = createPageSEOConfig(pageType, config ?? {});
  const metadata = generateLocalizedMetadata(locale, pageType, seoConfig);

  const canonical = buildCanonicalForPath(locale, path);
  const languages = buildLanguagesForPath(path);

  metadata.alternates = {
    canonical,
    languages,
  };

  const { openGraph } = metadata;
  if (openGraph && typeof openGraph === "object") {
    (openGraph as { url?: string | URL }).url = canonical;
    metadata.openGraph = openGraph;
  } else {
    metadata.openGraph = {
      url: canonical,
    } as unknown as Metadata["openGraph"];
  }

  return metadata;
}

/**
 * 生成页面特定的SEO配置
 */
export function createPageSEOConfig(
  pageType: PageType,
  customConfig: Partial<SEOConfig> = {},
): SEOConfig {
  const baseConfigs: Record<PageType, SEOConfig> = {
    home: {
      type: "website" as const,
      keywords: [...SITE_CONFIG.seo.keywords, "B2B Solution"],
      image: "/images/og-image.jpg",
    },
    about: {
      type: "website" as const,
      keywords: ["About", "Company", "Team", "Enterprise"],
    },
    capabilities: {
      type: "website" as const,
      keywords: ["Capabilities", "Website Starter", "Lead Foundation", "B2B"],
    },
    contact: {
      type: "website" as const,
      keywords: ["Contact", "Support", "Business"],
    },
    howItWorks: {
      type: "website" as const,
      keywords: ["How It Works", "Setup", "Launch", "Website Starter"],
    },
    products: {
      type: "website" as const,
      keywords: ["Products", "Solutions", "Enterprise", "B2B"],
    },
    blog: {
      type: "website" as const,
      keywords: ["Blog", "Launch Guide", "Website Starter", "Cloudflare"],
    },
    privacy: {
      type: "website" as const,
      keywords: ["Privacy", "Policy", "Data Protection"],
    },
    terms: {
      type: "website" as const,
      keywords: ["Terms", "Conditions", "Legal"],
    },
    customProject: {
      type: "website" as const,
      keywords: [
        "Custom Project",
        "Website Starter",
        "Brand Adaptation",
        "Implementation Support",
      ],
    },
  };

  const baseConfig =
    (hasOwn(baseConfigs, pageType) ? baseConfigs[pageType] : undefined) ??
    baseConfigs.home;

  return mergeSEOConfig(baseConfig, customConfig);
}
