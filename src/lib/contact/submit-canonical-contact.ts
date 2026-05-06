import {
  processFormSubmission,
  type ContactFormWithToken,
  validateContactSubmission,
} from "@/lib/contact-form-processing";

export interface CanonicalContactSubmissionOptions {
  clientIP: string;
  requestId?: string;
}

export interface CanonicalContactSubmissionFailure {
  success: false;
  errorCode: string;
  error: string;
  details: string[] | null;
  data: null;
  statusCode?: number;
}

export interface CanonicalContactSubmissionSuccess {
  success: true;
  error: null;
  details: null;
  data: ContactFormWithToken;
  submissionResult: {
    success?: boolean;
    emailSent: boolean;
    recordCreated: boolean;
    referenceId?: string | null | undefined;
    errorCode?: string | undefined;
  };
}

export type CanonicalContactSubmissionResult =
  | CanonicalContactSubmissionFailure
  | CanonicalContactSubmissionSuccess;

/**
 * Canonical contact submission core.
 *
 * Adapter layers (Server Action / API route) keep ownership of request parsing,
 * rate limiting, and observability. Validation and lead pipeline submission
 * live here so both adapters converge on one business path.
 */
export async function submitCanonicalContactSubmission(
  body: unknown,
  options: CanonicalContactSubmissionOptions,
): Promise<CanonicalContactSubmissionResult> {
  const validation = await validateContactSubmission(body, options.clientIP);
  if (!validation.success || !validation.data) {
    return {
      success: false,
      errorCode: validation.errorCode,
      error: validation.error,
      details: validation.details,
      data: null,
      ...(validation.statusCode ? { statusCode: validation.statusCode } : {}),
    };
  }

  const submissionResult = await processFormSubmission(validation.data, {
    ...(options.requestId ? { requestId: options.requestId } : {}),
  });

  return {
    success: true,
    error: null,
    details: null,
    data: validation.data,
    submissionResult,
  };
}
