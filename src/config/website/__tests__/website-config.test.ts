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
    expect(websiteProfile.name).toBeTruthy();
    expect(websiteProfile.domain).toBe("example.com");
    expect(websiteProfile.email).toBe("sales@example.com");
  });

  it("provides page assembly inputs", () => {
    expect(websiteHomepage.sectionOrder).toContain("hero");
    expect(websiteHomepage.primaryCtaHref).toBe("/contact");
    expect(websiteNavigation.length).toBeGreaterThan(0);
  });

  it("provides product and contact defaults", () => {
    expect(websiteProductCategories.length).toBeGreaterThan(0);
    expect(websiteContact.recipientEmail).toBe("sales@example.com");
    expect(websiteSeo.siteUrl).toBe("https://example.com");
  });
});
