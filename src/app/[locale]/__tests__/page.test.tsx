import React from "react";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Home, { generateStaticParams } from "../page";

// Mock all section components
vi.mock("@/components/sections/hero-section", () => ({
  HeroSection: () => <div data-testid="hero-section">Hero</div>,
}));

vi.mock("@/components/sections/chain-section", () => ({
  ChainSection: () => <div data-testid="chain-section">Chain</div>,
}));

vi.mock("@/components/sections/products-section", () => ({
  ProductsSection: () => <div data-testid="products-section">Products</div>,
}));

vi.mock("@/components/sections/resources-section", () => ({
  ResourcesSection: () => <div data-testid="resources-section">Resources</div>,
}));

vi.mock("@/components/sections/sample-cta", () => ({
  SampleCTA: () => <div data-testid="sample-cta">Sample CTA</div>,
}));

vi.mock("@/components/sections/scenarios-section", () => ({
  ScenariosSection: () => <div data-testid="scenarios-section">Scenarios</div>,
}));

vi.mock("@/components/sections/quality-section", () => ({
  QualitySection: () => <div data-testid="quality-section">Quality</div>,
}));

vi.mock("@/components/sections/final-cta", () => ({
  FinalCTA: () => <div data-testid="final-cta">Final CTA</div>,
}));

vi.mock("@/i18n/routing", () => ({
  routing: {
    locales: ["en", "zh"],
    defaultLocale: "en",
  },
}));

vi.mock("@/components/seo", () => ({
  JsonLdGraphScript: () => <script type="application/ld+json" />,
  JsonLdScript: () => <script type="application/ld+json" />,
}));

describe("Home Page", () => {
  describe("generateStaticParams", () => {
    it("should return params for all locales", () => {
      const params = generateStaticParams();
      expect(params).toEqual([{ locale: "en" }, { locale: "zh" }]);
    });
  });

  describe("Home Component", () => {
    it("should render all section components", async () => {
      const HomeComponent = await Home({
        params: Promise.resolve({ locale: "en" }),
      });

      const { getByTestId } = render(HomeComponent);

      expect(getByTestId("hero-section")).toBeInTheDocument();
      expect(getByTestId("chain-section")).toBeInTheDocument();
      expect(getByTestId("products-section")).toBeInTheDocument();
      expect(getByTestId("resources-section")).toBeInTheDocument();
      expect(getByTestId("sample-cta")).toBeInTheDocument();
      expect(getByTestId("scenarios-section")).toBeInTheDocument();
      expect(getByTestId("quality-section")).toBeInTheDocument();
      expect(getByTestId("final-cta")).toBeInTheDocument();
    });

    it("should have correct container classes", async () => {
      const HomeComponent = await Home({
        params: Promise.resolve({ locale: "en" }),
      });

      const { container } = render(HomeComponent);
      const mainDiv = container.firstChild as HTMLElement;
      expect(mainDiv).toHaveClass(
        "min-h-screen",
        "bg-background",
        "text-foreground",
      );
    });

    it("should be an async server component", async () => {
      const result = Home({ params: Promise.resolve({ locale: "en" }) });
      expect(result).toBeInstanceOf(Promise);
    });

    it("should handle delayed params resolution", async () => {
      const delayedParams = new Promise<{ locale: "en" | "zh" }>((resolve) =>
        setTimeout(() => resolve({ locale: "en" }), 10),
      );

      const HomeComponent = await Home({ params: delayedParams });
      expect(HomeComponent).toBeDefined();
    });

    it("should handle params rejection", async () => {
      const rejectedParams = Promise.reject(new Error("Params error"));

      await expect(Home({ params: rejectedParams })).rejects.toThrow(
        "Params error",
      );
    });
  });
});
