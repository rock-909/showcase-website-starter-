import { SINGLE_SITE_CONFIG, SINGLE_SITE_FACTS } from "@/config/single-site";

export interface WebsiteProfile {
  readonly name: string;
  readonly legalName: string;
  readonly tagline: string;
  readonly domain: string;
  readonly email: string;
  readonly phone: string;
  readonly address: string;
  readonly foundedYear: number;
  readonly socialLinks: {
    readonly linkedin: string;
    readonly x: string;
  };
}

export const websiteProfile: WebsiteProfile = {
  name: SINGLE_SITE_CONFIG.name,
  legalName: SINGLE_SITE_FACTS.company.name,
  tagline: "Public demo starter for launch-ready showcase websites.",
  domain: "example.com",
  email: SINGLE_SITE_FACTS.contact.email,
  phone: "+1 000 000 0000",
  address: "Replace before launch",
  foundedYear: 2020,
  socialLinks: {
    linkedin: SINGLE_SITE_FACTS.social.linkedin ?? "",
    x: SINGLE_SITE_FACTS.social.twitter ?? "",
  },
};
