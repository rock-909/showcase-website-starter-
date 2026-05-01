import { Link } from "@/i18n/routing";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { HOMEPAGE_SECTION_LINKS } from "@/components/sections/homepage-section-links";

export async function SampleCTA() {
  const t = await getTranslations("home");

  return (
    <section className="py-20 md:py-28">
      <div className="mx-auto max-w-[1080px] px-6">
        <div className="relative flex flex-col items-start gap-6 overflow-hidden rounded-xl border border-primary/[0.08] bg-[var(--primary-50)] p-10 sm:flex-row sm:items-center sm:justify-between sm:p-14">
          {/* Crosshair decoration — top-right */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-4 top-4 hidden h-6 w-6 border-r-2 border-t-2 border-primary/15 md:block"
          />
          {/* Crosshair decoration — bottom-left */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-4 left-4 hidden h-6 w-6 border-b-2 border-l-2 border-primary/15 md:block"
          />

          <div>
            <h2 className="text-[28px] font-bold leading-tight tracking-[-0.02em] md:text-[32px]">
              {t("sample.title")}
            </h2>
            <p className="mt-2 max-w-[420px] text-[15px] leading-relaxed text-muted-foreground">
              {t("sample.description")}
            </p>
          </div>
          <Button asChild size="lg" className="shrink-0">
            <Link href={HOMEPAGE_SECTION_LINKS.contact} prefetch={false}>
              <span data-testid="sample-cta-label" translate="no">
                {t("sample.cta")}
              </span>
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
