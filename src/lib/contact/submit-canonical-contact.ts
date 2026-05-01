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
    partialSuccess?: boolean;
    emailSent: boolean;
    recordCreated: boolean;
    referenceId?: string | null | undefined;
    errorCode?: string | undefined;
  };
}

export type CanonicalContactSubmissionResult =
  | CanonicalContactSubmissionFailure
  | CanonicalContactSubmissionSuccess;

/** MurmurHash2 mixing constant */
const MURMUR2_MULTIPLIER = 0x5bd1e995;
/** MurmurHash2 right-shift amount */
const MURMUR2_SHIFT = 13;
/** Radix for compact hash string encoding */
const HASH_RADIX = 36;

export function createCanonicalContactFingerprint(data: {
  email: string;
  message: string;
  submittedAt: string;
}): string {
  const payload = `${data.email}:${data.message}:${data.submittedAt}`;
  let hash = 0;
  for (let i = 0; i < payload.length; i++) {
    hash = Math.imul(hash ^ payload.charCodeAt(i), MURMUR2_MULTIPLIER);
    hash ^= hash >>> MURMUR2_SHIFT;
  }
  return `CONTACT:${(hash >>> 0).toString(HASH_RADIX)}`;
}

export function createCanonicalContactFingerprintFromUnknown(
  body: unknown,
): string | null {
  if (!body || typeof body !== "object") return null;
  const candidate = body as Record<string, unknown>;
  if (
    typeof candidate.email !== "string" ||
    typeof candidate.message !== "string" ||
    typeof candidate.submittedAt !== "string"
  ) {
    return null;
  }

  return createCanonicalContactFingerprint({
    email: candidate.email,
    message: candidate.message,
    submittedAt: candidate.submittedAt,
  });
}

/**
 * Canonical contact submission core.
 *
 * Adapter layers (Server Action / API route) keep ownership of request parsing,
 * rate limiting, idempotency transport, and observability. Validation + lead
 * pipeline submission live here so both adapters converge on one business path.
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
