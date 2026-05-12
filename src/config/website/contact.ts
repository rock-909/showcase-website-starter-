import { SINGLE_SITE_FACTS } from "@/config/single-site";

export interface WebsiteContactConfig {
  readonly recipientEmail: string;
  readonly fallbackEmail: string;
  readonly responseTimeLabel: string;
}

export const websiteContact: WebsiteContactConfig = {
  recipientEmail: SINGLE_SITE_FACTS.contact.email,
  fallbackEmail: SINGLE_SITE_FACTS.contact.email,
  responseTimeLabel: "1 business day",
};
