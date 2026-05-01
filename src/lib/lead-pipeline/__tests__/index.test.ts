import { describe, expect, it } from "vitest";

import * as leadPipeline from "../index";
import * as leadSchemaModule from "../lead-schema";
import * as metricsModule from "../metrics";
import * as processLeadModule from "../process-lead";
import * as utilsModule from "../utils";

describe("lead-pipeline barrel exports", () => {
  it("re-exports schema and utility modules from the barrel", () => {
    expect(leadPipeline.leadSchema).toBe(leadSchemaModule.leadSchema);
    expect(leadPipeline.contactLeadSchema).toBe(
      leadSchemaModule.contactLeadSchema,
    );
    expect(leadPipeline.productLeadSchema).toBe(
      leadSchemaModule.productLeadSchema,
    );
    expect(leadPipeline.newsletterLeadSchema).toBe(
      leadSchemaModule.newsletterLeadSchema,
    );
    expect(leadPipeline.LEAD_TYPES).toBe(leadSchemaModule.LEAD_TYPES);
    expect(leadPipeline.CONTACT_SUBJECTS).toBe(
      leadSchemaModule.CONTACT_SUBJECTS,
    );
    expect(leadPipeline.isContactLead).toBe(leadSchemaModule.isContactLead);
    expect(leadPipeline.isProductLead).toBe(leadSchemaModule.isProductLead);
    expect(leadPipeline.isNewsletterLead).toBe(
      leadSchemaModule.isNewsletterLead,
    );

    expect(leadPipeline.splitName).toBe(utilsModule.splitName);
    expect(leadPipeline.formatQuantity).toBe(utilsModule.formatQuantity);
    expect(leadPipeline.generateProductInquiryMessage).toBe(
      utilsModule.generateProductInquiryMessage,
    );
    expect(leadPipeline.generateLeadReferenceId).toBe(
      utilsModule.generateLeadReferenceId,
    );
  });

  it("re-exports process and metrics contracts from the barrel", () => {
    expect(leadPipeline.processLead).toBe(processLeadModule.processLead);
    expect(leadPipeline.METRIC_SERVICES).toBe(metricsModule.METRIC_SERVICES);
    expect(leadPipeline.METRIC_TYPES).toBe(metricsModule.METRIC_TYPES);
    expect(leadPipeline.ERROR_TYPES).toBe(metricsModule.ERROR_TYPES);
    expect(leadPipeline.LeadPipelineMetrics).toBe(
      metricsModule.LeadPipelineMetrics,
    );
    expect(leadPipeline.leadPipelineMetrics).toBe(
      metricsModule.leadPipelineMetrics,
    );
    expect(leadPipeline.createLatencyTimer).toBe(
      metricsModule.createLatencyTimer,
    );
    expect(leadPipeline.categorizeError).toBe(metricsModule.categorizeError);
  });
});
