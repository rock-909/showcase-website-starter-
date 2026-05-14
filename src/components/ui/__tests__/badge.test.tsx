import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { Badge } from "@/components/ui/badge";

describe("Badge", () => {
  it("renders as a span inside the Radix Themes badge pilot surface", () => {
    render(
      <Badge data-testid="badge">
        <svg aria-hidden="true" data-testid="badge-icon" />
        Ready
      </Badge>,
    );

    const badge = screen.getByTestId("badge");
    expect(badge.tagName).toBe("SPAN");
    expect(badge).toHaveAttribute("data-slot", "badge");
    expect(badge.closest("[data-ui-pilot]")).toHaveAttribute(
      "data-ui-pilot",
      "radix-themes-badge",
    );
    expect(badge).toHaveTextContent("Ready");
    expect(badge).toContainElement(screen.getByTestId("badge-icon"));
  });

  it.each(["default", "secondary", "destructive", "outline"] as const)(
    "keeps the local badge contract for the %s variant",
    (variant) => {
      render(<Badge variant={variant}>Variant</Badge>);

      const badge = screen.getByText("Variant");
      expect(badge).toHaveAttribute("data-slot", "badge");
      expect(badge.closest("[data-ui-pilot]")).toHaveAttribute(
        "data-ui-pilot",
        "radix-themes-badge",
      );
    },
  );

  it("merges custom classes and forwards span attributes", () => {
    render(
      <Badge
        id="status-badge"
        className="custom-spacing"
        data-testid="badge"
        role="status"
        aria-label="Status indicator"
      >
        Active
      </Badge>,
    );

    const badge = screen.getByTestId("badge");
    expect(badge).toHaveAttribute("id", "status-badge");
    expect(badge).toHaveAttribute("role", "status");
    expect(badge).toHaveAttribute("aria-label", "Status indicator");
    expect(badge).toHaveClass("custom-spacing");
  });

  it("forwards refs to the badge span", () => {
    const ref = createRef<HTMLSpanElement>();

    render(<Badge ref={ref}>Ref badge</Badge>);

    expect(ref.current).toBeInstanceOf(HTMLSpanElement);
    expect(ref.current).toHaveAttribute("data-slot", "badge");
  });
});
