import {
  LEAD_TYPES,
  type ProductLeadInput,
} from "@/lib/lead-pipeline/lead-schema";
import { settleService } from "@/lib/lead-pipeline/settle-service";
import type { ServiceResult } from "@/lib/lead-pipeline/service-result";
import {
  generateProductInquiryMessage,
  splitName,
} from "@/lib/lead-pipeline/utils";

export async function processProductLead(
  lead: ProductLeadInput,
  referenceId: string,
): Promise<{ emailResult: ServiceResult; crmResult: ServiceResult }> {
  const { firstName, lastName } = splitName(lead.fullName);
  const message = generateProductInquiryMessage(
    lead.productName,
    lead.quantity,
    lead.requirements,
  );

  // Lazy import to avoid circular dependencies
  const { resendService } = await import("@/lib/resend");
  const { airtableService } = await import("@/lib/airtable");

  const [emailResult, crmResult] = await Promise.all([
    settleService(
      resendService.sendProductInquiryEmail({
        firstName,
        lastName,
        email: lead.email,
        company: lead.company,
        productName: lead.productName,
        productSlug: lead.productSlug,
        quantity: lead.quantity,
        requirements: lead.requirements,
        marketingConsent: lead.marketingConsent,
      }),
      {
        operationName: "Email send",
        mapId: (id) => id,
      },
    ),
    settleService(
      airtableService.createLead(LEAD_TYPES.PRODUCT, {
        firstName,
        lastName,
        email: lead.email,
        company: lead.company,
        message,
        productSlug: lead.productSlug,
        productName: lead.productName,
        quantity: lead.quantity,
        requirements: lead.requirements,
        marketingConsent: lead.marketingConsent,
        referenceId,
      }),
      {
        operationName: "CRM record",
        mapId: (record) => record?.id,
      },
    ),
  ]);

  return { emailResult, crmResult };
}
