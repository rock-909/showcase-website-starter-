import { getTranslations } from "next-intl/server";
import { SINGLE_SITE_HOME_SCENARIO_ITEMS } from "@/config/single-site-page-expression";
import { siteFacts } from "@/config/site-facts";
import {
  StaticArrowUpRightIcon,
  StaticCableIcon,
  StaticShieldCheckIcon,
  StaticWorkspaceIcon,
} from "@/components/icons/static-icons";
import { HomepageSectionShell } from "@/components/sections/homepage-section-shell";

const SCENARIO_ICONS = [
  StaticCableIcon,
  StaticWorkspaceIcon,
  StaticShieldCheckIcon,
] as const;

export async function ScenariosSection() {
  const t = await getTranslations("home.scenarios");

  return (
    <HomepageSectionShell
      sectionClassName="py-14 md:py-[72px]"
      title={t("title")}
      subtitle={t("subtitle", { countries: siteFacts.stats.exportCountries })}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {SINGLE_SITE_HOME_SCENARIO_ITEMS.map((key, index) => {
          const Icon = SCENARIO_ICONS[index] ?? StaticShieldCheckIcon;

          return (
            <div
              key={key}
              className="group overflow-hidden rounded-lg bg-card shadow-card transition-[box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:shadow-card-hover"
            >
              <div className="showcase-scenario-surface relative h-40 overflow-hidden">
                <div className="showcase-scenario-grid absolute inset-0 opacity-30" />
                <div className="relative flex h-full flex-col justify-between p-5 transition-transform duration-300 group-hover:scale-[1.02]">
                  <div className="flex items-center justify-between">
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-white/80">
                      <Icon size={14} />
                      {t("cardEyebrow", { count: index + 1 })}
                    </div>
                    <div className="rounded-full border border-white/20 px-2.5 py-1 text-xs text-white/75">
                      {t("countryBadge", {
                        countries: siteFacts.stats.exportCountries,
                      })}
                    </div>
                  </div>
                  <div>
                    <p className="max-w-[18rem] text-lg font-semibold leading-snug">
                      {t(`${key}.title`)}
                    </p>
                    <div className="mt-3 inline-flex items-center gap-1 text-xs text-white/75">
                      {t("proofLabel")}
                      <StaticArrowUpRightIcon size={14} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-5">
                <h3 className="text-[18px] font-bold leading-snug">
                  {t(`${key}.title`)}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t(`${key}.desc`)}
                </p>

                <div className="mt-4 border-t border-border pt-3">
                  <p className="text-[13px] italic text-muted-foreground">
                    {t(`${key}.quote`)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </HomepageSectionShell>
  );
}
