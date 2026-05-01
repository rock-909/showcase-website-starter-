export type HomepageSectionId =
  | "hero"
  | "products"
  | "scenarios"
  | "quality"
  | "faq"
  | "finalCta";

export interface WebsiteHomepageConfig {
  readonly sectionOrder: readonly HomepageSectionId[];
  readonly primaryCtaHref: string;
  readonly secondaryCtaHref: string;
  readonly showFaq: boolean;
  readonly showMetrics: boolean;
}

export const websiteHomepage: WebsiteHomepageConfig = {
  sectionOrder: ["hero", "products", "scenarios", "quality", "faq", "finalCta"],
  primaryCtaHref: "/contact",
  secondaryCtaHref: "/about",
  showFaq: true,
  showMetrics: true,
};
