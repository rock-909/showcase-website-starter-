import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CapabilitiesPage, { generateMetadata } from "../page";

const { mockGetPageBySlug, mockGenerateMetadataForPath } = vi.hoisted(() => ({
  mockGetPageBySlug: vi.fn(),
  mockGenerateMetadataForPath: vi.fn(() => ({
    title: "MDX SEO Title",
    description: "MDX SEO description",
  })),
}));

vi.mock("next-intl/server", () => ({
  setRequestLocale: vi.fn(),
}));

vi.mock("@/lib/content", () => ({
  getPageBySlug: mockGetPageBySlug,
}));

vi.mock("@/lib/seo-metadata", () => ({
  generateMetadataForPath: mockGenerateMetadataForPath,
}));

describe("CapabilitiesPage", () => {
  it("renders the public capabilities story from MDX content", async () => {
    mockGetPageBySlug.mockResolvedValue({
      metadata: {
        title: "Starter capabilities from MDX",
        description: "MDX-owned capabilities description.",
        seo: {
          title: "MDX capabilities SEO title",
          description: "MDX capabilities SEO description",
          keywords: ["mdx capabilities", "starter metadata"],
          ogImage: "/images/capabilities-og.jpg",
        },
      },
      content: [
        "## Credible public pages",
        "Home, capabilities, process, about, contact, privacy, and terms pages start from a working structure.",
        "",
        "## Replacement guardrails",
        "Docs and checks keep sample identity from being treated as real launch truth.",
      ].join("\n"),
    });

    const page = await CapabilitiesPage({
      params: Promise.resolve({ locale: "en" }),
    });

    render(page);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Starter capabilities from MDX",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Credible public pages" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Docs and checks keep sample identity from being treated as real launch truth.",
      ),
    ).toBeInTheDocument();
    expect(mockGetPageBySlug).toHaveBeenCalledWith("capabilities", "en");
  });

  it("uses MDX metadata for page SEO", async () => {
    mockGetPageBySlug.mockResolvedValue({
      metadata: {
        title: "Fallback capabilities title",
        description: "Fallback capabilities description",
        seo: {
          title: "MDX capabilities SEO title",
          description: "MDX capabilities SEO description",
          keywords: ["mdx capabilities", "starter metadata"],
          ogImage: "/images/capabilities-og.jpg",
        },
      },
      content: "",
    });

    await generateMetadata({
      params: Promise.resolve({ locale: "en" }),
    });

    expect(mockGenerateMetadataForPath).toHaveBeenCalledWith(
      expect.objectContaining({
        pageType: "capabilities",
        config: {
          title: "MDX capabilities SEO title",
          description: "MDX capabilities SEO description",
          keywords: ["mdx capabilities", "starter metadata"],
          image: "/images/capabilities-og.jpg",
        },
      }),
    );
  });
});
