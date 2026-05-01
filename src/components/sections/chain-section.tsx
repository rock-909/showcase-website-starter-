import { getTranslations } from "next-intl/server";
import { StaticCheckIcon } from "@/components/icons/static-icons";
import { HomepageSectionShell } from "@/components/sections/homepage-section-shell";

const STEP_COUNT = 5;
const STAT_COUNT = 3;

function ProcessStep({
  num,
  title,
  desc,
  isLast,
}: {
  num: string;
  title: string;
  desc: string;
  isLast: boolean;
}) {
  return (
    <div className="relative flex flex-1 items-start gap-4 py-5 md:flex-col md:items-center md:py-0 md:text-center">
      {/* Connecting line — horizontal on desktop, vertical on mobile */}
      {!isLast && (
        <>
          {/* Desktop: horizontal line from circle right edge to next circle left edge */}
          <span
            aria-hidden="true"
            className="absolute left-[calc(50%+24px)] top-5 hidden h-0.5 w-[calc(100%-48px)] bg-border md:block"
          />
          {/* Mobile: vertical line below circle */}
          <span
            aria-hidden="true"
            className="absolute bottom-0 left-[19px] top-[52px] w-0.5 bg-border md:hidden"
          />
        </>
      )}

      {/* Numbered circle */}
      <div className="relative z-[1] flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-card font-mono text-sm font-semibold text-primary">
        {num}
      </div>

      <div className="md:mt-3">
        <h3 className="text-[15px] font-semibold leading-snug">{title}</h3>
        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
          {desc}
        </p>
      </div>
    </div>
  );
}

function StatBadge({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[var(--success-border)] bg-[var(--success-muted)] px-5 py-4">
      <span className="text-[var(--success)]">
        <StaticCheckIcon size={20} />
      </span>
      <span className="text-sm font-medium">{text}</span>
    </div>
  );
}

export async function ChainSection() {
  const t = await getTranslations("home");

  const steps = Array.from({ length: STEP_COUNT }, (_, i) => {
    const key = `step${String(i + 1)}`;
    return {
      num: String(i + 1).padStart(2, "0"),
      title: t(`chain.${key}.title`),
      desc: t(`chain.${key}.desc`),
    };
  });

  const stats = Array.from({ length: STAT_COUNT }, (_, i) =>
    t(`chain.stat${String(i + 1)}`),
  );

  return (
    <HomepageSectionShell
      sectionClassName="section-divider py-10 md:py-14"
      title={t("chain.title")}
      subtitle={t("chain.subtitle")}
    >
      {/* Process flow */}
      <div className="flex flex-col md:flex-row">
        {steps.map((step, i) => (
          <ProcessStep key={step.num} {...step} isLast={i === STEP_COUNT - 1} />
        ))}
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {stats.map((text) => (
          <StatBadge key={text} text={text} />
        ))}
      </div>
    </HomepageSectionShell>
  );
}
