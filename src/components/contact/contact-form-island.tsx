"use client";

import { useEffect, useState, type ReactNode } from "react";

import {
  ContactFormIslandView,
  type ContactFormComponent,
  type ContactFormLoadState,
} from "@/components/contact/contact-form-island-view";

interface LoadedContactForm {
  Component: ContactFormComponent;
}

interface ContactFormIslandProps {
  errorMessage: string;
  fallback: ReactNode;
  retryLabel: string;
}

const defaultLoadContactForm = async (): Promise<LoadedContactForm> => {
  const contactFormModule =
    await import("@/components/forms/contact-form-container");
  return { Component: contactFormModule.ContactFormContainer };
};

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

  return (
    <ContactFormIslandView
      errorMessage={errorMessage}
      fallback={fallback}
      retryLabel={retryLabel}
      loadState={loadState}
      onRetry={() => setLoadAttempt((attempt) => attempt + 1)}
    />
  );
}
