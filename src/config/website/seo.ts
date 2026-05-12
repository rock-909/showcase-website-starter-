import { SINGLE_SITE_CONFIG, SINGLE_SITE_FACTS } from "@/config/single-site";
import { websiteProfile } from "@/config/website/profile";

export interface WebsiteSeo {
  readonly defaultTitle: string;
  readonly titleTemplate: string;
  readonly defaultDescription: string;
  readonly siteUrl: string;
  readonly ogImage: string;
}

export const websiteSeo: WebsiteSeo = {
  defaultTitle: SINGLE_SITE_CONFIG.seo.defaultTitle,
  titleTemplate: SINGLE_SITE_CONFIG.seo.titleTemplate,
  defaultDescription: SINGLE_SITE_CONFIG.seo.defaultDescription,
  siteUrl: `https://${websiteProfile.domain}`,
  ogImage: SINGLE_SITE_FACTS.brandAssets.ogImage,
};
