/**
 * 内容查询函数
 */

import { cache } from "react";
import path from "path";
import { isRuntimeCloudflare } from "@/lib/env";
import type {
  ContentMetadata,
  ContentType,
  Locale,
  Page,
  PageMetadata,
  ParsedContent,
} from "@/types/content.types";
import { getContentFiles, parseContentFile } from "@/lib/content-parser";
import { getContentConfig, PAGES_DIR } from "@/lib/content-utils";

type ContentLoader<T> = (slug: string, locale?: Locale) => Promise<T>;

function cacheOutsideCloudflare<T>(loader: ContentLoader<T>): ContentLoader<T> {
  const cachedLoader = cache(loader);
  return (slug, locale) =>
    isRuntimeCloudflare() ? loader(slug, locale) : cachedLoader(slug, locale);
}

/**
 * Get all pages
 */
export async function getAllPages(locale?: Locale): Promise<Page[]> {
  const files = await getContentFiles(PAGES_DIR, locale);
  const parsedPages = await Promise.all(
    files.map((file) => parseContentFile<PageMetadata>(file, "pages")),
  );
  return parsedPages.filter((page) => {
    // Filter drafts in production
    const config = getContentConfig();
    return config.enableDrafts || !page.metadata.draft;
  }) as Page[];
}

/**
 * Get content by slug
 */
export async function getContentBySlug<
  T extends ContentMetadata = ContentMetadata,
>(slug: string, type: ContentType, locale?: Locale): Promise<ParsedContent<T>> {
  const contentDir = PAGES_DIR;
  const files = await getContentFiles(contentDir, locale);

  const matchingFile = files.find((file) => {
    const fileSlug = path.basename(file, path.extname(file));
    return fileSlug === slug || fileSlug.startsWith(`${slug}.`);
  });

  if (!matchingFile) {
    throw new Error(`Content not found: ${slug}`);
  }

  return parseContentFile<T>(matchingFile, type);
}

/**
 * Get page by slug
 */
export const getPageBySlug = cacheOutsideCloudflare(
  (slug: string, locale?: Locale): Promise<Page> => {
    return getContentBySlug<PageMetadata>(
      slug,
      "pages",
      locale,
    ) as Promise<Page>;
  },
);
