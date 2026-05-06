import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { createApiErrorResponse } from "@/lib/api/api-response";
import { createLeadSuccessPayload } from "@/lib/api/lead-route-response";
import { safeParseJson } from "@/lib/api/safe-parse-json";
import {
  withRateLimit,
  type RateLimitContext,
} from "@/lib/api/with-rate-limit";
import { validateContactSubmissionPayload } from "@/lib/contact-form-processing";
import { submitCanonicalContactSubmission } from "@/lib/contact/submit-canonical-contact";
import { logger, sanitizeIP } from "@/lib/logger";
import { API_ERROR_CODES } from "@/constants/api-error-codes";
import { HTTP_BAD_REQUEST, HTTP_INTERNAL_ERROR } from "@/constants";

function createSubmissionErrorResponse(errorCode: string, status?: number) {
  return createApiErrorResponse(
    errorCode as (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES],
    status ?? HTTP_BAD_REQUEST,
  );
}

async function handleContactPost(
  request: NextRequest,
  { clientIP }: RateLimitContext,
): Promise<NextResponse> {
  const parsedBody = await safeParseJson<Record<string, unknown>>(request, {
    route: "/api/contact",
  });

  if (!parsedBody.ok) {
    return createApiErrorResponse(parsedBody.errorCode, parsedBody.statusCode);
  }

  const payloadValidation = validateContactSubmissionPayload(parsedBody.data);
  if (!payloadValidation.success) {
    return createSubmissionErrorResponse(
      payloadValidation.errorCode,
      payloadValidation.statusCode,
    );
  }

  try {
    const submission = await submitCanonicalContactSubmission(parsedBody.data, {
      clientIP,
    });

    if (!submission.success) {
      return createSubmissionErrorResponse(
        submission.errorCode,
        submission.statusCode,
      );
    }

    const { referenceId } = submission.submissionResult;
    if (!referenceId) {
      throw new Error("referenceId missing on successful contact submission");
    }

    return NextResponse.json(createLeadSuccessPayload(referenceId));
  } catch (error) {
    logger.error("Contact route submission failed unexpectedly", {
      error: error instanceof Error ? error.message : "Unknown error",
      ip: sanitizeIP(clientIP),
    });

    return createApiErrorResponse(
      API_ERROR_CODES.CONTACT_PROCESSING_ERROR,
      HTTP_INTERNAL_ERROR,
    );
  }
}

const POST_RATE_LIMITED = withRateLimit("contact", handleContactPost);

export function POST(request: NextRequest) {
  return POST_RATE_LIMITED(request);
}
