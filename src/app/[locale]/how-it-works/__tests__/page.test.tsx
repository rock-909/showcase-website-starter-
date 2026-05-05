import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import HowItWorksPage from "../page";

const translationValues = {
  eyebrow: "howItWorks.eyebrow",
  title: "howItWorks.title",
  description: "howItWorks.description",
  stepLabel: "Step 1",
  "steps.0.title": "howItWorks.steps.0.title",
  "steps.0.description": "howItWorks.steps.0.description",
  "steps.1.title": "howItWorks.steps.1.title",
  "steps.1.description": "howItWorks.steps.1.description",
  "steps.2.title": "howItWorks.steps.2.title",
  "steps.2.description": "howItWorks.steps.2.description",
  "steps.3.title": "howItWorks.steps.3.title",
  "steps.3.description": "howItWorks.steps.3.description",
  "steps.4.title": "howItWorks.steps.4.title",
  "steps.4.description": "howItWorks.steps.4.description",
} as const;

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => (key: string) => {
    return translationValues[key as keyof typeof translationValues] ?? key;
  }),
  setRequestLocale: vi.fn(),
}));

vi.mock("@/lib/seo-metadata", () => ({
  generateMetadataForPath: vi.fn(() => ({
    title: "howItWorks.title",
    description: "howItWorks.description",
  })),
}));

describe("HowItWorksPage", () => {
  it("renders the setup to launch flow from translations", async () => {
    const page = await HowItWorksPage({
      params: Promise.resolve({ locale: "en" }),
    });

    render(page);

    expect(
      screen.getByRole("heading", { level: 1, name: "howItWorks.title" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
    expect(screen.getByText("howItWorks.steps.0.title")).toBeInTheDocument();
    expect(
      screen.getByText("howItWorks.steps.4.description"),
    ).toBeInTheDocument();
  });
});
