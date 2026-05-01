import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { generateMetadataForPath, type Locale } from "@/lib/seo-metadata";
import { getLocalizedPath } from "@/config/paths";
import { GridFrame } from "@/components/grid";
import { JsonLdGraphScript } from "@/components/seo";
import { HeroSection } from "@/components/sections/hero-section";
import { ChainSection } from "@/components/sections/chain-section";
import { ProductsSection } from "@/components/sections/products-section";
import { ResourcesSection } from "@/components/sections/resources-section";
import { SampleCTA } from "@/components/sections/sample-cta";
import { ScenariosSection } from "@/components/sections/scenarios-section";
import { QualitySection } from "@/components/sections/quality-section";
import { FinalCTA } from "@/components/sections/final-cta";
import {
  generateLocaleStaticParams,
  type LocaleParam,
} from "@/app/[locale]/generate-static-params";
import {
  SINGLE_SITE_HOME_GRID_SECTION_ORDER,
  SINGLE_SITE_HOME_TRAILING_SECTION_ORDER,
  type SingleSiteHomeGridSectionId,
  type SingleSiteHomeTrailingSectionId,
} from "@/config/single-site-page-expression";

export function generateStaticParams() {
  return generateLocaleStaticParams();
}

interface HomePageProps {
  params: Promise<LocaleParam>;
}

function renderHomeGridSection(
  sectionId: SingleSiteHomeGridSectionId,
): ReactNode {
  switch (sectionId) {
    case "hero":
      return <HeroSection key={sectionId} />;
    case "chain":
      return <ChainSection key={sectionId} />;
    case "products":
      return <ProductsSection key={sectionId} />;
    case "resources":
      return <ResourcesSection key={sectionId} />;
    case "sampleCta":
      return <SampleCTA key={sectionId} />;
    case "scenarios":
      return <ScenariosSection key={sectionId} />;
    case "quality":
      return <QualitySection key={sectionId} />;
    default:
      return null;
  }
}

function renderHomeTrailingSection(
  sectionId: SingleSiteHomeTrailingSectionId,
): ReactNode {
  switch (sectionId) {
    case "finalCta":
      return <FinalCTA key={sectionId} />;
    default:
      return null;
  }
}

export async function generateMetadata({
  params,
}: HomePageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home" });

  return generateMetadataForPath({
    locale: locale as Locale,
    pageType: "home",
    path: getLocalizedPath("home", locale as Locale),
    config: {
      description: t("hero.subtitle"),
    },
  });
}

export default async function Home({ params }: HomePageProps) {
  // Await params per Next.js async page convention
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <JsonLdGraphScript locale={locale as Locale} />
      <GridFrame
        crosshairs={[
          { top: 0, left: 0 },
          { bottom: 0, right: 0 },
        ]}
      >
        {SINGLE_SITE_HOME_GRID_SECTION_ORDER.map(renderHomeGridSection)}
      </GridFrame>
      {SINGLE_SITE_HOME_TRAILING_SECTION_ORDER.map(renderHomeTrailingSection)}
    </div>
  );
}
