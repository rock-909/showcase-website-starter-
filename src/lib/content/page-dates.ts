import { getMdxPageSlugByStaticPath } from "@/config/pages.config";
import type { Locale } from "@/types/content.types";
import { routing } from "@/i18n/routing";
import { getPageBySlug } from "@/lib/content-query/queries";
import { logger } from "@/lib/logger";

const MDX_PAGE_SLUGS: Record<string, string> = getMdxPageSlugByStaticPath();

export function isMdxDrivenPage(path: string): boolean {
  return path in MDX_PAGE_SLUGS;
}

export async function getMdxPageLastModified(path: string): Promise<Date> {
  const slug = MDX_PAGE_SLUGS[path];
  if (slug === undefined) {
    throw new Error(`No MDX slug mapping for path: ${path}`);
  }

  const results = await Promise.all(
    routing.locales.map(async (locale) => {
      try {
        const page = await getPageBySlug(slug, locale as Locale);
        const dateStr = page.metadata.updatedAt ?? page.metadata.publishedAt;
        return new Date(dateStr);
      } catch (error) {
        logger.warn("MDX page missing for locale", { slug, locale, error });
        return new Date(0);
      }
    }),
  );

  const latest = results.reduce((a, b) => (a > b ? a : b), new Date(0));

  if (latest.getTime() === 0) {
    throw new Error(`No content found for slug: ${slug}`);
  }

  return latest;
}
