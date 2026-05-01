import { after } from "next/server";

import {
  LEAD_TYPES,
  type ContactLeadInput,
} from "@/lib/lead-pipeline/lead-schema";
import { retryAsync } from "@/lib/lead-pipeline/retry-async";
import { settleService } from "@/lib/lead-pipeline/settle-service";
import type { ServiceResult } from "@/lib/lead-pipeline/service-result";
import { splitName } from "@/lib/lead-pipeline/utils";
import { CONTACT_FORM_CONFIG } from "@/config/contact-form-config";
import { logger, sanitizeEmail } from "@/lib/logger";

export async function processContactLead(
  lead: ContactLeadInput,
  referenceId: string,
): Promise<{ emailResult: ServiceResult; crmResult: ServiceResult }> {
  const { firstName, lastName } = splitName(lead.fullName);

  // Lazy import to avoid circular dependencies
  const { resendService } = await import("@/lib/resend");
  const { airtableService } = await import("@/lib/airtable");

  const emailData = {
    firstName,
    lastName,
    email: lead.email,
    company: lead.company ?? "",
    subject: lead.subject,
    message: lead.message,
    submittedAt: lead.submittedAt || new Date().toISOString(),
    marketingConsent: lead.marketingConsent,
  };

  const [emailResult, crmResult] = await Promise.all([
    settleService(resendService.sendContactFormEmail(emailData), {
      operationName: "Email send",
      mapId: (id) => id,
    }),
    settleService(
      airtableService.createLead(LEAD_TYPES.CONTACT, {
        firstName,
        lastName,
        email: lead.email,
        company: lead.company,
        subject: lead.subject,
        message: lead.message,
        marketingConsent: lead.marketingConsent,
        referenceId,
      }),
      {
        operationName: "CRM record",
        mapId: (record) => record?.id,
      },
    ),
  ]);

  // Send confirmation email if enabled (fire-and-forget with retry, non-blocking)
  if (CONTACT_FORM_CONFIG.features.sendConfirmationEmail) {
    const maxRetries = 2;
    after(async () => {
      try {
        await retryAsync(() => resendService.sendConfirmationEmail(emailData), {
          maxRetries,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        logger.error("Confirmation email failed after retries (non-blocking)", {
          error: errorMessage,
          email: sanitizeEmail(lead.email),
          retries: maxRetries,
        });
      }
    });
  }

  return { emailResult, crmResult };
}
