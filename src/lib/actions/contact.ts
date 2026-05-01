"use server";

/**
 * Server Actions 统一入口文件
 * 提供基础的 Server Actions 架构模式，包含错误处理、类型安全和日志记录机制
 *
 * @description React 19 Server Actions 基础设施
 * @version 1.0.0
 */
import { headers } from "next/headers";
import { type ContactFormData } from "@/lib/form-schema/contact-form-schema";
import { isRuntimeProduction } from "@/lib/env";
import { logger } from "@/lib/logger";
import { checkDistributedRateLimit } from "@/lib/security/distributed-rate-limit";
import { API_ERROR_CODES } from "@/constants/api-error-codes";
import { getClientIPFromHeaders } from "@/lib/security/client-ip";
import { hmacKey } from "@/lib/security/rate-limit-key-strategies";
import {
  createCanonicalContactFingerprint,
  submitCanonicalContactSubmission,
} from "@/lib/contact/submit-canonical-contact";
import {
  createErrorResultWithLogging,
  createPartialResultWithLogging,
  createSuccessResultWithLogging,
  getFormDataBoolean,
  getFormDataString,
  withErrorHandling,
  type ServerAction,
  type ServerActionResult,
} from "@/lib/server-action-utils";
import { withIdempotentResult } from "@/lib/idempotency";

/**
 * 联系表单提交结果类型
 */
export interface ContactFormResult {
  /** 邮件是否发送成功 */
  emailSent: boolean;
  /** 记录是否创建成功 */
  recordCreated: boolean;
  /** 统一线索引用ID */
  referenceId?: string | null;
  /** 是否为部分成功 */
  partialSuccess?: boolean | undefined;
}

/**
 * 扩展的联系表单数据类型，包含Turnstile token
 */
export interface ContactFormWithToken extends ContactFormData {
  /** Turnstile验证token */
  turnstileToken: string;
  /** 提交时间戳 */
  submittedAt: string;
  /** 幂等键 */
  idempotencyKey?: string;
}

/**
 * Extract contact form data from FormData
 */
function extractContactFormData(formData: FormData): ContactFormWithToken {
  return {
    firstName: getFormDataString(formData, "firstName"),
    lastName: getFormDataString(formData, "lastName"),
    email: getFormDataString(formData, "email"),
    company: getFormDataString(formData, "company"),
    phone: getFormDataString(formData, "phone"),
    subject: getFormDataString(formData, "subject"),
    message: getFormDataString(formData, "message"),
    acceptPrivacy: getFormDataBoolean(formData, "acceptPrivacy"),
    marketingConsent: getFormDataBoolean(formData, "marketingConsent"),
    turnstileToken: getFormDataString(formData, "turnstileToken"),
    submittedAt: getFormDataString(formData, "submittedAt"),
    idempotencyKey: getFormDataString(formData, "idempotencyKey"),
  };
}

/**
 * Perform rate limit check before expensive processing.
 */
async function performRateLimitCheck(
  clientIP: string,
): Promise<ServerActionResult<ContactFormResult> | null> {
  const rateLimitKey = `ip:${await hmacKey(clientIP)}`;
  const rateLimitResult = await checkDistributedRateLimit(
    rateLimitKey,
    "contact",
  );
  if (!rateLimitResult.allowed) {
    return createErrorResultWithLogging(
      {
        code: API_ERROR_CODES.RATE_LIMIT_EXCEEDED,
        message: "Too many requests",
      },
      undefined,
      logger,
    );
  }

  return null;
}

/**
 * Perform idempotent-safe checks (honeypot only).
 * Returns early result if blocked, null to continue processing.
 */
function performHoneypotCheck(
  formData: FormData,
): ServerActionResult<ContactFormResult> | null {
  const honeypot = getFormDataString(formData, "website");
  if (honeypot) {
    return createSuccessResultWithLogging(
      {
        emailSent: false,
        recordCreated: false,
        referenceId: null,
      } satisfies ContactFormResult,
      "Thank you for your message.",
      logger,
    );
  }

  return null;
}

