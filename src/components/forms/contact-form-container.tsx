"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import { useFormStatus } from "react-dom";
import { API_ERROR_NAMESPACE } from "@/lib/api/translate-error-code";
import { LazyTurnstile } from "@/components/forms/lazy-turnstile";
import { useContactForm } from "@/components/forms/use-contact-form";
import {
  ErrorDisplay,
  StatusMessage,
} from "@/components/forms/contact-form-feedback";
import { FormFields } from "@/components/forms/contact-form-fields";
import { FORM_STATUS_CLASS_NAMES } from "@/components/forms/form-status-styles";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface SubmitButtonProps {
  disabled: boolean;
  idleLabel: string;
  pendingLabel: string;
}

function SubmitButton({
  disabled,
  idleLabel,
  pendingLabel,
}: SubmitButtonProps) {
  const { pending } = useFormStatus();
  const isDisabled = disabled || pending;

  return (
    <Button
      type="submit"
      className="w-full"
      disabled={isDisabled}
      aria-disabled={isDisabled}
      aria-busy={pending}
      data-testid="contact-form-submit-button"
      translate="no"
    >
      <span data-testid="contact-form-submit-label" translate="no">
        {pending ? pendingLabel : idleLabel}
      </span>
    </Button>
  );
}

/**
 * Main contact form container component
 */
export function ContactFormContainer() {
  const t = useTranslations("contact.form");
  const tApi = useTranslations(API_ERROR_NAMESPACE);
  const errorSummaryRef = useRef<HTMLDivElement | null>(null);
  const handleErrorDisplayRef = (node: HTMLDivElement | null) => {
    errorSummaryRef.current = node;

    if (node) {
      node.focus();
    }
  };
  const {
    state,
    formAction,
    isPending,
    submitStatus,
    turnstileToken,
    setTurnstileToken,
    isRateLimited,
  } = useContactForm();

  const submitDisabledReason = Boolean(
    isPending || !turnstileToken || isRateLimited,
  );

  return (
    <Card className="mx-auto w-full max-w-2xl">
      <form action={formAction} className="space-y-6 p-6" noValidate>
        <StatusMessage status={submitStatus} t={t} />

        <ErrorDisplay
          state={state}
          translateForm={t}
          translateApi={tApi}
          containerRef={handleErrorDisplayRef}
        />

        <FormFields t={t} isPending={isPending} />

        <LazyTurnstile
          onSuccess={setTurnstileToken}
          onError={() => setTurnstileToken("")}
          onExpire={() => setTurnstileToken("")}
          onLoad={() => setTurnstileToken("")}
        />

        <SubmitButton
          disabled={submitDisabledReason}
          idleLabel={t("submit")}
          pendingLabel={t("submitting")}
        />

        {isRateLimited && (
          <p
            className={`text-center text-sm ${FORM_STATUS_CLASS_NAMES.warningText}`}
            aria-live="polite"
          >
            {t("rateLimitMessage")}
          </p>
        )}
      </form>
    </Card>
  );
}
