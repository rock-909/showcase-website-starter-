/**
 * @vitest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Input } from "@/components/ui/input";

describe("Input - Props & Events", () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
  });

  describe("Custom Props", () => {
    it("applies custom className", () => {
      render(<Input className="custom-input" data-testid="input" />);

      const input = screen.getByTestId("input");
      expect(input).toHaveClass("custom-input");
      expect(input).toHaveClass("flex"); // Should still have default classes
    });

    it("supports custom id", () => {
      render(<Input id="custom-id" />);

      const input = screen.getByRole("textbox");
      expect(input).toHaveAttribute("id", "custom-id");
    });

    it("supports placeholder text", () => {
      render(<Input placeholder="Enter text here" />);

      const input = screen.getByPlaceholderText("Enter text here");
      expect(input).toBeInTheDocument();
    });

    it("supports default value", () => {
      render(<Input defaultValue="Default text" data-testid="input" />);

      const input = screen.getByTestId("input") as HTMLInputElement;
      expect(input.value).toBe("Default text");
    });

    it("supports controlled value", () => {
      const { rerender } = render(
        <Input value="Controlled" onChange={() => {}} data-testid="input" />,
      );

      let input = screen.getByTestId("input") as HTMLInputElement;
      expect(input.value).toBe("Controlled");

      rerender(
        <Input value="Updated" onChange={() => {}} data-testid="input" />,
      );
      input = screen.getByTestId("input") as HTMLInputElement;
      expect(input.value).toBe("Updated");
    });

    it("supports disabled state", () => {
      render(<Input disabled data-testid="input" />);

      const input = screen.getByTestId("input");
      expect(input).toBeDisabled();
    });

    it("supports readonly state", () => {
      render(<Input readOnly data-testid="input" />);

      const input = screen.getByTestId("input");
      expect(input).toHaveAttribute("readonly");
    });

    it("supports required attribute", () => {
      render(<Input required data-testid="input" />);

      const input = screen.getByTestId("input");
      expect(input).toBeRequired();
    });

    it("supports name attribute", () => {
      render(<Input name="username" data-testid="input" />);

      const input = screen.getByTestId("input");
      expect(input).toHaveAttribute("name", "username");
    });

    it("supports autoComplete attribute", () => {
      render(<Input autoComplete="email" data-testid="input" />);

      const input = screen.getByTestId("input");
      expect(input).toHaveAttribute("autocomplete", "email");
    });

    it("supports autoFocus attribute", () => {
      render(<Input autoFocus data-testid="input" />);

      const input = screen.getByTestId("input");
      expect(input).toHaveFocus();
    });

    it("supports tabIndex", () => {
      render(<Input tabIndex={5} data-testid="input" />);

      const input = screen.getByTestId("input");
      expect(input).toHaveAttribute("tabIndex", "5");
    });

    it("supports custom style", () => {
      const customStyle = { backgroundColor: "red", fontSize: "18px" };
      render(<Input style={customStyle} data-testid="input" />);

      const input = screen.getByTestId("input");
      expect(input).toHaveStyle("background-color: rgb(255, 0, 0)");
      expect(input).toHaveStyle("font-size: 18px");
    });

    it("supports data attributes", () => {
      render(<Input data-custom="value" data-testid="input" />);

      const input = screen.getByTestId("input");
      expect(input).toHaveAttribute("data-custom", "value");
    });

    it("supports aria attributes", () => {
      render(
        <Input
          aria-label="Custom input"
          aria-describedby="help-text"
          data-testid="input"
        />,
      );

      const input = screen.getByTestId("input");
      expect(input).toHaveAttribute("aria-label", "Custom input");
      expect(input).toHaveAttribute("aria-describedby", "help-text");
    });

    it("merges multiple classNames correctly", () => {
      render(<Input className="class1 class2" data-testid="input" />);

      const input = screen.getByTestId("input");
      expect(input).toHaveClass("class1", "class2", "flex");
    });

    it("handles undefined props gracefully", () => {
      render(
        <Input
          className={undefined}
          placeholder={undefined}
          data-testid="input"
        />,
      );

      const input = screen.getByTestId("input");
      expect(input).toBeInTheDocument();
    });

    it("supports form attribute", () => {
      render(<Input form="my-form" data-testid="input" />);

      const input = screen.getByTestId("input");
      expect(input).toHaveAttribute("form", "my-form");
    });

    it("supports size attribute for file inputs", () => {
      render(<Input type="file" size={10} data-testid="input" />);

      const input = screen.getByTestId("input");
      expect(input).toHaveAttribute("size", "10");
    });

    it("supports multiple attribute for file inputs", () => {
      render(<Input type="file" multiple data-testid="input" />);

      const input = screen.getByTestId("input");
      expect(input).toHaveAttribute("multiple");
    });

    it("supports accept attribute for file inputs", () => {
      render(<Input type="file" accept="image/*" data-testid="input" />);

      const input = screen.getByTestId("input");
      expect(input).toHaveAttribute("accept", "image/*");
    });
  });

  describe("Event Handling", () => {
    it("handles onChange events", async () => {
      const typeInputFixture = vi.fn();
      render(<Input onChange={typeInputFixture} data-testid="input" />);

      const input = screen.getByTestId("input");
      await user.type(input, "test");

      expect(typeInputFixture).toHaveBeenCalled();
      expect(typeInputFixture).toHaveBeenCalledTimes(4); // One for each character
    });

    it("handles onFocus events", async () => {
      const focusInputFixture = vi.fn();
      render(<Input onFocus={focusInputFixture} data-testid="input" />);

      const input = screen.getByTestId("input");
      await user.click(input);

      expect(focusInputFixture).toHaveBeenCalledTimes(1);
    });

    it("handles onBlur events", async () => {
      const blurInputFixture = vi.fn();
      render(<Input onBlur={blurInputFixture} data-testid="input" />);

      const input = screen.getByTestId("input");
      await user.click(input);
      await user.tab();

      expect(blurInputFixture).toHaveBeenCalledTimes(1);
    });

    it("handles onKeyDown events", async () => {
      const pressEnterFixture = vi.fn();
      render(<Input onKeyDown={pressEnterFixture} data-testid="input" />);

      const input = screen.getByTestId("input");
      input.focus();
      await user.keyboard("{Enter}");

      expect(pressEnterFixture).toHaveBeenCalled();
    });

    it("handles onKeyUp events", async () => {
      const releaseInputKeyFixture = vi.fn();
      render(<Input onKeyUp={releaseInputKeyFixture} data-testid="input" />);

      const input = screen.getByTestId("input");
      input.focus();
      await user.keyboard("a");

      expect(releaseInputKeyFixture).toHaveBeenCalled();
    });

    it("handles onKeyPress events", async () => {
      const pressInputKeyFixture = vi.fn();
      render(<Input onKeyPress={pressInputKeyFixture} data-testid="input" />);

      const input = screen.getByTestId("input");
      input.focus();
      await user.keyboard("a");

      expect(pressInputKeyFixture).toHaveBeenCalled();
    });

    it("handles _onClick events", async () => {
      const clickInputFixture = vi.fn();
      render(<Input onClick={clickInputFixture} data-testid="input" />);

      const input = screen.getByTestId("input");
      await user.click(input);

      expect(clickInputFixture).toHaveBeenCalledTimes(1);
    });

    it("handles onDoubleClick events", async () => {
      const doubleClickInputFixture = vi.fn();
      render(
        <Input onDoubleClick={doubleClickInputFixture} data-testid="input" />,
      );

      const input = screen.getByTestId("input");
      await user.dblClick(input);

      expect(doubleClickInputFixture).toHaveBeenCalledTimes(1);
    });

    it("handles mouse events", async () => {
      const hoverInputFixture = vi.fn();
      const unhoverInputFixture = vi.fn();

      render(
        <Input
          onMouseEnter={hoverInputFixture}
          onMouseLeave={unhoverInputFixture}
          data-testid="input"
        />,
      );

      const input = screen.getByTestId("input");

      await user.hover(input);
      expect(hoverInputFixture).toHaveBeenCalled();

      await user.unhover(input);
      expect(unhoverInputFixture).toHaveBeenCalled();
    });

    it("handles input events with correct values", async () => {
      const changeInputFixture = vi.fn();
      render(<Input onChange={changeInputFixture} data-testid="input" />);

      const input = screen.getByTestId("input");
      await user.type(input, "hello");

      const calls = changeInputFixture.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      // Check that the final value is correct
      const lastCall = calls[calls.length - 1];
      expect(lastCall?.[0]?.target?.value).toBe("hello");
    });

    it("prevents events when disabled", async () => {
      const disabledChangeFixture = vi.fn();
      const disabledClickFixture = vi.fn();

      render(
        <Input
          disabled
          onChange={disabledChangeFixture}
          onClick={disabledClickFixture}
          data-testid="input"
        />,
      );

      const input = screen.getByTestId("input");

      await user.click(input);
      expect(disabledClickFixture).not.toHaveBeenCalled();

      // Disabled inputs don'_t receive typing events
      await user.type(input, "test");
      expect(disabledChangeFixture).not.toHaveBeenCalled();
    });

    it("handles custom event handlers", async () => {
      const recordTypedValueFixture = vi.fn();

      render(
        <Input
          onChange={(e) => recordTypedValueFixture(e.target.value)}
          data-testid="input"
        />,
      );

      const input = screen.getByTestId("input");
      await user.type(input, "test");

      expect(recordTypedValueFixture).toHaveBeenCalledWith("t");
      expect(recordTypedValueFixture).toHaveBeenCalledWith("te");
      expect(recordTypedValueFixture).toHaveBeenCalledWith("tes");
      expect(recordTypedValueFixture).toHaveBeenCalledWith("test");
    });

    it("handles multiple event handlers", async () => {
      const recordPrimaryChangeFixture = vi.fn();
      const recordSecondaryChangeFixture = vi.fn();

      const MultiHandlerInput = () => {
        const changeBothInputFixtures = (
          e: React.ChangeEvent<HTMLInputElement>,
        ) => {
          recordPrimaryChangeFixture(e.target.value);
          recordSecondaryChangeFixture(e.target.value);
        };

        return <Input onChange={changeBothInputFixtures} data-testid="input" />;
      };

      render(<MultiHandlerInput />);

      const input = screen.getByTestId("input");
      await user.type(input, "a");

      expect(recordPrimaryChangeFixture).toHaveBeenCalledWith("a");
      expect(recordSecondaryChangeFixture).toHaveBeenCalledWith("a");
    });

    it("handles event propagation", async () => {
      const activateInputGroupFixture = vi.fn();
      const clickInputFixture = vi.fn();

      render(
        <section aria-label="Input group" onClick={activateInputGroupFixture}>
          <Input onClick={clickInputFixture} data-testid="input" />
        </section>,
      );

      const input = screen.getByTestId("input");
      await user.click(input);

      expect(clickInputFixture).toHaveBeenCalled();
      expect(activateInputGroupFixture).toHaveBeenCalled();
    });

    it("handles event prevention", async () => {
      const activateInputGroupFixture = vi.fn();
      const clickInputFixture = vi.fn((e: React.MouseEvent) => {
        e.stopPropagation();
      });

      render(
        <section aria-label="Input group" onClick={activateInputGroupFixture}>
          <Input onClick={clickInputFixture} data-testid="input" />
        </section>,
      );

      const input = screen.getByTestId("input");
      await user.click(input);

      expect(clickInputFixture).toHaveBeenCalled();
      expect(activateInputGroupFixture).not.toHaveBeenCalled();
    });
  });
});
