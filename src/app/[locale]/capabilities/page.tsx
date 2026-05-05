import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import {
  generateLocaleStaticParams,
  type LocaleParam,
} from "@/app/[locale]/generate-static-params";
import { getLocalizedPath } from "@/config/paths";
import { renderLegalContent } from "@/lib/content/render-legal-content";
import { getPageBySlug } from "@/lib/content";
import { generateMetadataForPath } from "@/lib/seo-metadata";
import type { Locale } from "@/types/content.types";

interface CapabilitiesPageProps {
  params: Promise<LocaleParam>;
}

export function generateStaticParams() {
  return generateLocaleStaticParams();
}

export async function generateMetadata({
  params,
}: CapabilitiesPageProps): Promise<Metadata> {
  const { locale } = await params;
  const typedLocale = locale as Locale;
  const page = await getPageBySlug("capabilities", typedLocale);
  const description =
    page.metadata.seo?.description ?? page.metadata.description;
  const image = page.metadata.seo?.ogImage;

  return generateMetadataForPath({
    locale: typedLocale,
    pageType: "capabilities",
    path: getLocalizedPath("capabilities", typedLocale),
    config: {
      title: page.metadata.seo?.title ?? page.metadata.title,
      ...(description ? { description } : {}),
      ...(page.metadata.seo?.keywords
        ? { keywords: page.metadata.seo.keywords }
        : {}),
      ...(image ? { image } : {}),
    },
  });
}

export default async function CapabilitiesPage({
  params,
}: CapabilitiesPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const page = await getPageBySlug("capabilities", locale as Locale);

  return (
    <main className="mx-auto max-w-[1080px] px-6 py-16">
      <h1 className="text-4xl font-bold tracking-[-0.03em]">
        {page.metadata.title}
      </h1>
      {page.metadata.description ? (
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          {page.metadata.description}
        </p>
      ) : null}

      <article className="mt-10 max-w-none">
        {renderLegalContent(page.content)}
      </article>
    </main>
  );
}
