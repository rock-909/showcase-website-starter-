import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CapabilitiesPage from "../page";

const translationValues = {
  eyebrow: "capabilities.eyebrow",
  title: "capabilities.title",
  description: "capabilities.description",
  "items.0.title": "capabilities.items.0.title",
  "items.0.description": "capabilities.items.0.description",
  "items.1.title": "capabilities.items.1.title",
  "items.1.description": "capabilities.items.1.description",
  "items.2.title": "capabilities.items.2.title",
  "items.2.description": "capabilities.items.2.description",
  "items.3.title": "capabilities.items.3.title",
  "items.3.description": "capabilities.items.3.description",
  "items.4.title": "capabilities.items.4.title",
  "items.4.description": "capabilities.items.4.description",
  "items.5.title": "capabilities.items.5.title",
  "items.5.description": "capabilities.items.5.description",
} as const;

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => (key: string) => {
    return translationValues[key as keyof typeof translationValues] ?? key;
  }),
  setRequestLocale: vi.fn(),
}));

vi.mock("@/lib/seo-metadata", () => ({
  generateMetadataForPath: vi.fn(() => ({
    title: "capabilities.title",
    description: "capabilities.description",
  })),
}));

describe("CapabilitiesPage", () => {
  it("renders the public capabilities story from translations", async () => {
    const page = await CapabilitiesPage({
      params: Promise.resolve({ locale: "en" }),
    });

    render(page);

    expect(
      screen.getByRole("heading", { level: 1, name: "capabilities.title" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(6);
    expect(screen.getByText("capabilities.items.0.title")).toBeInTheDocument();
    expect(
      screen.getByText("capabilities.items.5.description"),
    ).toBeInTheDocument();
  });
});
