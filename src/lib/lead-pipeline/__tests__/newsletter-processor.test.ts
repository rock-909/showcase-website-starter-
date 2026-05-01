import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  LEAD_TYPES,
  type NewsletterLeadInput,
} from "@/lib/lead-pipeline/lead-schema";
import {
  DEFAULT_LATENCY,
  type ServiceResult,
} from "@/lib/lead-pipeline/service-result";

const mockCreateLead = vi.hoisted(() => vi.fn());
const mockSettleService = vi.hoisted(() => vi.fn());

vi.mock("@/lib/airtable", () => ({
  airtableService: {
    createLead: mockCreateLead,
  },
}));

vi.mock("@/lib/lead-pipeline/settle-service", () => ({
  settleService: mockSettleService,
}));

const VALID_NEWSLETTER_LEAD: NewsletterLeadInput = {
  type: LEAD_TYPES.NEWSLETTER,
  email: "subscriber@example.com",
};

const REFERENCE_ID = "NEW-test-ref-001";

describe("processNewsletterLead", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateLead.mockResolvedValue({ id: "record-789" });
    mockSettleService.mockImplementation(
      async (
        _promise: Promise<unknown>,
        options: {
          operationName: string;
          mapId?: (result: unknown) => string | undefined;
        },
      ): Promise<ServiceResult> => ({
        success: true,
        id: options.mapId?.({ id: "record-789" }),
        latencyMs: 50,
      }),
    );
  });

  it("creates the CRM record and returns the newsletter placeholder email failure", async () => {
    const { processNewsletterLead } =
      await import("@/lib/lead-pipeline/processors/newsletter");

    const result = await processNewsletterLead(
      VALID_NEWSLETTER_LEAD,
      REFERENCE_ID,
    );

    expect(mockCreateLead).toHaveBeenCalledWith(LEAD_TYPES.NEWSLETTER, {
      email: "subscriber@example.com",
      referenceId: REFERENCE_ID,
    });

    expect(result.crmResult).toEqual(
      expect.objectContaining({
        success: true,
        id: "record-789",
        latencyMs: 50,
      }),
    );

    expect(result.emailResult.success).toBe(false);
    if (!result.emailResult.success) {
      expect(result.emailResult.error.message).toBe("Not applicable");
      expect(result.emailResult.latencyMs).toBe(DEFAULT_LATENCY);
    }
  });

  it("passes settleService metadata that preserves the CRM record id", async () => {
    const { processNewsletterLead } =
      await import("@/lib/lead-pipeline/processors/newsletter");
    const { settleService } =
      await import("@/lib/lead-pipeline/settle-service");

    await processNewsletterLead(VALID_NEWSLETTER_LEAD, REFERENCE_ID);

    const settleCalls = vi.mocked(settleService).mock.calls;
    expect(settleCalls).toHaveLength(1);

    const [, crmOptions] = settleCalls[0]!;
    expect(crmOptions).toEqual(
      expect.objectContaining({
        operationName: "CRM record",
      }),
    );
    expect(crmOptions?.mapId?.({ id: "record-789" })).toBe("record-789");
    expect(
      crmOptions?.mapId?.(undefined as unknown as { id?: string }),
    ).toBeUndefined();
  });
});
