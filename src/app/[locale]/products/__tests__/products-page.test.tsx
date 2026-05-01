import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProductsPage from "../page";

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => (key: string) => key),
  setRequestLocale: vi.fn(),
}));

// Mock sub-components
vi.mock("@/components/products/market-series-card", () => ({
  MarketSeriesCard: ({
    slug,
    label,
    familyCountLabel,
  }: {
    slug: string;
    label: string;
    description: string;
    standardLabel: string;
    familyCountLabel: string;
  }) => (
    <div data-testid={`market-card-${slug}`}>
      {label} ({familyCountLabel})
    </div>
  ),
}));

vi.mock("@/components/products/catalog-breadcrumb", () => ({
  CatalogBreadcrumb: () => <nav data-testid="breadcrumb">Products</nav>,
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

vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    fill: _fill,
    sizes: _sizes,
    className,
  }: {
    src: string;
    alt: string;
    fill?: boolean;
    sizes?: string;
    className?: string;
  }) => (
    // img is acceptable in a test stub — next/image is not available in vitest jsdom
    <img src={src} alt={alt} className={className} />
  ),
}));

vi.mock("@/app/[locale]/generate-static-params", () => ({
  generateLocaleStaticParams: () => [{ locale: "en" }, { locale: "zh" }],
}));

// Render helper for async Server Components
async function renderAsyncComponent(
  component: Promise<React.JSX.Element> | React.JSX.Element,
) {
  const resolved = await Promise.resolve(component);
  return render(resolved);
}

describe("Feature: Product Overview Page", () => {
  const mockParams = { locale: "en" };
  const RETIRED_BENDING_MACHINES_PATH = "/capabilities/bending-machines";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Scenario 2.1: Buyer sees Industrial fittings by market standard", () => {
    it("renders a 'By Market Standard' section heading", async () => {
      await renderAsyncComponent(
        ProductsPage({ params: Promise.resolve(mockParams) }),
      );

      // getTranslations returns key as value — "overview.byStandard"
      expect(screen.getByText("overview.byStandard")).toBeInTheDocument();
    });

    it("renders market cards for all four Industrial markets", async () => {
      await renderAsyncComponent(
        ProductsPage({ params: Promise.resolve(mockParams) }),
      );

      expect(
        screen.getByTestId("market-card-north-america"),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId("market-card-australia-new-zealand"),
      ).toBeInTheDocument();
      expect(screen.getByTestId("market-card-mexico")).toBeInTheDocument();
      expect(screen.getByTestId("market-card-europe")).toBeInTheDocument();
    });

    it("does NOT render specialty-product-systems in the Industrial section", async () => {
      await renderAsyncComponent(
        ProductsPage({ params: Promise.resolve(mockParams) }),
      );

      // The Industrial section must have exactly 4 cards (no specialty-product-systems)
      const industrialSection = screen
        .getByText("overview.byStandard")
        .closest("section");
      const industrialCards = industrialSection?.querySelectorAll(
        "[data-testid^='market-card-']",
      );
      expect(industrialCards?.length).toBe(4);
    });
  });

  describe("Scenario 2.2: Buyer sees specialty products only", () => {
    it("renders a specialty products section heading", async () => {
      await renderAsyncComponent(
        ProductsPage({ params: Promise.resolve(mockParams) }),
      );

      expect(screen.getByText("overview.specialty")).toBeInTheDocument();
    });

    it("renders the product or service examples market card in the specialty section", async () => {
      await renderAsyncComponent(
        ProductsPage({ params: Promise.resolve(mockParams) }),
      );

      expect(
        screen.getByTestId("market-card-specialty-product-systems"),
      ).toBeInTheDocument();
    });

    it("does not render the retired equipment card", async () => {
      await renderAsyncComponent(
        ProductsPage({ params: Promise.resolve(mockParams) }),
      );

      expect(
        screen.queryByText("overview.equipmentTitle"),
      ).not.toBeInTheDocument();
      expect(
        document.querySelector(`a[href="${RETIRED_BENDING_MACHINES_PATH}"]`),
      ).not.toBeInTheDocument();
    });
  });

  describe("Scenario 2.3: Breadcrumb shows root level (no market)", () => {
    it("renders breadcrumb without a market argument", async () => {
      await renderAsyncComponent(
        ProductsPage({ params: Promise.resolve(mockParams) }),
      );

      // The mocked CatalogBreadcrumb renders with data-testid="breadcrumb"
      const breadcrumb = screen.getByTestId("breadcrumb");
      expect(breadcrumb).toBeInTheDocument();
      expect(breadcrumb).toHaveTextContent("Products");
    });
  });

  describe("Scenario 2.4: Page header", () => {
    it("renders the h1 page title", async () => {
      await renderAsyncComponent(
        ProductsPage({ params: Promise.resolve(mockParams) }),
      );

      const heading = screen.getByRole("heading", { level: 1 });
      expect(heading).toHaveTextContent("overview.title");
    });

    it("renders the page description", async () => {
      await renderAsyncComponent(
        ProductsPage({ params: Promise.resolve(mockParams) }),
      );

      expect(screen.getByText("overview.description")).toBeInTheDocument();
    });
  });

  describe("Scenario 2.5: Async Server Component contract", () => {
    it("is an async server component (returns a Promise)", () => {
      const result = ProductsPage({ params: Promise.resolve(mockParams) });
      expect(result).toBeInstanceOf(Promise);
    });

    it("handles zh locale", async () => {
      await renderAsyncComponent(
        ProductsPage({ params: Promise.resolve({ locale: "zh" }) }),
      );

      expect(
        screen.getByTestId("market-card-north-america"),
      ).toBeInTheDocument();
    });
  });
});
