import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  LEAD_TYPES,
  type ProductLeadInput,
} from "@/lib/lead-pipeline/lead-schema";
import { generateProductInquiryMessage } from "@/lib/lead-pipeline/utils";
import type { ServiceResult } from "@/lib/lead-pipeline/service-result";

const mockSendProductInquiryEmail = vi.hoisted(() => vi.fn());
const mockCreateLead = vi.hoisted(() => vi.fn());
const mockSettleService = vi.hoisted(() => vi.fn());

vi.mock("@/lib/resend", () => ({
  resendService: {
    sendProductInquiryEmail: mockSendProductInquiryEmail,
  },
}));

vi.mock("@/lib/airtable", () => ({
  airtableService: {
    createLead: mockCreateLead,
  },
}));

vi.mock("@/lib/lead-pipeline/settle-service", () => ({
  settleService: mockSettleService,
}));

const VALID_PRODUCT_LEAD: ProductLeadInput = {
  type: LEAD_TYPES.PRODUCT,
  fullName: "Jane Smith",
  email: "jane@example.com",
  productSlug: "showcase-plan-basic",
  productName: "Showcase Plan Basic",
  quantity: "500 units",
  company: "Example Company",
  requirements: "Brand adaptation needed",
  marketingConsent: true,
};

const REFERENCE_ID = "PRO-test-ref-001";

describe("processProductLead", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendProductInquiryEmail.mockResolvedValue("email-id-456");
    mockCreateLead.mockResolvedValue({ id: "record-456" });
    mockSettleService.mockImplementation(
      async (
        _promise: Promise<unknown>,
        options: {
          operationName: string;
          mapId?: (result: unknown) => string | undefined;
        },
      ): Promise<ServiceResult> => {
        if (options.operationName === "Email send") {
          return {
            success: true,
            id: options.mapId?.("email-id-456"),
            latencyMs: 75,
          };
        }

        return {
          success: true,
          id: options.mapId?.({ id: "record-456" }),
          latencyMs: 75,
        };
      },
    );
  });

  it("builds the product email payload and CRM payload from the lead", async () => {
    const { processProductLead } =
      await import("@/lib/lead-pipeline/processors/product");

    const result = await processProductLead(VALID_PRODUCT_LEAD, REFERENCE_ID);

    expect(mockSendProductInquiryEmail).toHaveBeenCalledWith({
      firstName: "Jane",
      lastName: "Smith",
      email: "jane@example.com",
      company: "Example Company",
      productName: "Showcase Plan Basic",
      productSlug: "showcase-plan-basic",
      quantity: "500 units",
      requirements: "Brand adaptation needed",
      marketingConsent: true,
    });

    expect(mockCreateLead).toHaveBeenCalledWith(LEAD_TYPES.PRODUCT, {
      firstName: "Jane",
      lastName: "Smith",
      email: "jane@example.com",
      company: "Example Company",
      message: generateProductInquiryMessage(
        VALID_PRODUCT_LEAD.productName,
        VALID_PRODUCT_LEAD.quantity,
        VALID_PRODUCT_LEAD.requirements,
      ),
      productSlug: "showcase-plan-basic",
      productName: "Showcase Plan Basic",
      quantity: "500 units",
      requirements: "Brand adaptation needed",
      marketingConsent: true,
      referenceId: REFERENCE_ID,
    });

    expect(result).toEqual({
      emailResult: expect.objectContaining({
        success: true,
        id: "email-id-456",
      }),
      crmResult: expect.objectContaining({ success: true, id: "record-456" }),
    });
  });

  it("passes settleService metadata that preserves email and CRM ids", async () => {
    const { processProductLead } =
      await import("@/lib/lead-pipeline/processors/product");
    const { settleService } =
      await import("@/lib/lead-pipeline/settle-service");

    await processProductLead(VALID_PRODUCT_LEAD, REFERENCE_ID);

    const settleCalls = vi.mocked(settleService).mock.calls;
    expect(settleCalls).toHaveLength(2);

    const [, emailOptions] = settleCalls[0]!;
    const [, crmOptions] = settleCalls[1]!;

    expect(emailOptions).toEqual(
      expect.objectContaining({
        operationName: "Email send",
      }),
    );
    expect(emailOptions?.mapId?.("email-id-456")).toBe("email-id-456");

    expect(crmOptions).toEqual(
      expect.objectContaining({
        operationName: "CRM record",
      }),
    );
    expect(crmOptions?.mapId?.({ id: "record-456" })).toBe("record-456");
    expect(
      crmOptions?.mapId?.(undefined as unknown as { id?: string }),
    ).toBeUndefined();
  });
});
