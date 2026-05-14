import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { StatusCallout } from "@/components/ui/status-callout";

describe("StatusCallout", () => {
  it("renders error tone as an assertive alert inside the named Radix surface", () => {
    render(
      <StatusCallout tone="error" title="Submission failed">
        Please check the form and try again.
      </StatusCallout>,
    );

    const callout = screen.getByRole("alert");

    expect(callout).toHaveAttribute("aria-live", "assertive");
    expect(callout).toHaveAttribute("data-slot", "status-callout");
    expect(screen.getByText("Submission failed")).toBeInTheDocument();
    expect(
      screen.getByText("Please check the form and try again."),
    ).toBeInTheDocument();
    expect(
      callout.closest("[data-ui-pilot='radix-themes-status-callout']"),
    ).toHaveClass("contents");
  });

  it.each([
    ["success", "Saved successfully"],
    ["info", "We are preparing the form"],
  ] as const)("renders %s tone as a polite status", (tone, message) => {
    render(<StatusCallout tone={tone}>{message}</StatusCallout>);

    const callout = screen.getByRole("status");

    expect(callout).toHaveAttribute("aria-live", "polite");
    expect(callout).toHaveTextContent(message);
  });

  it("forwards refs to the root HTMLDivElement", () => {
    const ref = createRef<HTMLDivElement>();

    render(<StatusCallout ref={ref}>Forwarded ref body</StatusCallout>);

    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    expect(ref.current).toHaveAttribute("data-slot", "status-callout");
  });
});
