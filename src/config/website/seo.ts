import { websiteProfile } from "@/config/website/profile";

export interface WebsiteSeo {
  readonly defaultTitle: string;
  readonly titleTemplate: string;
  readonly defaultDescription: string;
  readonly siteUrl: string;
  readonly ogImage: string;
}

export const websiteSeo: WebsiteSeo = {
  defaultTitle: `${websiteProfile.name} - Public Demo Starter Site`,
  titleTemplate: `%s | ${websiteProfile.name}`,
  defaultDescription:
    "A public demo starter site for teams that need a deployable showcase website foundation before they have a real website.",
  siteUrl: `https://${websiteProfile.domain}`,
  ogImage: "/images/og-image.jpg",
};
