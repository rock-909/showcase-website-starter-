import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  DataCard,
  DataCardContent,
  DataCardDescription,
  DataCardHeader,
  DataCardTitle,
} from "@/components/ui/data-card";

describe("DataCard", () => {
  it("renders named slots inside the Radix Themes data-card pilot surface", () => {
    render(
      <DataCard data-testid="data-card">
        <DataCardHeader>
          <DataCardTitle>Specification surface</DataCardTitle>
          <DataCardDescription>
            Buyer-facing specification summary
          </DataCardDescription>
        </DataCardHeader>
        <DataCardContent>Table or definition list content</DataCardContent>
      </DataCard>,
    );

    const card = screen.getByTestId("data-card");
    expect(card).toHaveAttribute("data-slot", "data-card");
    expect(card.closest("[data-ui-pilot]")).toHaveAttribute(
      "data-ui-pilot",
      "radix-themes-data-card",
    );
    expect(
      card.closest("[data-ui-pilot='radix-themes-data-card']"),
    ).toHaveClass("contents");
    expect(
      screen.getByText("Specification surface").closest("[data-slot]"),
    ).toHaveAttribute("data-slot", "data-card-title");
    expect(
      screen
        .getByText("Buyer-facing specification summary")
        .closest("[data-slot]"),
    ).toHaveAttribute("data-slot", "data-card-description");
    expect(
      screen
        .getByText("Table or definition list content")
        .closest("[data-slot]"),
    ).toHaveAttribute("data-slot", "data-card-content");
    expect(
      screen.getByText("Specification surface").closest("[data-slot]")
        ?.parentElement,
    ).toHaveAttribute("data-slot", "data-card-header");
  });

  it("passes through className, role, and aria attributes on the root card", () => {
    render(
      <DataCard
        aria-label="Technical data"
        className="custom-data-card"
        data-testid="data-card"
        role="region"
      >
        <DataCardContent>Content</DataCardContent>
      </DataCard>,
    );

    const card = screen.getByRole("region", { name: "Technical data" });
    expect(card).toHaveClass("custom-data-card");
    expect(card).toHaveAttribute("data-testid", "data-card");
  });

  it("passes through attributes and custom classes on child slots", () => {
    render(
      <DataCard>
        <DataCardHeader aria-label="Header slot" className="header-class">
          <DataCardTitle className="title-class">Data title</DataCardTitle>
          <DataCardDescription className="description-class">
            Data description
          </DataCardDescription>
        </DataCardHeader>
        <DataCardContent className="content-class" data-testid="content">
          Content
        </DataCardContent>
      </DataCard>,
    );

    expect(screen.getByLabelText("Header slot")).toHaveClass("header-class");
    expect(screen.getByText("Data title")).toHaveClass("title-class");
    expect(screen.getByText("Data description")).toHaveClass(
      "description-class",
    );
    expect(screen.getByTestId("content")).toHaveClass("content-class");
  });
});
