import { describe, expect, it } from "vitest";
import {
  getClientMessageNamespaces,
  pickMessages,
  pickClientMessages,
} from "@/lib/i18n/client-messages";

describe("client message scoping", () => {
  it("keeps only namespaces needed by client islands", () => {
    const scoped = pickClientMessages({
      home: { hero: "server-only" },
      faq: { sectionTitle: "server-only" },
      language: { selectLanguage: "Select Language" },
      navigation: { home: "Home" },
      cookie: { title: "Cookies" },
      common: { close: "Close" },
      contact: { form: { title: "Contact" } },
      apiErrors: { UNKNOWN_ERROR: "Unknown" },
    });

    expect(scoped).toEqual({
      apiErrors: { UNKNOWN_ERROR: "Unknown" },
      language: { selectLanguage: "Select Language" },
      navigation: { home: "Home" },
      contact: { form: { title: "Contact" } },
      cookie: { title: "Cookies" },
      common: { close: "Close" },
    });
  });

  it("tracks the intended namespace allowlist", () => {
    expect(getClientMessageNamespaces()).toEqual([
      "accessibility",
      "apiErrors",
      "common",
      "contact",
      "cookie",
      "errors",
      "language",
      "navigation",
      "seo",
    ]);
  });

  it("can scope a page-specific subset when needed", () => {
    const scoped = pickMessages(
      {
        contact: { form: { title: "Contact" } },
        apiErrors: { UNKNOWN_ERROR: "Unknown" },
        home: { hero: "Server only" },
      },
      ["contact", "apiErrors"],
    );

    expect(scoped).toEqual({
      contact: { form: { title: "Contact" } },
      apiErrors: { UNKNOWN_ERROR: "Unknown" },
    });
  });
});
