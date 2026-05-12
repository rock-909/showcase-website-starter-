import { describe, expect, it } from "vitest";

import { SINGLE_SITE_CONFIG, SINGLE_SITE_FACTS } from "@/config/single-site";
import {
  websiteContact,
  websiteHomepage,
  websiteNavigation,
  websiteProductCategories,
  websiteProfile,
  websiteSeo,
} from "@/config/website";

function stripProtocol(url: string): string {
  return url.replace(/^https?:\/\//, "");
}

describe("website config", () => {
  it("provides a complete replaceable website profile", () => {
    expect(websiteProfile.name).toBe("Showcase Website Starter");
    expect(websiteProfile.domain).toBe("example.com");
    expect(websiteProfile.email).toBe("starter-contact@example.com");
  });

  it("provides page assembly inputs", () => {
    expect(websiteHomepage.sectionOrder).toContain("hero");
    expect(websiteHomepage.primaryCtaHref).toBe("/contact");
    expect(websiteNavigation.length).toBeGreaterThan(0);
    expect(websiteNavigation.map((item) => item.href)).toEqual([
      "/",
      "/products",
      "/blog",
      "/about",
    ]);
  });

  it("provides product and contact defaults", () => {
    expect(websiteProductCategories.length).toBeGreaterThan(0);
    expect(websiteContact.recipientEmail).toBe("starter-contact@example.com");
    expect(websiteSeo.siteUrl).toBe("https://example.com");
  });

  it("keeps mirror identity aligned with the single-site truth source", () => {
    expect(websiteProfile.name).toBe(SINGLE_SITE_CONFIG.name);
    expect(websiteProfile.legalName).toBe(SINGLE_SITE_FACTS.company.name);
    expect(websiteProfile.domain).toBe(
      stripProtocol(SINGLE_SITE_CONFIG.baseUrl),
    );
    expect(websiteProfile.email).toBe(SINGLE_SITE_FACTS.contact.email);
    expect(websiteProfile.socialLinks.linkedin).toBe(
      SINGLE_SITE_FACTS.social.linkedin,
    );
    expect(websiteProfile.socialLinks.x).toBe(SINGLE_SITE_FACTS.social.twitter);
  });

  it("keeps mirror SEO aligned with the single-site truth source", () => {
    expect(websiteSeo.titleTemplate).toBe(SINGLE_SITE_CONFIG.seo.titleTemplate);
    expect(websiteSeo.defaultTitle).toBe(SINGLE_SITE_CONFIG.seo.defaultTitle);
    expect(websiteSeo.defaultDescription).toBe(
      SINGLE_SITE_CONFIG.seo.defaultDescription,
    );
    expect(websiteSeo.siteUrl).toBe(SINGLE_SITE_CONFIG.baseUrl);
    expect(websiteSeo.ogImage).toBe(SINGLE_SITE_FACTS.brandAssets.ogImage);
  });

  it("keeps contact recipient and fallback emails aligned", () => {
    expect(websiteContact.recipientEmail).toBe(SINGLE_SITE_FACTS.contact.email);
    expect(websiteContact.fallbackEmail).toBe(SINGLE_SITE_FACTS.contact.email);
  });
});
