"use client";

import { lazy, Suspense, useState, type ReactNode } from "react";

const MobileNavigationInteractive = lazy(() =>
  import("@/components/layout/mobile-navigation-interactive").then((mod) => ({
    default: mod.MobileNavigationInteractive,
  })),
);

const HeaderLanguageMenu = lazy(() =>
  import("@/components/layout/header-language-menu").then((mod) => ({
    default: mod.HeaderLanguageMenu,
  })),
);

const LANGUAGE_LABELS = {
  en: "English",
  zh: "简体中文",
} as const;

interface MobileNavigationIslandProps {
  children?: ReactNode;
  openMenuLabel?: string;
  closeMenuLabel?: string;
  languageLabel?: string;
}

interface LanguageToggleIslandProps {
  locale: "en" | "zh";
}

interface MobileNavigationFallbackProps {
  children?: ReactNode;
  onActivate: () => void;
  openMenuLabel: string;
}

function MobileNavigationFallback({
  children,
  onActivate,
  openMenuLabel,
}: MobileNavigationFallbackProps) {
  return (
    <details
      className="relative"
      data-testid="header-mobile-navigation-fallback"
    >
      <summary
        className="relative inline-flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-[6px] text-foreground transition-colors duration-150 hover:bg-accent [&::-webkit-details-marker]:hidden"
        aria-label={openMenuLabel}
        aria-controls="mobile-navigation"
        aria-haspopup="dialog"
        data-testid="header-mobile-menu-button"
        onClick={onActivate}
      >
        <svg
          aria-hidden="true"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            d="M4 7h16M4 12h16M4 17h16"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          />
        </svg>
        <span
          className="sr-only"
          data-testid="header-mobile-menu-label"
          translate="no"
        >
          {openMenuLabel}
        </span>
      </summary>
      {children ? (
        <div
          id="mobile-navigation"
          className="absolute right-0 top-full z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-lg"
          data-testid="header-mobile-navigation-fallback-panel"
        >
          {children}
        </div>
      ) : null}
    </details>
  );
}

export function MobileNavigationIsland({
  children,
  openMenuLabel = "Open navigation menu",
  closeMenuLabel = "Close navigation menu",
  languageLabel = "Language",
}: MobileNavigationIslandProps) {
  const [isActivated, setIsActivated] = useState(false);
  const fallback = (
    <MobileNavigationFallback
      openMenuLabel={openMenuLabel}
      onActivate={() => setIsActivated(true)}
    >
      {children}
    </MobileNavigationFallback>
  );

  if (isActivated) {
    return (
      <Suspense fallback={fallback}>
        <MobileNavigationInteractive
          initialOpen
          openMenuLabel={openMenuLabel}
          closeMenuLabel={closeMenuLabel}
          languageLabel={languageLabel}
        />
      </Suspense>
    );
  }

  return fallback;
}

export function LanguageToggleIsland({ locale }: LanguageToggleIslandProps) {
  const [isActivated, setIsActivated] = useState(false);
  const currentLanguageName = LANGUAGE_LABELS[locale];

  if (isActivated) {
    // Pass current locale down to avoid next-intl dependency in this island.
    return (
      <Suspense fallback={null}>
        <HeaderLanguageMenu initialOpen locale={locale} />
      </Suspense>
    );
  }

  return (
    <button
      type="button"
      className="notranslate inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-muted-foreground transition-colors duration-150 ease-out hover:bg-muted/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
      aria-label={currentLanguageName}
      aria-haspopup="menu"
      aria-expanded="false"
      data-testid="language-toggle-button"
      data-locale={locale}
      translate="no"
      onClick={() => setIsActivated(true)}
    >
      <svg
        aria-hidden="true"
        className="h-3.5 w-3.5 text-muted-foreground"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          d="M12 21a9 9 0 1 0 0-18m0 18a9 9 0 1 1 0-18m0 18c2.5-2.5 3.75-5.5 3.75-9S14.5 5.5 12 3m0 18c-2.5-2.5-3.75-5.5-3.75-9S9.5 5.5 12 3M3.6 9h16.8M3.6 15h16.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
      <span
        className="text-xs font-medium text-muted-foreground"
        data-testid="language-current-label"
        translate="no"
      >
        {currentLanguageName}
      </span>
      <svg
        aria-hidden="true"
        className="h-3.5 w-3.5 text-muted-foreground"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          d="M19 9l-7 7-7-7"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    </button>
  );
}
