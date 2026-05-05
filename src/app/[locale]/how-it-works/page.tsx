import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  generateLocaleStaticParams,
  type LocaleParam,
} from "@/app/[locale]/generate-static-params";
import { getLocalizedPath } from "@/config/paths";
import { generateMetadataForPath } from "@/lib/seo-metadata";
import type { Locale } from "@/types/content.types";

const STEP_COUNT = 5;

interface HowItWorksPageProps {
  params: Promise<LocaleParam>;
}

export function generateStaticParams() {
  return generateLocaleStaticParams();
}

export async function generateMetadata({
  params,
}: HowItWorksPageProps): Promise<Metadata> {
  const { locale } = await params;
  const typedLocale = locale as Locale;
  const t = await getTranslations({ locale, namespace: "howItWorks" });

  return generateMetadataForPath({
    locale: typedLocale,
    pageType: "howItWorks",
    path: getLocalizedPath("howItWorks", typedLocale),
    config: {
      title: t("title"),
      description: t("description"),
    },
  });
}

export default async function HowItWorksPage({ params }: HowItWorksPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "howItWorks" });

  const steps = Array.from({ length: STEP_COUNT }, (_, index) => ({
    title: t(`steps.${index}.title`),
    description: t(`steps.${index}.description`),
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

      <ol className="mt-10 grid grid-cols-1 gap-4">
        {steps.map((step, index) => (
          <li key={step.title} className="rounded-xl border p-5">
            <p className="text-sm font-semibold text-primary">
              {t("stepLabel", { count: index + 1 })}
            </p>
            <h2 className="mt-2 text-lg font-semibold">{step.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {step.description}
            </p>
          </li>
        ))}
      </ol>
    </main>
  );
}
