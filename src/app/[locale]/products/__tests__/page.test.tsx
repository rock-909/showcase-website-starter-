import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Mock next-intl
const mockTranslations = {
  "markets.north-america.label": "Primary Offer Example",
  "markets.australia-new-zealand.label": "Secondary Offer Example",
  "markets.mexico.label": "Regional Offer Example",
  "markets.europe.label": "Platform Offer Example",
  "markets.specialty-product-systems.label": "Specialty Examples",
  "overview.byStandard": "By Market Standard",
  "overview.specialty": "Specialty Products",
  "overview.title": "Products",
  "overview.description": "Our product catalog",
  familyCount: "3 product families",
} as const;

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(
    async () => (key: string) =>
      mockTranslations[key as keyof typeof mockTranslations] || key,
  ),
  setRequestLocale: vi.fn(),
}));

// Mock i18n routing
vi.mock("@/i18n/routing", () => ({
  Link: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  routing: {
    locales: ["en", "zh"],
    defaultLocale: "en",
  },
}));

vi.mock("@/config/paths", () => ({
  SITE_CONFIG: {
    baseUrl: "https://www.example.com",
  },
}));

// Mock SEO metadata
vi.mock("@/lib/seo-metadata", () => ({
  generateMetadataForPath: vi.fn(async () => ({
    title: "Products",
    description: "Products page",
  })),
}));

// Mock CatalogBreadcrumb
vi.mock("@/components/products/catalog-breadcrumb", () => ({
  CatalogBreadcrumb: () => <nav aria-label="breadcrumb">Breadcrumb</nav>,
  buildCatalogBreadcrumbJsonLd: vi.fn(async () => ({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [],
  })),
}));

vi.mock("@/components/seo", () => ({
  JsonLdGraphScript: () => <script type="application/ld+json" />,
  JsonLdScript: () => <script type="application/ld+json" />,
}));

// Mock MarketSeriesCard
vi.mock("@/components/products/market-series-card", () => ({
  MarketSeriesCard: ({
    slug,
    label,
  }: {
    slug: string;
    label: string;
    description: string;
    standardLabel: string;
    familyCountLabel: string;
  }) => (
    <a href={`/products/${slug}`}>
      <h2>{label}</h2>
    </a>
  ),
}));

describe("Products Overview Page", () => {
  it("renders 5 market series cards with correct labels", async () => {
    const { default: ProductsPage } = await import("../page");
    const page = await ProductsPage({
      params: Promise.resolve({ locale: "en" }),
    });
    render(page);

    expect(screen.getByText("Primary Offer Example")).toBeInTheDocument();
    expect(screen.getByText("Secondary Offer Example")).toBeInTheDocument();
    expect(screen.getByText("Regional Offer Example")).toBeInTheDocument();
    expect(screen.getByText("Platform Offer Example")).toBeInTheDocument();
    expect(screen.getByText("Specialty Examples")).toBeInTheDocument();
  });

  it("each card links to the correct market URL", async () => {
    const { default: ProductsPage } = await import("../page");
    const page = await ProductsPage({
      params: Promise.resolve({ locale: "en" }),
    });
    render(page);

    const links = screen.getAllByRole("link");
    const hrefs = links.map((l) => l.getAttribute("href"));

    expect(hrefs).toContain("/products/north-america");
    expect(hrefs).toContain("/products/australia-new-zealand");
    expect(hrefs).toContain("/products/mexico");
    expect(hrefs).toContain("/products/europe");
    expect(hrefs).toContain("/products/specialty-product-systems");
  });

  it("renders breadcrumb", async () => {
    const { default: ProductsPage } = await import("../page");
    const page = await ProductsPage({
      params: Promise.resolve({ locale: "en" }),
    });
    render(page);

    expect(screen.getByLabelText("breadcrumb")).toBeInTheDocument();
  });
});
