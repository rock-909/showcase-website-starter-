import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Input } from "@/components/ui/input";

describe("Input", () => {
  it("renders textual inputs inside the Radix form-control surface", () => {
    render(<Input placeholder="Enter text here" data-testid="input" />);

    const input = screen.getByPlaceholderText("Enter text here");
    const surface = input.closest(
      "[data-ui-pilot='radix-themes-form-control']",
    );

    expect(surface).toBeInTheDocument();
    expect(input).toHaveAttribute("data-slot", "input");
    expect(surface).toHaveClass("contents");
  });

  it.each([
    ["email", "textbox"],
    ["password", null],
    ["number", "spinbutton"],
    ["search", "searchbox"],
    ["tel", "textbox"],
    ["url", "textbox"],
    ["file", null],
  ] as const)("passes through type=%s", (type, role) => {
    render(<Input type={type} data-testid="input" />);

    const input = role ? screen.getByRole(role) : screen.getByTestId("input");
    expect(input).toHaveAttribute("type", type);
  });

  it("merges custom classes and forwards input attributes", () => {
    render(
      <Input
        id="test-input"
        name="testName"
        className="custom-input"
        value="test value"
        maxLength={50}
        required
        readOnly
        data-testid="input"
      />,
    );

    const input = screen.getByTestId("input");
    expect(input).toHaveAttribute("id", "test-input");
    expect(input).toHaveAttribute("name", "testName");
    expect(input).toHaveValue("test value");
    expect(input).toHaveAttribute("maxlength", "50");
    expect(input).toBeRequired();
    expect(input).toHaveAttribute("readonly");

    const surface = input.closest(
      "[data-ui-pilot='radix-themes-form-control']",
    );
    expect(surface).toBeInTheDocument();
    expect(surface?.querySelector(".custom-input")).toBeInTheDocument();
  });

  it("emits user input and keyboard/focus events", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    const handleFocus = vi.fn();
    const handleBlur = vi.fn();
    const handleKeyDown = vi.fn();

    render(
      <Input
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      />,
    );

    const input = screen.getByRole("textbox");
    await user.type(input, "test");
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.blur(input);

    expect(input).toHaveValue("test");
    expect(handleChange).toHaveBeenCalled();
    expect(handleFocus).toHaveBeenCalled();
    expect(handleKeyDown).toHaveBeenCalled();
    expect(handleBlur).toHaveBeenCalled();
  });

  it("keeps disabled inputs non-interactive", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    const handleFocus = vi.fn();

    render(<Input disabled onChange={handleChange} onFocus={handleFocus} />);

    const input = screen.getByRole("textbox");
    await user.click(input);
    await user.type(input, "test");

    expect(input).toBeDisabled();
    expect(handleChange).not.toHaveBeenCalled();
    expect(handleFocus).not.toHaveBeenCalled();
  });

  it("supports file input styling and change events", () => {
    const handleChange = vi.fn();
    const file = new File(["test"], "test.txt", { type: "text/plain" });

    render(
      <Input type="file" onChange={handleChange} data-testid="file-input" />,
    );

    const input = screen.getByTestId("file-input");
    fireEvent.change(input, { target: { files: [file] } });

    expect(
      input.closest("[data-ui-pilot='radix-themes-form-control']"),
    ).toBeNull();
    expect(input).toHaveAttribute("data-slot", "input");
    expect(input).toHaveClass(
      "h-10",
      "rounded-xl",
      "border",
      "file:inline-flex",
      "file:h-7",
      "file:text-foreground",
      "file:font-medium",
    );
    expect(handleChange).toHaveBeenCalled();
  });
});
