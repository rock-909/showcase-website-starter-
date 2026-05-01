import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { createApiErrorResponse } from "@/lib/api/api-response";
import {
  applyCorsHeaders,
  createCorsPreflightResponse,
} from "@/lib/api/cors-utils";
import {
  createLeadFailureResponse,
  createLeadSuccessPayload,
  requireLeadReferenceId,
  validateLeadTurnstileToken,
} from "@/lib/api/lead-route-response";
import {
  applyRequestObservability,
  getRequestObservability,
  withObservabilityContext,
} from "@/lib/api/request-observability";
import { isRuntimeProduction } from "@/lib/env";
import { recordApiResponseSignal } from "@/lib/observability/api-signals";
import { readAndHashJsonBody } from "@/lib/api/read-and-hash-body";
import {
  withRateLimit,
  type RateLimitContext,
} from "@/lib/api/with-rate-limit";
import { createRequestFingerprint, withIdempotency } from "@/lib/idempotency";
import { processLead, type LeadResult } from "@/lib/lead-pipeline";
import {
  LEAD_TYPES,
  newsletterLeadSchema,
} from "@/lib/lead-pipeline/lead-schema";
import { logger, sanitizeEmail } from "@/lib/logger";
import { HTTP_BAD_REQUEST } from "@/constants";
import { API_ERROR_CODES } from "@/constants/api-error-codes";

/**
 * Create success response for newsletter subscription
 */
function createSuccessResponse(
  result: LeadResult,
  email: string,
  observability: ReturnType<typeof getRequestObservability>,
) {
  if (!isRuntimeProduction()) {
    logger.info("Newsletter subscription successful", {
      referenceId: result.referenceId,
      email: sanitizeEmail(email),
      ...withObservabilityContext(observability),
    });
  }

  return createLeadSuccessPayload(
    requireLeadReferenceId(
      result,
      "referenceId missing on successful lead result",
    ),
  );
}

/**
 * Create error response for failed subscription
 */
function createErrorResponse(
  result: LeadResult,
  observability: ReturnType<typeof getRequestObservability>,
): NextResponse {
  logger.warn(
    result.partialSuccess
      ? "Newsletter subscription partially completed"
      : "Newsletter subscription failed",
    {
      error: result.error,
      partialSuccess: result.partialSuccess,
      referenceId: result.referenceId,
      ...withObservabilityContext(observability),
    },
  );

  return createLeadFailureResponse({
    result,
    validationErrorCode: API_ERROR_CODES.SUBSCRIBE_VALIDATION_EMAIL_INVALID,
    partialSuccessErrorCode: API_ERROR_CODES.SUBSCRIBE_PARTIAL_SUCCESS,
    processingErrorCode: API_ERROR_CODES.SUBSCRIBE_PROCESSING_ERROR,
  });
}

/**
 * Handle subscription form submission
 */
function handlePost(
  request: NextRequest,
  { clientIP }: RateLimitContext,
): Promise<NextResponse> {
  return (async () => {
    const observability = getRequestObservability(request, "lead-family");
    const parsedBody = await readAndHashJsonBody<{
      email?: unknown;
      pageType?: string;
      turnstileToken?: string;
    }>(request, { route: "/api/subscribe" });

    if (!parsedBody.ok) {
      return createApiErrorResponse(
        parsedBody.errorCode,
        parsedBody.statusCode,
      );
    }

    return withIdempotency(
      request,
      async () => {
        const email = parsedBody.data?.email;
        const turnstileToken = parsedBody.data?.turnstileToken;

        if (email === undefined || email === "") {
          return createApiErrorResponse(
            API_ERROR_CODES.SUBSCRIBE_VALIDATION_EMAIL_REQUIRED,
            HTTP_BAD_REQUEST,
          );
        }

        const leadValidation = newsletterLeadSchema.safeParse({
          type: LEAD_TYPES.NEWSLETTER,
          email,
        });
        if (!leadValidation.success) {
          return createApiErrorResponse(
            API_ERROR_CODES.SUBSCRIBE_VALIDATION_EMAIL_INVALID,
            HTTP_BAD_REQUEST,
          );
        }

        const turnstileError = await validateLeadTurnstileToken({
          token: turnstileToken,
          clientIP,
          missingTokenErrorCode: API_ERROR_CODES.SUBSCRIBE_SECURITY_REQUIRED,
          invalidTokenErrorCode: API_ERROR_CODES.SUBSCRIBE_SECURITY_FAILED,
          missingTokenLogMessage:
            "Newsletter subscription missing Turnstile token",
          invalidTokenLogMessage: "Newsletter Turnstile verification failed",
        });
        if (turnstileError) return turnstileError;

        // Process via unified Lead Pipeline
        const result = await processLead(leadValidation.data, {
          requestId: observability.requestId,
        });

        return result.success
          ? createSuccessResponse(
              result,
              leadValidation.data.email,
              observability,
            )
          : createErrorResponse(result, observability);
      },
      {
        required: true,
        fingerprint: createRequestFingerprint(request, parsedBody.bodyHash),
      },
    );
  })();
}

const POST_RATE_LIMITED = withRateLimit("subscribe", handlePost);

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const observability = getRequestObservability(request, "lead-family");
  const response = await POST_RATE_LIMITED(request);
  const enrichedResponse = applyRequestObservability(
    applyCorsHeaders({ request, response }),
    observability,
  );
  await recordApiResponseSignal({
    context: observability,
    response: enrichedResponse,
    name: "subscribe.post",
    route: "/api/subscribe",
    latencyMs: Date.now() - startTime,
  });
  return enrichedResponse;
}

// 处理 OPTIONS 请求 (CORS)
export function OPTIONS(request: NextRequest) {
  return createCorsPreflightResponse(request);
}
