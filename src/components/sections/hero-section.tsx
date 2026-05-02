import { getTranslations } from "next-intl/server";

import {
  HeroSectionView,
  type HeroSectionContent,
} from "@/components/sections/hero-section-view";
import { SINGLE_SITE_HOME_HERO_PROOF_ITEMS } from "@/config/single-site-page-expression";
import { siteFacts } from "@/config/site-facts";
import { HOMEPAGE_SECTION_LINKS } from "@/components/sections/homepage-section-links";

export async function HeroSection() {
  const t = await getTranslations("home");
  const proofItems = SINGLE_SITE_HOME_HERO_PROOF_ITEMS.map((item) => {
    switch (item) {
      case "est":
        return {
          value: t("hero.proof.est", {
            established: siteFacts.company.established,
          }),
          label: t("hero.proof.estLabel"),
        };
      case "countries":
        return {
          value: t("hero.proof.countries", {
            countries: siteFacts.stats.exportCountries,
          }),
          label: t("hero.proof.countriesLabel"),
        };
      case "range":
        return {
          value: t("hero.proof.range"),
          label: t("hero.proof.rangeLabel"),
        };
      case "production":
        return {
          value: t("hero.proof.production"),
          label: t("hero.proof.productionLabel"),
        };
      default:
        return null;
    }
  }).filter((item) => item !== null);

  const content = {
    eyebrow: t("hero.eyebrow", {
      established: siteFacts.company.established,
    }),
    title: t("hero.title"),
    subtitle: t("hero.subtitle"),
    primaryCta: {
      label: t("hero.cta.primary"),
      href: HOMEPAGE_SECTION_LINKS.contact,
    },
    secondaryCta: {
      label: t("hero.cta.secondary"),
      href: HOMEPAGE_SECTION_LINKS.products,
    },
    proofItems,
    preview: {
      label: t("hero.preview.label"),
      title: t("hero.preview.title"),
      description: t("hero.preview.description"),
      items: [
        t("hero.preview.pages"),
        t("hero.preview.components"),
        t("hero.preview.storybook"),
        t("hero.preview.workflow"),
      ],
      note: t("hero.preview.note"),
    },
  } satisfies HeroSectionContent;

  return <HeroSectionView content={content} />;
}
