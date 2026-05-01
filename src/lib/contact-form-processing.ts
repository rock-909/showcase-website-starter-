/**
 * Contact Form Processing
 *
 * Shared form submission logic used by both Server Actions and API routes.
 */

import { z } from "zod";
import { processLead } from "@/lib/lead-pipeline/process-lead";
import { CONTACT_SUBJECTS, LEAD_TYPES } from "@/lib/lead-pipeline/lead-schema";
import { logger, sanitizeEmail } from "@/lib/logger";
import { contactFieldValidators } from "@/lib/form-schema/contact-field-validators";
import { verifyTurnstileDetailed } from "@/lib/turnstile";
import { mapZodIssueToErrorKey } from "@/lib/contact-form-error-utils";
import {
  CONTACT_FORM_CONFIG,
  type ContactFormFieldValues,
} from "@/config/contact-form-config";
import { createContactFormSchemaFromConfig } from "@/config/contact-form-validation";
import { HTTP_SERVICE_UNAVAILABLE } from "@/constants";
import { TEN_MINUTES_MS } from "@/constants/time";
import { API_ERROR_CODES } from "@/constants/api-error-codes";

const contactFormSchema = createContactFormSchemaFromConfig(
  CONTACT_FORM_CONFIG,
  contactFieldValidators,
);

const contactSubmissionSchema = contactFormSchema.extend({
  turnstileToken: z.string().min(1, "Security verification required"),
  submittedAt: z.string(),
});

export type ContactFormWithToken = ContactFormFieldValues & {
  turnstileToken: string;
  submittedAt: string;
  idempotencyKey?: string;
};

interface ContactValidationFailure {
  success: false;
  errorCode: string;
  error: string;
  details: string[] | null;
  data: null;
  statusCode?: number;
}

interface ContactValidationSuccess {
  success: true;
  error: null;
  details: null;
  data: ContactFormWithToken;
}

export type ContactValidationResult =
  | ContactValidationFailure
  | ContactValidationSuccess;

interface ProcessFormSubmissionOptions {
  requestId?: string;
}

export interface ProcessFormSubmissionResult {
  success: boolean;
  partialSuccess: boolean;
  emailSent: boolean;
  recordCreated: boolean;
  referenceId?: string | null | undefined;
  errorCode?: string | undefined;
}

function createExpiredSubmissionFailure(): ContactValidationFailure {
  return {
    success: false,
    errorCode: "CONTACT_SUBMISSION_EXPIRED",
    error: "Form submission expired or invalid",
    details: null,
    data: null,
  };
}

function validateSubmissionTime(
  submittedAt: string,
): ContactValidationFailure | null {
  const submittedAtMs = new Date(submittedAt).getTime();
  if (!submittedAt || isNaN(submittedAtMs)) {
    return createExpiredSubmissionFailure();
  }

  const timeDiff = Date.now() - submittedAtMs;
  if (timeDiff > TEN_MINUTES_MS || timeDiff < 0) {
    return createExpiredSubmissionFailure();
  }

  return null;
}

export async function validateContactSubmission(
  body: unknown,
  clientIP: string,
): Promise<ContactValidationResult> {
  if (
    !body ||
    typeof body !== "object" ||
    typeof (body as { turnstileToken?: unknown }).turnstileToken !== "string" ||
    (body as { turnstileToken: string }).turnstileToken.length === 0
  ) {
    return {
      success: false,
      errorCode: API_ERROR_CODES.TURNSTILE_MISSING_TOKEN,
      error: "Security verification required",
      details: null,
      data: null,
    };
  }

  const validationResult = contactSubmissionSchema.safeParse(body);

  if (!validationResult.success) {
    return {
      success: false,
      errorCode: API_ERROR_CODES.CONTACT_VALIDATION_FAILED,
      error: "Validation failed",
      details: validationResult.error.issues.map(mapZodIssueToErrorKey),
      data: null,
    };
  }

  const formData: ContactFormWithToken = validationResult.data;
  const timeValidationError = validateSubmissionTime(formData.submittedAt);
  if (timeValidationError) {
    return timeValidationError;
  }

  const verificationResult = await verifyTurnstileDetailed(
    formData.turnstileToken,
    clientIP,
  );

  if (!verificationResult.success) {
    const errorCodes = verificationResult.errorCodes ?? [];
    const isServiceFailure = errorCodes.some((code) =>
      ["not-configured", "network-error", "timeout"].includes(code),
    );

    return {
      success: false,
      errorCode: isServiceFailure
        ? API_ERROR_CODES.SERVICE_UNAVAILABLE
        : API_ERROR_CODES.TURNSTILE_VERIFICATION_FAILED,
      error: isServiceFailure
        ? "Security verification unavailable"
        : "Security verification failed",
      details: null,
      data: null,
      ...(isServiceFailure ? { statusCode: HTTP_SERVICE_UNAVAILABLE } : {}),
    };
  }

  return {
    success: true,
    error: null,
    details: null,
    data: formData,
  };
}

function mapSubjectToEnum(
  subject: string | undefined,
): (typeof CONTACT_SUBJECTS)[keyof typeof CONTACT_SUBJECTS] {
  if (!subject) return CONTACT_SUBJECTS.OTHER;

  const subjectLower = subject.toLowerCase();
  if (subjectLower.includes("product")) return CONTACT_SUBJECTS.PRODUCT_INQUIRY;
  if (subjectLower.includes("distributor")) return CONTACT_SUBJECTS.DISTRIBUTOR;
  if (
    subjectLower.includes("custom") ||
    subjectLower.includes("project") ||
    subjectLower.includes("configuration")
  ) {
    return CONTACT_SUBJECTS.CUSTOM_PROJECT;
  }
  return CONTACT_SUBJECTS.OTHER;
}

/**
 * Process a contact form submission via the unified Lead Pipeline.
 */
export async function processFormSubmission(
  formData: ContactFormWithToken,
  options: ProcessFormSubmissionOptions = {},
): Promise<ProcessFormSubmissionResult> {
  const fullName = [formData.firstName, formData.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  const leadInput = {
    type: LEAD_TYPES.CONTACT,
    fullName: fullName || formData.firstName || "Unknown",
    email: formData.email,
    company: formData.company,
    subject: mapSubjectToEnum(formData.subject),
    message: formData.message,
    turnstileToken: formData.turnstileToken,
    submittedAt: formData.submittedAt,
    marketingConsent: formData.marketingConsent ?? false,
  };

  const result = await processLead(leadInput, {
    ...(options.requestId ? { requestId: options.requestId } : {}),
  });

  if (result.success) {
    return {
      success: true,
      partialSuccess: false,
      emailSent: result.emailSent,
      recordCreated: result.recordCreated,
      referenceId: result.referenceId,
    };
  }

  if (result.partialSuccess && result.referenceId) {
    logger.warn("Contact form submission completed partially", {
      email: sanitizeEmail(formData.email),
      referenceId: result.referenceId,
      emailSent: result.emailSent,
      recordCreated: result.recordCreated,
      ...(options.requestId ? { requestId: options.requestId } : {}),
    });

    return {
      success: false,
      partialSuccess: true,
      emailSent: result.emailSent,
      recordCreated: result.recordCreated,
      referenceId: result.referenceId,
      errorCode: API_ERROR_CODES.CONTACT_PARTIAL_SUCCESS,
    };
  }

  logger.error("Contact form submission failed via processLead", {
    error: result.error,
    email: sanitizeEmail(formData.email),
    ...(options.requestId ? { requestId: options.requestId } : {}),
  });

  throw new Error("Failed to process form submission");
}
