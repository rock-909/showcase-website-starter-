/**
 * @vitest-environment jsdom
 */

import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

describe("LocaleHead", () => {
  it("renders Google Tag Manager as the only default analytics dns-prefetch", async () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_CN_FONT_SUBSET", "false");

    const { default: LocaleHead } = await import("@/app/[locale]/head");
    render(<LocaleHead />);

    const links = Array.from(
      document.querySelectorAll<HTMLLinkElement>('link[rel="dns-prefetch"]'),
    ).map((link) => link.href);

    expect(links).toEqual(["https://www.googletagmanager.com/"]);
  });
});
