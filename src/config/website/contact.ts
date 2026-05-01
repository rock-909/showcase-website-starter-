import { websiteProfile } from "@/config/website/profile";

export interface WebsiteContactConfig {
  readonly recipientEmail: string;
  readonly fallbackEmail: string;
  readonly responseTimeLabel: string;
}

export const websiteContact: WebsiteContactConfig = {
  recipientEmail: websiteProfile.email,
  fallbackEmail: websiteProfile.email,
  responseTimeLabel: "1 business day",
};
