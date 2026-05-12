import { describe, expect, it, vi } from "vitest";

import { SINGLE_SITE_CONFIG, SINGLE_SITE_FACTS } from "@/config/single-site";
import {
  websiteContact,
  websiteHomepage,
  websiteNavigation,
  websiteProductCategories,
  websiteProfile,
  websiteSeo,
} from "@/config/website";

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
    expect(websiteSeo.ogImage).toBe(SINGLE_SITE_FACTS.brandAssets.ogImage);
  });

  it("keeps starter URL placeholders static and derived from the website profile", () => {
    expect(websiteProfile.domain).toBe("example.com");
    expect(websiteSeo.siteUrl).toBe("https://example.com");
    expect(websiteSeo.siteUrl).toBe(`https://${websiteProfile.domain}`);
  });

  it("keeps starter URL placeholders independent from runtime baseUrl overrides", async () => {
    try {
      vi.resetModules();
      vi.doMock("@/lib/env", () => ({
        env: {
          NEXT_PUBLIC_SITE_URL: "https://runtime.example.test",
          NEXT_PUBLIC_BASE_URL: "https://fallback.example.test",
        },
      }));

      const [
        { SINGLE_SITE_CONFIG: overriddenSiteConfig },
        { websiteProfile: overriddenWebsiteProfile },
        { websiteSeo: overriddenWebsiteSeo },
      ] = await Promise.all([
        import("@/config/single-site"),
        import("@/config/website/profile"),
        import("@/config/website/seo"),
      ]);

      expect(overriddenSiteConfig.baseUrl).toBe("https://runtime.example.test");
      expect(overriddenWebsiteProfile.domain).toBe("example.com");
      expect(overriddenWebsiteSeo.siteUrl).toBe("https://example.com");
      expect(overriddenWebsiteSeo.siteUrl).toBe(
        `https://${overriddenWebsiteProfile.domain}`,
      );
    } finally {
      vi.doUnmock("@/lib/env");
      vi.resetModules();
    }
  });

  it("keeps contact recipient and fallback emails aligned", () => {
    expect(websiteContact.recipientEmail).toBe(SINGLE_SITE_FACTS.contact.email);
    expect(websiteContact.fallbackEmail).toBe(SINGLE_SITE_FACTS.contact.email);
  });
});
