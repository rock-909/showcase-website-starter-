import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { logger } from "@/lib/logger-core";
import { generateIdempotencyKey } from "@/lib/idempotency-key";
import { appendAttributionToFormData } from "@/lib/utm";
import { useRateLimit } from "@/components/forms/use-rate-limit";
import {
  contactFormAction,
  type ContactFormResult,
} from "@/lib/actions/contact";
import { type FormSubmissionStatus } from "@/lib/forms/form-submission-status";
import { type ServerActionResult } from "@/lib/server-action-utils";

interface SubmitStatusInput {
  isPending: boolean;
  stateSuccess: boolean | undefined;
  stateError: string | undefined;
}

function computeSubmitStatus(input: SubmitStatusInput): FormSubmissionStatus {
  if (input.isPending) return "submitting";
  if (input.stateSuccess) return "success";
  if (input.stateError) return "error";
  return "idle";
}

export interface UseContactFormResult {
  state: ServerActionResult<ContactFormResult> | null;
  formAction: (formData: FormData) => void;
  isPending: boolean;
  submitStatus: FormSubmissionStatus;
  turnstileToken: string;
  setTurnstileToken: (token: string) => void;
  isRateLimited: boolean;
}

/**
 * 管理联系表单状态和提交流程。
 */
export function useContactForm(): UseContactFormResult {
  const [state, formAction, isPending] = useActionState(
    contactFormAction,
    null,
  );
  const [turnstileToken, setTurnstileToken] = useState<string>("");
  const idempotencyKeyRef = useRef<string | null>(null);
  const lastRecordedSuccessRef = useRef(false);
  const [isPendingTransition, startTransition] = useTransition();
  const isSubmitting = isPending || isPendingTransition;
  const { isRateLimited, setLastSubmissionTime } = useRateLimit();

  const submitStatus = computeSubmitStatus({
    isPending: isSubmitting,
    stateSuccess: state?.success,
    stateError: state?.error,
  });

  useEffect(() => {
    const isTerminal =
      Boolean(state?.success) ||
      Boolean(state?.error) ||
      Boolean(state?.errorCode);
    if (!isTerminal) return;

    if (state?.success && !lastRecordedSuccessRef.current) {
      queueMicrotask(() => {
        setLastSubmissionTime(new Date());
      });
    }

    idempotencyKeyRef.current = null;
    lastRecordedSuccessRef.current = Boolean(state?.success);
  }, [state?.success, state?.error, state?.errorCode, setLastSubmissionTime]);

  const enhancedFormAction = (formData: FormData) => {
    if (!turnstileToken) {
      logger.warn("Form submission attempted without Turnstile token");
      return;
    }

    formData.append("turnstileToken", turnstileToken);
    formData.append("submittedAt", new Date().toISOString());
    appendAttributionToFormData(formData);

    const idempotencyKey =
      idempotencyKeyRef.current ?? generateIdempotencyKey();
    idempotencyKeyRef.current = idempotencyKey;
    formData.append("idempotencyKey", idempotencyKey);

    startTransition(() => {
      formAction(formData);
    });
  };

  return {
    state,
    formAction: enhancedFormAction,
    isPending: isSubmitting,
    submitStatus,
    turnstileToken,
    setTurnstileToken,
    isRateLimited,
  };
}
