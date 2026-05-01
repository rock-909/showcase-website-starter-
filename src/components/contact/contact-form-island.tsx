"use client";

import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

type ContactFormComponent = ComponentType;
interface LoadedContactForm {
  Component: ContactFormComponent;
}

interface ContactFormIslandProps {
  errorMessage: string;
  fallback: ReactNode;
  retryLabel: string;
}

const defaultLoadContactForm = async (): Promise<LoadedContactForm> => {
  const contactFormModule = await import("@/components/contact/contact-form");
  return { Component: contactFormModule.ContactForm };
};

type ContactFormLoadState =
  | { status: "loading" }
  | { status: "failed" }
  | { Component: ContactFormComponent; status: "loaded" };

function reportContactFormLoadError(error: unknown) {
  if (typeof globalThis.reportError !== "function") {
    return;
  }

  globalThis.reportError(
    error instanceof Error ? error : new Error("Contact form failed to load"),
  );
}

export function ContactFormIsland({
  errorMessage,
  fallback,
  retryLabel,
}: ContactFormIslandProps) {
  const [loadState, setLoadState] = useState<ContactFormLoadState>({
    status: "loading",
  });
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setLoadState((state) =>
        state.status === "loading" ? state : { status: "loading" },
      );
      const contactForm = await defaultLoadContactForm();
      if (isMounted) {
        setLoadState({ ...contactForm, status: "loaded" });
      }
    }

    load().catch((error: unknown) => {
      reportContactFormLoadError(error);
      if (isMounted) {
        setLoadState({ status: "failed" });
      }
    });

    return () => {
      isMounted = false;
    };
  }, [loadAttempt]);

  if (loadState.status === "failed") {
    return (
      <div
        className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive"
        role="alert"
      >
        <p>{errorMessage}</p>
        <Button
          className="mt-4"
          onClick={() => setLoadAttempt((attempt) => attempt + 1)}
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
