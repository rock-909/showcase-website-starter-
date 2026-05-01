/**
 * 内容统计函数
 */

import type { ContentStats, Locale } from "@/types/content.types";
import { getAllPages } from "@/lib/content-query/queries";
import { getContentConfig } from "@/lib/content-utils";
import { ZERO } from "@/constants";

/**
 * Get content statistics
 */
export async function getContentStats(): Promise<ContentStats> {
  const config = getContentConfig();
  const stats: ContentStats = {
    totalPosts: ZERO,
    totalPages: ZERO,
    postsByLocale: {} as Record<Locale, number>,
    pagesByLocale: {} as Record<Locale, number>,
    totalTags: ZERO,
    totalCategories: ZERO,
    lastUpdated: new Date().toISOString(),
  };

  // Count active page content by locale.
  for (const locale of config.supportedLocales) {
    const pages = await getAllPages(locale);

    // Use type-safe property access with explicit validation
    if (locale === "en" || locale === "zh") {
      // Safe property assignment for known locales
      if (locale === "en") {
        stats.postsByLocale.en = ZERO;
        stats.pagesByLocale.en = pages.length;
      } else {
        stats.postsByLocale.zh = ZERO;
        stats.pagesByLocale.zh = pages.length;
      }
    }
    stats.totalPages += pages.length;
  }

  return stats;
}
