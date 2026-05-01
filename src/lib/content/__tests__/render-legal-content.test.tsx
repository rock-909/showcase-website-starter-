import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderLegalContent } from "@/lib/content/render-legal-content";

describe("renderLegalContent", () => {
  it("renders inline bold inside list items without literal markdown markers", () => {
    const { container } = render(
      <>{renderLegalContent("- **Email inquiries**: Response within 24 hours")}</>,
    );

    expect(screen.getByText("Email inquiries")).toHaveTextContent(
      "Email inquiries",
    );
    expect(container).not.toHaveTextContent("**");
  });
});
