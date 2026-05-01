import { getTranslations } from "next-intl/server";
import { Link, routing } from "@/i18n/routing";
import { JsonLdScript } from "@/components/seo";
import { SITE_CONFIG } from "@/config/paths";
import { getCanonicalPath, getProductMarketPath } from "@/config/paths/utils";
import type { MarketDefinition } from "@/constants/product-catalog";
import { buildBreadcrumbListSchema } from "@/lib/structured-data-generators";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

interface CatalogBreadcrumbProps {
  market?: MarketDefinition;
  marketLabel?: string;
  renderJsonLd?: boolean;
}

export async function buildCatalogBreadcrumbJsonLd({
  market,
  marketLabel,
}: CatalogBreadcrumbProps) {
  const { baseUrl } = SITE_CONFIG;
  const tBreadcrumb = await getTranslations("catalog.breadcrumb");

  // JSON-LD URLs use default locale for canonical representation
  const canonicalBase = `${baseUrl}/${routing.defaultLocale}`;
  const productsPath = getCanonicalPath("products");

  const entries: Array<{ name: string; url: string }> = [
    { name: tBreadcrumb("home"), url: canonicalBase },
    { name: tBreadcrumb("products"), url: `${canonicalBase}${productsPath}` },
  ];

  if (market) {
    entries.push({
      name: marketLabel || market.label,
      url: `${canonicalBase}${getProductMarketPath(market.slug)}`,
    });
  }

  return buildBreadcrumbListSchema(entries);
}

export async function CatalogBreadcrumb({
  market,
  marketLabel,
  renderJsonLd = true,
}: CatalogBreadcrumbProps) {
  const tBreadcrumb = await getTranslations("catalog.breadcrumb");
  const productsPath = getCanonicalPath("products");

  return (
    <>
      <Breadcrumb>
        <BreadcrumbList>
          {/* Home */}
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/">{tBreadcrumb("home")}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />

          {/* Products */}
          <BreadcrumbItem>
            {market ? (
              <BreadcrumbLink asChild>
                <Link href={productsPath}>{tBreadcrumb("products")}</Link>
              </BreadcrumbLink>
            ) : (
              <BreadcrumbPage>{tBreadcrumb("products")}</BreadcrumbPage>
            )}
          </BreadcrumbItem>

          {/* Market */}
          {market && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{marketLabel || market.label}</BreadcrumbPage>
              </BreadcrumbItem>
            </>
          )}
        </BreadcrumbList>
      </Breadcrumb>

      {renderJsonLd ? (
        <JsonLdScript
          data={await buildCatalogBreadcrumbJsonLd(
            market ? { market, ...(marketLabel ? { marketLabel } : {}) } : {},
          )}
        />
      ) : null}
    </>
  );
}
