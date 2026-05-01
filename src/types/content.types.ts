/**
 * Content Management System Types
 *
 * This file defines TypeScript interfaces for the MDX content management system,
 * ensuring type safety across the application.
 */

import type { ProductStandardId } from "@/constants/product-standards";
import type { Locale } from "@/i18n/routing-config";

// Base content metadata interface
export interface ContentMetadata {
  title: string;
  description?: string;
  slug: string;
  publishedAt: string;
  updatedAt?: string;
  author?: string;
  tags?: string[];
  categories?: string[];
  featured?: boolean;
  draft?: boolean;
  seo?: {
    title?: string;
    description?: string;
    keywords?: string[];
    ogImage?: string;
  };
}

// Page specific metadata
export interface PageMetadata extends ContentMetadata {
  layout?: "default" | "landing" | "docs" | "legal";
  showToc?: boolean;
  lastReviewed?: string;
  faq?: FaqItem[];
  heroTitle?: string;
  heroSubtitle?: string;
  heroDescription?: string;
  aboutSections?: AboutPageSections;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface AboutPageSections {
  valuesTitle: string;
  values: Record<string, { title: string; description: string }>;
  statLabels: Record<string, string>;
  cta: {
    title: string;
    description: string;
    button: string;
  };
}

export interface LegalPageMetadata extends PageMetadata {
  layout: "legal";
  showToc: true;
  lastReviewed: string;
}

// Content with parsed frontmatter and content
export interface ParsedContent<T extends ContentMetadata = ContentMetadata> {
  metadata: T;
  content: string;
  excerpt?: string;
  slug: string;
  filePath: string;
}

// Page content
export interface Page extends ParsedContent<PageMetadata> {
  metadata: PageMetadata;
}

// Product specific metadata (for MDX frontmatter)
export interface ProductMetadata extends ContentMetadata {
  coverImage: string;
  images?: string[];
  category: string;
  standards?: ProductStandardId[];
  pdfUrl?: string;
  moq?: string;
  leadTime?: string;
  supplyCapacity?: string;
  specs?: Record<string, string>;
  certifications?: string[];
  packaging?: string;
  portOfLoading?: string;
  relatedProducts?: string[];
}

// Product content
export interface Product extends ParsedContent<ProductMetadata> {
  metadata: ProductMetadata;
}

// Content collection types
export type ContentType = "posts" | "pages" | "products";
export type _ContentType = ContentType;
export type { Locale };

/**
 * Summary view of a product for listing and overview sections.
 *
 * Designed for B2B/foreign trade scenarios with common fields that most
 * industries need. Additional fields can be added via the `specs` record.
 */
export interface ProductSummary {
  slug: string;
  locale: Locale;
  title: string;
  description?: string;
  coverImage: string;
  images?: string[];
  category: string;
  standards?: ProductStandardId[];
  pdfUrl?: string;
  categories?: string[];
  tags?: string[];
  featured?: boolean;

  // Timestamps for SEO (sitemap lastmod)
  publishedAt: string;
  updatedAt?: string;

  // Foreign trade common fields (optional)
  moq?: string; // Minimum Order Quantity, e.g. "100 pieces"
  leadTime?: string; // Delivery time, e.g. "15-30 days"
  supplyCapacity?: string; // e.g. "10000 pieces/month"

  seo?: {
    title?: string;
    description?: string;
    keywords?: string[];
    ogImage?: string;
  };
}

/**
 * Detail view of a product for dedicated product pages.
 *
 * Includes full content and extensible specs for industry-specific attributes.
 */
export interface ProductDetail extends ProductSummary {
  content: string;
  filePath: string;

  // Extensible key-value specs for industry-specific attributes
  specs?: Record<string, string>;

  // Certifications like ISO, CE, etc.
  certifications?: string[];

  // Packaging and shipping info
  packaging?: string;
  portOfLoading?: string;

  // Related products by slug
  relatedProducts?: string[];
}

/**
 * Options for product listing queries.
 */
export interface ProductListOptions {
  limit?: number;
  offset?: number;
  category?: string;
  tags?: string[];
  standards?: ProductStandardId[];
  featured?: boolean;
}

/**
 * Cache-friendly wrapper signatures for products.
 */
export type GetAllProductsCachedFn = (
  locale: Locale,
  options?: ProductListOptions,
) => Promise<ProductSummary[]>;

export type GetProductBySlugCachedFn = (
  locale: Locale,
  slug: string,
) => Promise<ProductDetail>;

export type GetProductCategoriesCachedFn = (
  locale: Locale,
) => Promise<string[]>;

export type GetProductStandardsCachedFn = (
  locale: Locale,
) => Promise<ProductStandardId[]>;

/**
 * High-level cache-friendly wrapper signatures designed in P2-1.
 *
 * These functions are intentionally designed to:
 * - accept only explicit, serializable parameters
 * - avoid any request-scoped APIs (cookies, headers, etc.)
 * - be compatible with future explicit cache boundaries if they are reintroduced
 */
export type GetProductListingCachedFn = (
  locale: Locale,
  category: string,
) => Promise<ProductSummary[]>;

export type GetProductDetailCachedFn = (
  locale: Locale,
  slug: string,
) => Promise<ProductDetail>;

// Content validation result
export interface ContentValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Content search result
export interface ContentSearchResult<
  T extends ContentMetadata = ContentMetadata,
> {
  content: ParsedContent<T>;
  score: number;
  highlights: string[];
}

// Global content configuration
export interface ContentConfig {
  defaultLocale: Locale;
  supportedLocales: Locale[];
  postsPerPage: number;
  enableDrafts: boolean;
  enableSearch: boolean;
  autoGenerateExcerpt: boolean;
  excerptLength: number;
  dateFormat: string;
  timeZone: string;
  enableComments: boolean;
}

// Content statistics
export interface ContentStats {
  totalPosts: number;
  totalPages: number;
  postsByLocale: Record<Locale, number>;
  pagesByLocale: Record<Locale, number>;
  totalTags: number;
  totalCategories: number;
  lastUpdated: string;
}

// Content cache entry
export interface ContentCacheEntry<
  T extends ContentMetadata = ContentMetadata,
> {
  content: ParsedContent<T>;
  cachedAt: string;
  expiresAt: string;
}

// Content index for search
export interface ContentIndex {
  id: string;
  title: string;
  content: string;
  tags: string[];
  categories: string[];
  locale: Locale;
  type: ContentType;
  publishedAt: string;
}

// Error types for content operations
export class ContentError extends Error {
  constructor(
    message: string,
    public _code: string,
    public _filePath?: string,
  ) {
    super(message);
    this.name = "ContentError";
  }
}

export class ContentValidationError extends ContentError {
  constructor(
    message: string,
    public _validationErrors: string[],
    filePath?: string,
  ) {
    super(message, "VALIDATION_ERROR", filePath);
    this.name = "ContentValidationError";
  }
}

export class ContentNotFoundError extends ContentError {
  constructor(slug: string, locale?: Locale) {
    super(
      `Content not found: ${slug}${locale ? ` (locale: ${locale})` : ""}`,
      "NOT_FOUND",
    );
    this.name = "ContentNotFoundError";
  }
}
