import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import HowItWorksPage, { generateMetadata } from "../page";

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

describe("HowItWorksPage", () => {
  it("renders the setup to launch flow from MDX content", async () => {
    mockGetPageBySlug.mockResolvedValue({
      metadata: {
        title: "Move from no website to a launchable foundation.",
        description: "MDX-owned how it works description.",
        seo: {
          title: "MDX how it works SEO title",
          description: "MDX how it works SEO description",
        },
      },
      content: [
        "## Step 1: Replace the business facts",
        "Update brand, domain, contact details, offer content, images, legal body, and proof assets.",
        "",
        "## Step 5: Check traffic and sign off",
        "Set up owner reporting visibility, review real traffic, and confirm the launch state with the owner.",
      ].join("\n"),
    });

    const page = await HowItWorksPage({
      params: Promise.resolve({ locale: "en" }),
    });

    render(page);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Move from no website to a launchable foundation.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Step 1: Replace the business facts",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Set up owner reporting visibility, review real traffic, and confirm the launch state with the owner.",
      ),
    ).toBeInTheDocument();
    expect(mockGetPageBySlug).toHaveBeenCalledWith("how-it-works", "en");
  });

  it("uses MDX metadata for page SEO", async () => {
    mockGetPageBySlug.mockResolvedValue({
      metadata: {
        title: "Fallback how it works title",
        description: "Fallback how it works description",
        seo: {
          title: "MDX how it works SEO title",
          description: "MDX how it works SEO description",
          ogImage: "/images/how-it-works-og.jpg",
        },
      },
      content: "",
    });

    await generateMetadata({
      params: Promise.resolve({ locale: "en" }),
    });

    expect(mockGenerateMetadataForPath).toHaveBeenCalledWith(
      expect.objectContaining({
        pageType: "howItWorks",
        config: {
          title: "MDX how it works SEO title",
          description: "MDX how it works SEO description",
          image: "/images/how-it-works-og.jpg",
        },
      }),
    );
  });
});
