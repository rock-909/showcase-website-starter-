import type { ComponentType, ReactNode } from "react";

import { Button } from "@/components/ui/button";

export type ContactFormComponent = ComponentType;

export type ContactFormLoadState =
  | { status: "loading" }
  | { status: "failed" }
  | { Component: ContactFormComponent; status: "loaded" };

export interface ContactFormIslandViewProps {
  errorMessage: string;
  fallback: ReactNode;
  retryLabel: string;
  loadState: ContactFormLoadState;
  onRetry: () => void;
}

export function ContactFormIslandView({
  errorMessage,
  fallback,
  retryLabel,
  loadState,
  onRetry,
}: ContactFormIslandViewProps) {
  if (loadState.status === "failed") {
    return (
      <div
        className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive"
        role="alert"
      >
        <p>{errorMessage}</p>
        <Button
          className="mt-4"
          onClick={onRetry}
          size="sm"
          type="button"
          variant="outline"
        >
          {retryLabel}
        </Button>
      </div>
    );
  }

  if (loadState.status === "loading") {
    return <>{fallback}</>;
  }

  const { Component: ContactFormComponent } = loadState;

  return <ContactFormComponent />;
}
