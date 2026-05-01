import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { HeroGuideOverlay } from "@/components/grid";
import { Link } from "@/i18n/routing";
import { SINGLE_SITE_HOME_HERO_PROOF_ITEMS } from "@/config/single-site-page-expression";
import { siteFacts } from "@/config/site-facts";
import { HOMEPAGE_SECTION_LINKS } from "@/components/sections/homepage-section-links";
import { HomepageTrustStrip } from "@/components/sections/homepage-trust-strip";

function HeroEyebrow({ text }: { text: string }) {
  return (
    <div className="hero-stagger-1 flex items-center gap-2">
      <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
      <span className="text-[13px] font-semibold uppercase tracking-[0.04em] text-primary">
        {text}
      </span>
    </div>
  );
}

function HeroVisual() {
  return (
    <div className="hero-stagger-6 grid grid-cols-2 grid-rows-[180px_160px] gap-3">
      <div className="col-span-2 rounded-lg bg-card shadow-border" />
      <div className="rounded-lg bg-card shadow-border" />
      <div className="rounded-lg bg-card shadow-border" />
    </div>
  );
}

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

  return (
    <section
      data-testid="hero-section"
      className="relative px-6 py-10 pb-14 md:py-16 md:pb-[72px]"
    >
      <HeroGuideOverlay />
      <div className="relative z-[1] mx-auto grid max-w-[1080px] grid-cols-1 items-center gap-12 md:grid-cols-2">
        {/* Left column — Copy */}
        <div className="flex flex-col">
          <HeroEyebrow
            text={t("hero.eyebrow", {
              established: siteFacts.company.established,
            })}
          />

          <h1 className="hero-stagger-2 mt-4 text-[36px] font-extrabold leading-[1.1] tracking-[-0.03em] md:text-[48px] md:leading-[1.0] md:tracking-[-0.05em]">
            {t("hero.title")}
          </h1>

          <p className="hero-stagger-3 mt-4 max-w-[480px] text-lg text-muted-foreground">
            {t("hero.subtitle")}
          </p>

          <div className="hero-stagger-4 mt-7 flex flex-wrap gap-3">
            <Button asChild>
              <Link href={HOMEPAGE_SECTION_LINKS.contact} prefetch={false}>
                {t("hero.cta.primary")}
              </Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link href={HOMEPAGE_SECTION_LINKS.products} prefetch={false}>
                {t("hero.cta.secondary")}
              </Link>
            </Button>
          </div>

          <HomepageTrustStrip
            ariaLabel="Homepage proof facts"
            className="hero-stagger-5 mt-7 border-t border-border-light pt-5 font-mono text-[13px] text-muted-foreground"
            items={proofItems}
          />
        </div>

        {/* Right column — Visual grid */}
        <HeroVisual />
      </div>
    </section>
  );
}
