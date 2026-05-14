/**
 * @vitest-environment jsdom
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../dropdown-menu";

describe("DropdownMenu", () => {
  it("opens menu content from the trigger and renders a menu item", async () => {
    const user = userEvent.setup();

    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open language menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>English</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    expect(screen.queryByRole("menuitem", { name: "English" })).toBeNull();

    await user.click(
      screen.getByRole("button", { name: "Open language menu" }),
    );

    await waitFor(() => {
      expect(
        screen.getByRole("menuitem", { name: "English" }),
      ).toBeInTheDocument();
    });
  });

  it("supports keyboard opening and menu item focus", async () => {
    const user = userEvent.setup();

    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Choose language</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>English</DropdownMenuItem>
          <DropdownMenuItem>简体中文</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    await user.tab();
    expect(
      screen.getByRole("button", { name: "Choose language" }),
    ).toHaveFocus();

    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(screen.getByRole("menu")).toBeInTheDocument();
    });

    expect(screen.getByRole("menuitem", { name: "English" })).toHaveFocus();
  });
});
