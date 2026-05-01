/**
 * @vitest-environment jsdom
 */

/**
 * Card Structure & Accessibility Tests - Advanced
 *
 * 高级卡片结构和可访问性测试，专注于复杂场景：
 * - 高级可访问性特性
 * - 复杂结构组合
 * - 特殊交互场景
 * 基础功能测试请参考 card-structure-accessibility-core.test.tsx
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../card";

describe("Card Structure & Accessibility Tests - Advanced", () => {
  describe("高级可访问性特性", () => {
    it("supports ARIA attributes", () => {
      render(
        <Card aria-labelledby="card-title" aria-describedby="card-description">
          <CardHeader>
            <CardTitle id="card-title">Card with ARIA</CardTitle>
            <CardDescription id="card-description">
              Description for screen readers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p>Content with proper labeling</p>
          </CardContent>
        </Card>,
      );

      const card = screen.getByLabelText("Card with ARIA");
      expect(card).toHaveAttribute("aria-describedby", "card-description");
    });

    it("supports keyboard navigation", () => {
      render(
        <Card tabIndex={0}>
          <CardHeader>
            <CardTitle>Keyboard Navigation Card</CardTitle>
          </CardHeader>
          <CardContent>
            <button>Focusable Button</button>
          </CardContent>
        </Card>,
      );

      const card = screen
        .getByText("Keyboard Navigation Card")
        .closest('[tabindex="0"]');
      const button = screen.getByText("Focusable Button");

      expect(card).toBeInTheDocument();
      expect(button).toBeInTheDocument();
    });
  });

  describe("高级国际化支持", () => {
    it("supports internationalization", () => {
      render(
        <Card lang="es" dir="ltr">
          <CardHeader>
            <CardTitle>Tarjeta en Español</CardTitle>
            <CardDescription>Esta es una tarjeta en español</CardDescription>
          </CardHeader>
        </Card>,
      );

      const card = screen
        .getByText("Tarjeta en Español")
        .closest('[lang="es"]');
      expect(card).toHaveAttribute("dir", "ltr");
    });
  });
});
