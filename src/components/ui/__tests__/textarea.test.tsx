import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Textarea } from "@/components/ui/textarea";

describe("Textarea", () => {
  it("renders inside the Radix form-control surface", () => {
    render(<Textarea placeholder="Message" />);

    const textarea = screen.getByPlaceholderText("Message");
    const surface = textarea.closest(
      "[data-ui-pilot='radix-themes-form-control']",
    );

    expect(surface).toBeInTheDocument();
    expect(surface).toHaveClass("contents");
    expect(textarea).toHaveAttribute("data-slot", "textarea");
  });

  it("forwards native textarea attributes", () => {
    render(
      <Textarea
        id="message"
        name="message"
        placeholder="Message"
        rows={6}
        required
        disabled
        aria-describedby="message-help"
      />,
    );

    const textarea = screen.getByPlaceholderText("Message");
    expect(textarea).toHaveAttribute("id", "message");
    expect(textarea).toHaveAttribute("name", "message");
    expect(textarea).toHaveAttribute("rows", "6");
    expect(textarea).toBeRequired();
    expect(textarea).toBeDisabled();
    expect(textarea).toHaveAttribute("aria-describedby", "message-help");
  });

  it("supports typing and change events", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(<Textarea onChange={handleChange} placeholder="Message" />);

    const textarea = screen.getByPlaceholderText("Message");
    await user.type(textarea, "Need a quote");

    expect(textarea).toHaveValue("Need a quote");
    expect(handleChange).toHaveBeenCalled();
  });
});
