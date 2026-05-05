import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  generateLocaleStaticParams,
  type LocaleParam,
} from "@/app/[locale]/generate-static-params";
import { getLocalizedPath } from "@/config/paths";
import { generateMetadataForPath } from "@/lib/seo-metadata";
import type { Locale } from "@/types/content.types";

const CAPABILITY_COUNT = 6;

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
  const t = await getTranslations({ locale, namespace: "capabilities" });

  return generateMetadataForPath({
    locale: typedLocale,
    pageType: "capabilities",
    path: getLocalizedPath("capabilities", typedLocale),
    config: {
      title: t("title"),
      description: t("description"),
    },
  });
}

export default async function CapabilitiesPage({
  params,
}: CapabilitiesPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "capabilities" });

  const items = Array.from({ length: CAPABILITY_COUNT }, (_, index) => ({
    title: t(`items.${index}.title`),
    description: t(`items.${index}.description`),
  }));

  return (
    <main className="mx-auto max-w-[1080px] px-6 py-16">
      <p className="text-sm font-semibold uppercase tracking-[0.04em] text-primary">
        {t("eyebrow")}
      </p>
      <h1 className="mt-3 text-4xl font-bold tracking-[-0.03em]">
        {t("title")}
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
        {t("description")}
      </p>

      <ul className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
        {items.map((item) => (
          <li key={item.title} className="rounded-xl border p-5">
            <h2 className="text-lg font-semibold">{item.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {item.description}
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}