async function executeContactSubmissionAttempt(
  contactData: ContactFormWithToken,
  clientIP: string,
  startTime: number,
): Promise<ServerActionResult<ContactFormResult>> {
  if (!contactData.turnstileToken) {
    return createErrorResultWithLogging(
      {
        code: API_ERROR_CODES.TURNSTILE_MISSING_TOKEN,
        message: "Security verification required",
      },
      undefined,
      logger,
    );
  }

  const submission = await submitCanonicalContactSubmission(contactData, {
    clientIP,
  });
  if (!submission.success) {
    return createErrorResultWithLogging(
      {
        code: submission.errorCode ?? API_ERROR_CODES.CONTACT_VALIDATION_FAILED,
        message: submission.error || "Validation failed",
      },
      submission.details || undefined,
      logger,
    );
  }

  const { submissionResult } = submission;
  const normalizedSubmissionResult: ContactFormResult = {
    emailSent: submissionResult.emailSent,
    recordCreated: submissionResult.recordCreated,
    referenceId: submissionResult.referenceId ?? null,
    ...(submissionResult.partialSuccess ? { partialSuccess: true } : {}),
  };

  if (submissionResult.partialSuccess) {
    return createPartialResultWithLogging(
      normalizedSubmissionResult,
      submissionResult.errorCode ?? API_ERROR_CODES.CONTACT_PARTIAL_SUCCESS,
      logger,
    );
  }

  const processingTime = performance.now() - startTime;
  if (!isRuntimeProduction()) {
    logger.info("Contact form submitted via Server Action", {
      processingTime,
      emailSent: normalizedSubmissionResult.emailSent,
      recordCreated: normalizedSubmissionResult.recordCreated,
      referenceId: normalizedSubmissionResult.referenceId,
    });
  }

  return createSuccessResultWithLogging(
    normalizedSubmissionResult,
    "Thank you for your message. We will get back to you soon.",
    logger,
  );
}
/**
 * 联系表单 Server Action
 * 处理联系表单提交，集成Zod验证、Turnstile验证和现有的业务逻辑
 *
 * @example
 * ```typescript
 * // 在组件中使用
 * const [state, formAction, isPending] = useActionState(contactFormAction, null);
 *
 * return (
 *   <form action={formAction}>
 *     <input name="firstName" required />
 *     <input name="lastName" required />
 *     <input name="email" type="email" required />
 *     <button disabled={isPending} type="submit">
 *       {isPending ? 'Submitting...' : 'Submit'}
 *     </button>
 *   </form>
 * );
 * ```
 */
export const contactFormAction: ServerAction<FormData, ContactFormResult> =
  withErrorHandling(async (_previousState, formData) => {
    const startTime = performance.now();

    try {
      // Extract client IP for rate limiting and Turnstile verification
      const headersList = await headers();
      const clientIP = getClientIPFromHeaders(headersList);

      // 提取表单数据
      const contactData = extractContactFormData(formData);
      if (!contactData.idempotencyKey) {
        const rateLimitResult = await performRateLimitCheck(clientIP);
        if (rateLimitResult) {
          return rateLimitResult;
        }
      }

      const idempotentResult = await withIdempotentResult(
        contactData.idempotencyKey ?? null,
        async () => {
          const rateLimitResult = await performRateLimitCheck(clientIP);
          if (rateLimitResult) {
            return rateLimitResult;
          }

          const honeypotResult = performHoneypotCheck(formData);
          if (honeypotResult) {
            return honeypotResult;
          }

          return executeContactSubmissionAttempt(
            contactData,
            clientIP,
            startTime,
          );
        },
        {
          required: true,
          fingerprint: createCanonicalContactFingerprint(contactData),
        },
      );

      if (idempotentResult.ok) {
        return idempotentResult.result;
      }

      switch (idempotentResult.reason) {
        case "missing":
          return createErrorResultWithLogging(
            {
              code: API_ERROR_CODES.IDEMPOTENCY_KEY_REQUIRED,
              message: "Idempotency key required",
            },
            undefined,
            logger,
          );
        case "reused":
          return createErrorResultWithLogging(
            {
              code: API_ERROR_CODES.IDEMPOTENCY_KEY_REUSED,
              message: "Idempotency key reused",
            },
            undefined,
            logger,
          );
        case "timeout":
          return createErrorResultWithLogging(
            {
              code: API_ERROR_CODES.IDEMPOTENCY_REQUEST_TIMEOUT,
              message: "Request timeout",
            },
            undefined,
            logger,
          );
        case "failed":
        default:
          return createErrorResultWithLogging(
            {
              code: API_ERROR_CODES.IDEMPOTENCY_REQUEST_FAILED,
              message: "Request failed",
            },
            undefined,
            logger,
          );
      }
    } catch (error) {
      const processingTime = performance.now() - startTime;
      logger.error("Contact form Server Action failed", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        processingTime,
      });

      return createErrorResultWithLogging(
        {
          code: API_ERROR_CODES.CONTACT_PROCESSING_ERROR,
          message: "An unexpected error occurred. Please try again later.",
        },
        undefined,
        logger,
      );
    }
  });
