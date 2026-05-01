"use client";

import { useCallback, useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { ThemeSwitcherHighlight } from "@/components/ui/theme-switcher-highlight";

const themes = [
  {
    key: "system",
    icon: Monitor,
    label: "System theme",
  },
  {
    key: "light",
    icon: Sun,
    label: "Light theme",
  },
  {
    key: "dark",
    icon: Moon,
    label: "Dark theme",
  },
];

export type ThemeSwitcherProps = React.HTMLAttributes<HTMLDivElement> & {
  className?: string;
};

export const ThemeSwitcher = ({ className, ...rest }: ThemeSwitcherProps) => {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const dataTestId = (rest as Record<string, unknown>)["data-testid"] as
    | string
    | undefined;

  const handleThemeClick = useCallback(
    (themeKey: "light" | "dark" | "system") => {
      setTheme(themeKey);
    },
    [setTheme],
  );

  // 使用 useEffect 确保只在客户端渲染后才显示组件
  // 这是 next-themes 推荐的模式，用于避免 SSR 水合不匹配
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- next-themes official pattern for SSR hydration safety
    setMounted(true);
  }, []);

  // 服务端和客户端首次渲染都返回骨架屏，避免水合不匹配
  if (!mounted) {
    return (
      <div
        className={cn(
          "relative isolate flex h-8 rounded-full bg-background p-1 ring-1 ring-border",
          className,
        )}
        {...rest}
        data-testid={dataTestId ?? "theme-toggle"}
      >
        {themes.map(({ key, icon: Icon, label }) => (
          <button
            aria-label={label}
            className="relative h-6 w-6 rounded-full"
            key={key}
            type="button"
            disabled
          >
            <Icon className="relative z-10 m-auto h-4 w-4 text-muted-foreground" />
          </button>
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative isolate flex h-8 rounded-full bg-background p-1 ring-1 ring-border",
        className,
      )}
      {...rest}
      data-testid={dataTestId ?? "theme-toggle"}
    >
      {themes.map(({ key, icon: Icon, label }) => {
        const isActive = theme === key;

        return (
          <button
            aria-label={label}
            className="relative h-6 w-6 rounded-full"
            key={key}
            onClick={() => handleThemeClick(key as "light" | "dark" | "system")}
            type="button"
          >
            {isActive ? <ThemeSwitcherHighlight /> : null}
            <Icon
              className={cn(
                "relative z-10 m-auto h-4 w-4",
                isActive ? "text-foreground" : "text-muted-foreground",
              )}
            />
          </button>
        );
      })}
    </div>
  );
};
