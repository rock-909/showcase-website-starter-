import { websiteProfile } from "@/config/website/profile";

export interface WebsiteSeo {
  readonly defaultTitle: string;
  readonly titleTemplate: string;
  readonly defaultDescription: string;
  readonly siteUrl: string;
  readonly ogImage: string;
}

export const websiteSeo: WebsiteSeo = {
  defaultTitle: `${websiteProfile.name} | Showcase Website Starter`,
  titleTemplate: `%s | ${websiteProfile.name}`,
  defaultDescription:
    "A showcase website starter for company presentation, product or service pages, and inquiry conversion.",
  siteUrl: `https://${websiteProfile.domain}`,
  ogImage: "/images/og-image.jpg",
};
