/**
 * Product catalog compatibility wrapper.
 *
 * During the single-site cutover, routes and sitemap generation should read the
 * canonical single-site catalog through the single-site source instead of
 * inventing a second product-truth layer in consumers.
 */

import {
  SINGLE_SITE_PRODUCT_CATALOG,
  type MarketDefinition,
  type ProductCatalog,
  type ProductFamilyDefinition,
} from "@/config/single-site";

export type {
  MarketDefinition,
  ProductCatalog,
  ProductFamilyDefinition,
} from "@/config/single-site";

export const PRODUCT_CATALOG: ProductCatalog = SINGLE_SITE_PRODUCT_CATALOG;

/** Get a market definition by its URL slug */
export function getMarketBySlug(slug: string): MarketDefinition | undefined {
  return PRODUCT_CATALOG.markets.find((market) => market.slug === slug);
}

/** Get all product families for a given market slug */
export function getFamiliesForMarket(
  marketSlug: string,
): readonly ProductFamilyDefinition[] {
  return PRODUCT_CATALOG.families.filter(
    (family) => family.marketSlug === marketSlug,
  );
}

/** Get a specific family by market + family slug combination */
export function getFamilyBySlug(
  marketSlug: string,
  familySlug: string,
): ProductFamilyDefinition | undefined {
  return PRODUCT_CATALOG.families.find(
    (family) => family.marketSlug === marketSlug && family.slug === familySlug,
  );
}

/** Check if a market slug is valid */
export function isValidMarketSlug(slug: string): boolean {
  return PRODUCT_CATALOG.markets.some((market) => market.slug === slug);
}

/** Check if a market + family combination is valid */
export function isValidMarketFamilyCombo(
  marketSlug: string,
  familySlug: string,
): boolean {
  return PRODUCT_CATALOG.families.some(
    (family) => family.marketSlug === marketSlug && family.slug === familySlug,
  );
}

/** Return all market slugs for static generation */
export function getAllMarketSlugs(): readonly string[] {
  return PRODUCT_CATALOG.markets.map((market) => market.slug);
}

/** Return all valid market + family pairs for static generation */
export function getAllMarketFamilyCombos(): ReadonlyArray<{
  market: string;
  family: string;
}> {
  return PRODUCT_CATALOG.families.map((family) => ({
    market: family.marketSlug,
    family: family.slug,
  }));
}
