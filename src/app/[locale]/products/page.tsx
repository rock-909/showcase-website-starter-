import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  generateMetadataForPath,
  type Locale as SeoLocale,
} from "@/lib/seo-metadata";
import {
  PRODUCT_CATALOG,
  getFamiliesForMarket,
} from "@/constants/product-catalog";
import { SINGLE_SITE_PRODUCTS_PAGE_EXPRESSION } from "@/config/single-site-page-expression";
import { getLocalizedPath } from "@/config/paths";
import {
  CatalogBreadcrumb,
  buildCatalogBreadcrumbJsonLd,
} from "@/components/products/catalog-breadcrumb";
import { JsonLdGraphScript } from "@/components/seo";
import { MarketSeriesCard } from "@/components/products/market-series-card";
import { generateLocaleStaticParams } from "@/app/[locale]/generate-static-params";

export function generateStaticParams() {
  return generateLocaleStaticParams();
}

interface ProductsPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: ProductsPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "catalog" });

  return generateMetadataForPath({
    locale: locale as SeoLocale,
    pageType: "products",
    path: getLocalizedPath("products", locale as SeoLocale),
    config: {
      title: t("overview.title"),
      description: t("overview.description"),
    },
  });
}

export default async function ProductsPage({ params }: ProductsPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "catalog" });
  const breadcrumbSchema = await buildCatalogBreadcrumbJsonLd({});

  const industrialMarkets = PRODUCT_CATALOG.markets.filter((market) =>
    SINGLE_SITE_PRODUCTS_PAGE_EXPRESSION.standardMarketSlugs.includes(
      market.slug,
    ),
  );
  const specialtyMarket = PRODUCT_CATALOG.markets.find(
    (market) =>
      market.slug === SINGLE_SITE_PRODUCTS_PAGE_EXPRESSION.specialtyMarketSlug,
  );

  return (
    <div className="mx-auto max-w-[1080px] px-6 py-8 md:py-12">
      <JsonLdGraphScript
        locale={locale as SeoLocale}
        data={[breadcrumbSchema]}
      />
      <CatalogBreadcrumb renderJsonLd={false} />

      <header className="mb-8 md:mb-12">
        <h1 className="text-heading mb-4">{t("overview.title")}</h1>
        <p className="text-body max-w-2xl text-muted-foreground">
          {t("overview.description")}
        </p>
      </header>

      {/* Section 1: By Market Standard */}
      <section className="mb-16">
        <h2 className="mb-6 text-xl font-semibold">
          {t("overview.byStandard")}
        </h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {industrialMarkets.map((market) => {
            const count = getFamiliesForMarket(market.slug).length;
            return (
              <MarketSeriesCard
                key={market.slug}
                slug={market.slug}
                label={t(`markets.${market.slug}.label`)}
                description={t(`markets.${market.slug}.description`)}
                standardLabel={market.standardLabel}
                familyCountLabel={t("familyCount", { count })}
              />
            );
          })}
        </div>
      </section>

      {specialtyMarket && (
        <section>
          <h2 className="mb-6 text-xl font-semibold">
            {t("overview.specialty")}
          </h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <MarketSeriesCard
              slug={specialtyMarket.slug}
              label={t(`markets.${specialtyMarket.slug}.label`)}
              description={t(`markets.${specialtyMarket.slug}.description`)}
              standardLabel={specialtyMarket.standardLabel}
              familyCountLabel={t("familyCount", {
                count: getFamiliesForMarket(specialtyMarket.slug).length,
              })}
            />
          </div>
        </section>
      )}
    </div>
  );
}
