import { Link } from "@/i18n/routing";
import { getTranslations } from "next-intl/server";
import type { LinkHref } from "@/lib/i18n/route-parsing";
import { Button } from "@/components/ui/button";
import { HomepageSectionShell } from "@/components/sections/homepage-section-shell";
import { HOMEPAGE_SECTION_LINKS } from "@/components/sections/homepage-section-links";

const PRODUCT_COUNT = 3;
const SPECS_PER_PRODUCT = 3;

function ProductCard({
  tag,
  title,
  specs,
  standard,
  link,
}: {
  tag: string;
  title: string;
  specs: string[];
  standard: string;
  link: LinkHref;
}) {
  return (
    <div className="group rounded-lg bg-background p-6 shadow-card transition-[box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-active)] focus-within:-translate-y-0.5 focus-within:shadow-[var(--shadow-card-active)]">
      <span className="inline-block rounded bg-[var(--primary-light)] px-2.5 py-1 text-xs font-semibold text-primary">
        {tag}
      </span>
      <h3 className="mt-3 text-lg font-semibold leading-snug">{title}</h3>
      <ul className="mt-3 space-y-1.5">
        {specs.map((spec) => (
          <li
            key={spec}
            className="flex items-start gap-2 text-sm text-muted-foreground"
          >
            <span className="mt-1.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
            {spec}
          </li>
        ))}
      </ul>
      <div className="mt-4 flex items-center justify-between border-t pt-4">
        <span className="text-xs font-medium tracking-[0.04em] text-muted-foreground">
          {standard}
        </span>
        <Link
          href={link}
          prefetch={false}
          className="text-sm font-medium text-primary hover:underline focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none rounded-sm"
        >
          {title} &rarr;
        </Link>
      </div>
    </div>
  );
}

export async function ProductsSection() {
  const t = await getTranslations("home");

  const products = Array.from({ length: PRODUCT_COUNT }, (_, i) => {
    const key = `item${String(i + 1)}`;
    return {
      tag: t(`products.${key}.tag`),
      title: t(`products.${key}.title`),
      specs: Array.from({ length: SPECS_PER_PRODUCT }, (_unused, j) =>
        t(`products.${key}.spec${String(j + 1)}`),
      ),
      standard: t(`products.${key}.standard`),
      link: t(`products.${key}.link`) as LinkHref,
    };
  });

  const action = (
    <Button variant="secondary" asChild>
      <Link href={HOMEPAGE_SECTION_LINKS.products} prefetch={false}>
        {t("products.cta")}
      </Link>
    </Button>
  );

  return (
    <HomepageSectionShell
      sectionClassName="section-divider py-14 md:py-[72px]"
      title={t("products.title")}
      subtitle={t("products.subtitle")}
      action={action}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {products.map((product) => (
          <ProductCard key={product.tag} {...product} />
        ))}
      </div>
    </HomepageSectionShell>
  );
}
