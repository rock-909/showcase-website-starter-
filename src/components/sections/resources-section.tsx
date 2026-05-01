import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import type { LinkHref } from "@/lib/i18n/route-parsing";
import {
  type StaticIconComponent,
  StaticAwardIcon,
  StaticFileTextIcon,
  StaticFolderOpenIcon,
  StaticPencilRulerIcon,
} from "@/components/icons/static-icons";
import { HomepageSectionShell } from "@/components/sections/homepage-section-shell";

const RESOURCE_COUNT = 4;

const ICONS: StaticIconComponent[] = [
  StaticFolderOpenIcon,
  StaticFileTextIcon,
  StaticPencilRulerIcon,
  StaticAwardIcon,
];

function ResourceCard({
  Icon,
  title,
  desc,
  link,
}: {
  Icon: StaticIconComponent;
  title: string;
  desc: string;
  link: LinkHref;
}) {
  return (
    <Link
      href={link}
      className="group flex flex-col gap-3 bg-background p-6 transition-colors hover:bg-[var(--primary-50)] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--primary-light)] text-primary">
        <Icon size={20} />
      </div>
      <h3 className="text-[15px] font-semibold leading-snug">{title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
      <span className="mt-auto inline-block text-sm font-medium text-primary transition-transform duration-150 group-hover:translate-x-1">
        &rarr;
      </span>
    </Link>
  );
}

export async function ResourcesSection() {
  const t = await getTranslations("home");

  const resources = Array.from({ length: RESOURCE_COUNT }, (_, i) => {
    const key = `item${String(i + 1)}`;
    // ICONS length matches RESOURCE_COUNT — safe access
    const Icon = ICONS[i]!;
    return {
      Icon,
      title: t(`resources.${key}.title`),
      desc: t(`resources.${key}.desc`),
      link: t(`resources.${key}.link`) as LinkHref,
    };
  });

  return (
    <HomepageSectionShell
      sectionClassName="section-divider py-14 md:py-[72px]"
      title={t("resources.title")}
      subtitle={t("resources.subtitle")}
    >
      <div className="overflow-hidden rounded-lg border bg-border">
        <div className="grid grid-cols-1 gap-[2px] sm:grid-cols-2 lg:grid-cols-4">
          {resources.map((resource) => (
            <ResourceCard key={resource.title} {...resource} />
          ))}
        </div>
      </div>
    </HomepageSectionShell>
  );
}
