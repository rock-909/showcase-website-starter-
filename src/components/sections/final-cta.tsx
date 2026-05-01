import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/routing";
import { SINGLE_SITE_HOME_FINAL_TRUST_ITEMS } from "@/config/single-site-page-expression";
import { siteFacts } from "@/config/site-facts";
import { HOMEPAGE_SECTION_LINKS } from "@/components/sections/homepage-section-links";
import { HomepageTrustStrip } from "@/components/sections/homepage-trust-strip";

export async function FinalCTA() {
  const t = await getTranslations("home.finalCta");
  const trustItems = SINGLE_SITE_HOME_FINAL_TRUST_ITEMS.map((item) => {
    switch (item) {
      case "countries":
        return {
          value: t("trust", { countries: siteFacts.stats.exportCountries }),
        };
      default:
        return null;
    }
  }).filter((item) => item !== null);

  return (
    <section className="bg-primary py-20 md:py-28">
      <div className="mx-auto max-w-[1080px] px-6 text-center">
        <h2 className="text-[36px] font-bold leading-[1.2] tracking-[-0.02em] text-white">
          {t("title")}
        </h2>

        <p className="mx-auto mt-4 max-w-[560px] text-white/90">
          {t("description")}
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button variant="on-dark" size="lg" asChild>
            <Link href={HOMEPAGE_SECTION_LINKS.contact} prefetch={false}>
              <span data-testid="final-cta-primary-label" translate="no">
                {t("primary")}
              </span>
            </Link>
          </Button>
          <Button variant="ghost-dark" size="lg" asChild>
            <Link href={HOMEPAGE_SECTION_LINKS.products} prefetch={false}>
              <span data-testid="final-cta-secondary-label" translate="no">
                {t("secondary")}
              </span>
            </Link>
          </Button>
        </div>

        <HomepageTrustStrip
          ariaLabel="Homepage trust facts"
          className="mt-6 text-[13px]"
          tone="inverse"
          emphasizeValues={false}
          items={trustItems}
        />
      </div>
    </section>
  );
}
