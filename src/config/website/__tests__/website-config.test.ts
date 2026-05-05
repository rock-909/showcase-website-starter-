import { describe, expect, it } from "vitest";

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
});
