/**
 * Lead Pipeline Module
 * Unified lead handling for all form submissions
 */

export {
  leadSchema,
  contactLeadSchema,
  productLeadSchema,
  newsletterLeadSchema,
  LEAD_TYPES,
  CONTACT_SUBJECTS,
  isContactLead,
  isProductLead,
  isNewsletterLead,
  type LeadInput,
  type ContactLeadInput,
  type ProductLeadInput,
  type NewsletterLeadInput,
  type LeadType,
  type ContactSubject,
} from "@/lib/lead-pipeline/lead-schema";

export {
  splitName,
  formatQuantity,
  generateProductInquiryMessage,
  generateLeadReferenceId,
  type SplitNameResult,
} from "@/lib/lead-pipeline/utils";

export { processLead, type LeadResult } from "@/lib/lead-pipeline/process-lead";

export {
  METRIC_SERVICES,
  METRIC_TYPES,
  ERROR_TYPES,
  LeadPipelineMetrics,
  leadPipelineMetrics,
  createLatencyTimer,
  categorizeError,
  type MetricService,
  type MetricType,
  type ErrorType,
  type ServiceMetric,
  type PipelineSummary,
  type AlertConfig,
} from "@/lib/lead-pipeline/metrics";
