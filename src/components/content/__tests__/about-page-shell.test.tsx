import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AboutPageShell } from "../about-page-shell";
import type { PageMetadata } from "@/types/content.types";

vi.mock("@/components/mdx/mdx-content", () => ({
  MDXContent: (props: { slug: string }) => (
    <div data-testid="mdx-content">{props.slug}</div>
  ),
}));

vi.mock("@/components/seo", () => ({
  JsonLdGraphScript: ({ data }: { data: unknown[] }) => (
    <script
      data-testid="about-schema"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@graph": data }) }}
    />
  ),
}));

vi.mock("@/components/sections/faq-section", () => ({
  FaqSection: ({ faqItems }: { faqItems: unknown[] }) => (
    <div data-testid="faq-section">FAQ ({faqItems.length})</div>
  ),
}));

vi.mock("@/i18n/routing", () => ({
  Link: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => <a href={href}>{children}</a>,
}));

const baseMetadata: PageMetadata = {
  title: "About Example Showcase Company",
  description: "Reusable showcase website starter example",
  slug: "about",
  publishedAt: "2024-01-01",
  heroTitle: "Our Story",
  heroSubtitle: "Showcase Website Starter",
  heroDescription: "Reusable page structure since 2018.",
  aboutSections: {
    valuesTitle: "Starter Capabilities",
    values: {
      quality: {
        title: "Clear Structure",
        description: "Consistent content ownership.",
      },
      innovation: {
        title: "Reusable Components",
        description: "Shared component development.",
      },
      service: {
        title: "Contact Flow",
        description: "Visitor support from inquiry to follow-up.",
      },
      integrity: {
        title: "Verified Proof",
        description: "Placeholder claims must be replaced.",
      },
    },
    statLabels: {
      yearsExperience: "Years Experience",
      countriesServed: "Example Markets",
      happyClients: "Team Members",
      productsDelivered: "Example Footprint",
    },
    cta: {
      title: "Adapt This Starter",
      description: "Discuss your project with our team.",
      button: "Start Inquiry",
    },
  },
  faq: [
    {
      id: "starter-purpose",
      question: "Is this a finished website?",
      answer: "{companyName} is a replaceable starter identity.",
    },
  ],
};

describe("AboutPageShell", () => {
  it("renders hero section with metadata", () => {
    render(
      <AboutPageShell
        metadata={baseMetadata}
        content="## Body"
        locale="en"
      />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Our Story" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Showcase Website Starter")).toBeInTheDocument();
    expect(screen.getByText("Reusable page structure since 2018.")).toBeInTheDocument();
  });

  it("renders value cards and stat items", () => {
    render(
      <AboutPageShell
        metadata={baseMetadata}
        content="## Body"
        locale="en"
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Starter Capabilities" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Clear Structure")).toBeInTheDocument();
  });

  it("renders FAQ section when faq items present", () => {
    render(
      <AboutPageShell
        metadata={baseMetadata}
        content="## Body"
        locale="en"
      />,
    );

    expect(screen.getByTestId("faq-section")).toBeInTheDocument();
  });

  it("omits FAQ section when faq is empty", () => {
    const noFaqMetadata = { ...baseMetadata, faq: [] };
    render(
      <AboutPageShell
        metadata={noFaqMetadata}
        content="## Body"
        locale="en"
      />,
    );

    expect(screen.queryByTestId("faq-section")).not.toBeInTheDocument();
  });

  it("omits MDX article when content is empty", () => {
    render(
      <AboutPageShell metadata={baseMetadata} content="  " locale="en" />,
    );

    expect(screen.queryByTestId("mdx-content")).not.toBeInTheDocument();
  });

  it("renders CTA with link to contact page", () => {
    render(
      <AboutPageShell
        metadata={baseMetadata}
        content="## Body"
        locale="en"
      />,
    );

    const ctaLink = screen.getByRole("link", { name: /start inquiry/i });
    expect(ctaLink).toHaveAttribute("href", "/contact");
  });

  it("falls back to title when heroTitle is absent", () => {
    const { heroTitle: _ht, heroSubtitle: _hs, heroDescription: _hd, ...rest } =
      baseMetadata;
    const noHeroMetadata: PageMetadata = rest;
    render(
      <AboutPageShell
        metadata={noHeroMetadata}
        content="## Body"
        locale="en"
      />,
    );

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "About Example Showcase Company",
      }),
    ).toBeInTheDocument();
  });

  it("renders structured data script", () => {
    render(
      <AboutPageShell
        metadata={baseMetadata}
        content="## Body"
        locale="en"
      />,
    );

    const script = screen.getByTestId("about-schema");
    const data = JSON.parse(script.innerHTML);
    const aboutNode = data["@graph"].find(
      (node: Record<string, unknown>) => node["@type"] === "AboutPage",
    );
    expect(aboutNode.name).toBe("About Example Showcase Company");
  });
});
