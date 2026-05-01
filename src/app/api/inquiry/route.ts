/**
 * Product Inquiry API Route
 * Handles product-specific inquiries via product page drawer
 */

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
import { recordApiResponseSignal } from "@/lib/observability/api-signals";
import { readAndHashJsonBody } from "@/lib/api/read-and-hash-body";
import { isRuntimeProduction } from "@/lib/env";
import {
  withRateLimit,
  type RateLimitContext,
} from "@/lib/api/with-rate-limit";
import { createRequestFingerprint, withIdempotency } from "@/lib/idempotency";
import { processLead, type LeadResult } from "@/lib/lead-pipeline";
import {
  LEAD_TYPES,
  productLeadSchema,
  type ProductLeadInput,
} from "@/lib/lead-pipeline/lead-schema";
import { logger, sanitizeIP } from "@/lib/logger";
import { API_ERROR_CODES } from "@/constants/api-error-codes";
import { HTTP_BAD_REQUEST, HTTP_INTERNAL_ERROR } from "@/constants";

interface InquiryResponseContext {
  clientIP: string;
  processingTime: number;
  observability: ReturnType<typeof getRequestObservability>;
}

function createSuccessPayload(
  result: LeadResult,
  context: InquiryResponseContext,
) {
  const { clientIP, processingTime, observability } = context;
  if (!isRuntimeProduction()) {
    logger.info("Product inquiry submitted successfully", {
      referenceId: result.referenceId,
      ip: sanitizeIP(clientIP),
      processingTime,
      emailSent: result.emailSent,
      recordCreated: result.recordCreated,
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
 * Create error response for failed inquiry
 */
function createErrorResponse(
  result: LeadResult,
  context: InquiryResponseContext,
): NextResponse {
  const { clientIP, processingTime, observability } = context;
  logger.warn(
    result.partialSuccess
      ? "Product inquiry submission partially completed"
      : "Product inquiry submission failed",
    {
      error: result.error,
      ip: sanitizeIP(clientIP),
      processingTime,
      partialSuccess: result.partialSuccess,
      referenceId: result.referenceId,
      ...withObservabilityContext(observability),
    },
  );

  return createLeadFailureResponse({
    result,
    validationErrorCode: API_ERROR_CODES.INQUIRY_VALIDATION_FAILED,
    partialSuccessErrorCode: API_ERROR_CODES.INQUIRY_PARTIAL_SUCCESS,
    processingErrorCode: API_ERROR_CODES.INQUIRY_PROCESSING_ERROR,
  });
}

function validateLeadData(
  data: Record<string, unknown>,
): ProductLeadInput | null {
  const parsed = productLeadSchema.safeParse({
    type: LEAD_TYPES.PRODUCT,
    fullName: data.fullName,
    productSlug: data.productSlug,
    productName: data.productName,
    quantity: data.quantity,
    requirements: data.requirements,
    email: data.email,
    company: data.company,
    marketingConsent: data.marketingConsent,
  });

  return parsed.success ? parsed.data : null;
}

/**
 * POST /api/inquiry
 * Handle product inquiry form submission
 */
const POST_RATE_LIMITED = withRateLimit(
  "inquiry",
  async (request: NextRequest, { clientIP }: RateLimitContext) => {
    const observability = getRequestObservability(request, "lead-family");
    const parsedBody = await readAndHashJsonBody<{
      turnstileToken?: string;
      [key: string]: unknown;
    }>(request, { route: "/api/inquiry" });

    if (!parsedBody.ok) {
      return createApiErrorResponse(
        parsedBody.errorCode,
        parsedBody.statusCode,
      );
    }
    return withIdempotency(
      request,
      async () => {
        const startTime = Date.now();

        try {
          const data = parsedBody.data ?? {};
          const leadData = validateLeadData(data);
          if (!leadData) {
            return createApiErrorResponse(
              API_ERROR_CODES.INQUIRY_VALIDATION_FAILED,
              HTTP_BAD_REQUEST,
            );
          }

          const turnstileError = await validateLeadTurnstileToken({
            token:
              typeof data.turnstileToken === "string"
                ? data.turnstileToken
                : undefined,
            clientIP,
            missingTokenErrorCode: API_ERROR_CODES.INQUIRY_SECURITY_REQUIRED,
            invalidTokenErrorCode: API_ERROR_CODES.INQUIRY_SECURITY_FAILED,
            missingTokenLogMessage: "Product inquiry missing Turnstile token",
            invalidTokenLogMessage:
              "Product inquiry Turnstile verification failed",
          });
          if (turnstileError) return turnstileError;

          const result = await processLead(
            {
              ...leadData,
            },
            { requestId: observability.requestId },
          );
          const processingTime = Date.now() - startTime;
          const responseContext = {
            clientIP,
            processingTime,
            observability,
          };

          return result.success
            ? createSuccessPayload(result, responseContext)
            : createErrorResponse(result, responseContext);
        } catch (error) {
          logger.error("Product inquiry submission failed unexpectedly", {
            error: error instanceof Error ? error.message : "Unknown error",
            stack: error instanceof Error ? error.stack : undefined,
            ip: sanitizeIP(clientIP),
            processingTime: Date.now() - startTime,
            ...withObservabilityContext(observability),
          });

          return createApiErrorResponse(
            API_ERROR_CODES.INQUIRY_PROCESSING_ERROR,
            HTTP_INTERNAL_ERROR,
          );
        }
      },
      {
        required: true,
        fingerprint: createRequestFingerprint(request, parsedBody.bodyHash),
      },
    );
  },
);

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
    name: "inquiry.post",
    route: "/api/inquiry",
    latencyMs: Date.now() - startTime,
  });
  return enrichedResponse;
}

/**
 * OPTIONS /api/inquiry
 * Handle CORS preflight requests
 */
export function OPTIONS(request: NextRequest) {
  return createCorsPreflightResponse(request);
}
