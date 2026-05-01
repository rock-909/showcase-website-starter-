import { NextRequest, NextResponse } from "next/server";
import {
  createApiErrorResponse,
  createApiSuccessResponse,
} from "@/lib/api/api-response";
import {
  applyCorsHeaders,
  createCorsPreflightResponse,
} from "@/lib/api/cors-utils";
import { safeParseJson } from "@/lib/api/safe-parse-json";
import { env } from "@/lib/env";
import { logger, sanitizeIP } from "@/lib/logger";
import { getClientIP } from "@/lib/security/client-ip";
import {
  checkDistributedRateLimit,
  createRateLimitHeaders,
} from "@/lib/security/distributed-rate-limit";
import { getIPKey } from "@/lib/security/rate-limit-key-strategies";
import { verifyTurnstileDetailed } from "@/lib/turnstile";
import { API_ERROR_CODES } from "@/constants/api-error-codes";
import {
  HTTP_BAD_REQUEST,
  HTTP_INTERNAL_ERROR,
  HTTP_OK,
  HTTP_SERVICE_UNAVAILABLE,
  HTTP_TOO_MANY_REQUESTS,
} from "@/constants";

/**
 * Request body interface for Turnstile verification.
 *
 * SECURITY NOTE: Client IP is intentionally NOT accepted from request body.
 * The server MUST derive the client IP from trusted request headers
 * (X-Forwarded-For, X-Real-IP) to prevent IP spoofing attacks that could
 * bypass Turnstile's risk analysis.
 */
interface TurnstileVerificationRequest {
  token: string;
}

/**
 * Validate request body
 */
function validateRequestBody(body: TurnstileVerificationRequest) {
  if (!body.token) {
    return createApiErrorResponse(
      API_ERROR_CODES.TURNSTILE_MISSING_TOKEN,
      HTTP_BAD_REQUEST,
    );
  }
  return null;
}

/**
 * Create verification error response
 */
function createVerificationErrorResponse() {
  return createApiErrorResponse(
    API_ERROR_CODES.TURNSTILE_VERIFICATION_FAILED,
    HTTP_BAD_REQUEST,
  );
}

/**
 * Create network error response (503 Service Unavailable for upstream failures)
 */
function createNetworkErrorResponse(verifyError: Error, clientIP: string) {
  logger.error("Turnstile verification request failed", {
    error: verifyError,
    clientIP: sanitizeIP(clientIP),
  });
  return createApiErrorResponse(
    API_ERROR_CODES.TURNSTILE_NETWORK_ERROR,
    HTTP_SERVICE_UNAVAILABLE,
  );
}

/**
 * Check if Turnstile is configured
 */
function checkTurnstileConfigured(): NextResponse | null {
  if (!env.TURNSTILE_SECRET_KEY) {
    logger.error("Turnstile not configured - TURNSTILE_SECRET_KEY missing");
    return createApiErrorResponse(
      API_ERROR_CODES.TURNSTILE_NOT_CONFIGURED,
      HTTP_INTERNAL_ERROR,
    );
  }
  return null;
}

/**
 * Verify Cloudflare Turnstile token
 *
 * This endpoint verifies the Turnstile token on the server side
 * to ensure the user has passed the bot protection challenge.
 * Uses the shared verifyTurnstile function for consistency.
 */
// eslint-disable-next-line max-statements -- guardrail-exception GSE-20260428-turnstile-security-gates: security route keeps config/rate/parse/validate/verify/respond gates in request order
async function handlePost(request: NextRequest) {
  try {
    const configError = checkTurnstileConfigured();
    if (configError) return configError;

    let rateLimitResult: Awaited<ReturnType<typeof checkDistributedRateLimit>>;
    try {
      // Rate limiting: security-sensitive endpoint uses fail-closed preset
      const rateLimitKey = await getIPKey(request);
      rateLimitResult = await checkDistributedRateLimit(
        rateLimitKey,
        "turnstile",
      );
    } catch (rateLimitError) {
      logger.error("Turnstile rate limit infrastructure failure", {
        error: rateLimitError as Error,
      });
      return createApiErrorResponse(
        API_ERROR_CODES.SERVICE_UNAVAILABLE,
        HTTP_SERVICE_UNAVAILABLE,
      );
    }

    if (!rateLimitResult.allowed) {
      const rateLimitHeaders = createRateLimitHeaders(rateLimitResult);
      const statusCode =
        rateLimitResult.deniedReason === "storage_failure"
          ? HTTP_SERVICE_UNAVAILABLE
          : HTTP_TOO_MANY_REQUESTS;
      return NextResponse.json(
        {
          success: false,
          errorCode:
            rateLimitResult.deniedReason === "storage_failure"
              ? API_ERROR_CODES.SERVICE_UNAVAILABLE
              : API_ERROR_CODES.RATE_LIMIT_EXCEEDED,
        },
        { status: statusCode, headers: rateLimitHeaders },
      );
    }

    const parsedBody = await safeParseJson<TurnstileVerificationRequest>(
      request,
      { route: "/api/verify-turnstile" },
    );
    if (!parsedBody.ok) {
      return createApiErrorResponse(
        parsedBody.errorCode,
        parsedBody.statusCode,
      );
    }

    const validationError = validateRequestBody(parsedBody.data);
    if (validationError) return validationError;

    // SECURITY: Always use server-derived IP - never trust client-provided IP
    const clientIP = getClientIP(request);

    let verificationResult: { success: boolean; errorCodes?: string[] };
    try {
      verificationResult = await verifyTurnstileDetailed(
        parsedBody.data.token,
        clientIP,
      );
    } catch (verifyError) {
      return createNetworkErrorResponse(verifyError as Error, clientIP);
    }

    if (!verificationResult.success) {
      const isNetworkError = verificationResult.errorCodes?.some(
        (code) => code === "network-error" || code === "timeout",
      );
      if (isNetworkError) {
        logger.error("Turnstile verification network failure", {
          errorCodes: verificationResult.errorCodes,
          clientIP: sanitizeIP(clientIP),
        });
        return createApiErrorResponse(
          API_ERROR_CODES.TURNSTILE_NETWORK_ERROR,
          HTTP_SERVICE_UNAVAILABLE,
        );
      }
      return createVerificationErrorResponse();
    }

    return createApiSuccessResponse({ verified: true }, HTTP_OK);
  } catch (error) {
    logger.error("Error verifying Turnstile token", { error: error as Error });
    return createApiErrorResponse(
      API_ERROR_CODES.INTERNAL_SERVER_ERROR,
      HTTP_INTERNAL_ERROR,
    );
  }
}

export async function POST(request: NextRequest) {
  const response = await handlePost(request);
  return applyCorsHeaders({ request, response });
}

/**
 * Handle GET requests (for health checks)
 */
export function GET() {
  const isConfigured = Boolean(env.TURNSTILE_SECRET_KEY);

  return createApiSuccessResponse(
    {
      status: "Turnstile verification endpoint active",
      configured: isConfigured,
      timestamp: new Date().toISOString(),
    },
    HTTP_OK,
  );
}

/**
 * Only allow POST and GET methods
 */
export function OPTIONS(request: NextRequest) {
  return createCorsPreflightResponse(request, ["GET"]);
}
