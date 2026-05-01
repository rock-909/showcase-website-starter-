import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HeroSection } from "@/components/sections/hero-section";
import { HOMEPAGE_SECTION_LINKS } from "@/components/sections/homepage-section-links";

async function renderAsyncComponent(
  asyncComponent: React.JSX.Element | Promise<React.JSX.Element>,
) {
  const resolvedElement = await Promise.resolve(asyncComponent);
  return render(resolvedElement);
}

describe("HeroSection", () => {
  it("renders without crashing", async () => {
    await renderAsyncComponent(HeroSection());
    expect(screen.getByTestId("hero-section")).toBeInTheDocument();
  });

  it("renders the h1 heading with translation key", async () => {
    await renderAsyncComponent(HeroSection());
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("hero.title");
  });

  it("renders eyebrow text", async () => {
    await renderAsyncComponent(HeroSection());
    expect(screen.getByText("hero.eyebrow")).toBeInTheDocument();
  });

  it("renders subtitle", async () => {
    await renderAsyncComponent(HeroSection());
    expect(screen.getByText("hero.subtitle")).toBeInTheDocument();
  });

  it("renders primary CTA as a link to /contact", async () => {
    await renderAsyncComponent(HeroSection());
    const primaryLink = screen.getByText("hero.cta.primary").closest("a");
    expect(primaryLink).toHaveAttribute("href", HOMEPAGE_SECTION_LINKS.contact);
  });

  it("renders secondary CTA as a link to /products", async () => {
    await renderAsyncComponent(HeroSection());
    const secondaryLink = screen.getByText("hero.cta.secondary").closest("a");
    expect(secondaryLink).toHaveAttribute(
      "href",
      HOMEPAGE_SECTION_LINKS.products,
    );
  });

  it("user sees proof list showing establishment, countries, range, and production data", async () => {
    await renderAsyncComponent(HeroSection());

    const proofList = screen.getByRole("list", {
      name: "Homepage proof facts",
    });
    const proofItems = within(proofList).getAllByRole("listitem");

    expect(proofItems).toHaveLength(4);
    expect(within(proofList).getByText("hero.proof.est")).toBeInTheDocument();
    expect(
      within(proofList).getByText("hero.proof.estLabel"),
    ).toBeInTheDocument();
    expect(
      within(proofList).getByText("hero.proof.countries"),
    ).toBeInTheDocument();
    expect(
      within(proofList).getByText("hero.proof.countriesLabel"),
    ).toBeInTheDocument();
    expect(within(proofList).getByText("hero.proof.range")).toBeInTheDocument();
    expect(
      within(proofList).getByText("hero.proof.rangeLabel"),
    ).toBeInTheDocument();
    expect(
      within(proofList).getByText("hero.proof.production"),
    ).toBeInTheDocument();
    expect(
      within(proofList).getByText("hero.proof.productionLabel"),
    ).toBeInTheDocument();
  });
});
