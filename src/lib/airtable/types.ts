/**
 * Airtable 相关类型定义
 */

// 重新导出生产链路仍在使用的表单/Airtable类型
export type { ContactFormData } from "@/lib/form-schema/contact-form-schema";
export type { AirtableRecord } from "@/lib/airtable/record-schema";

// Airtable 查询选项类型
export interface AirtableQueryOptions {
  maxRecords?: number;
  filterByFormula?: string;
  sort?: Array<{
    field: string;
    direction: "asc" | "desc";
  }>;
}

// Airtable 统计数据类型
export interface AirtableStatistics {
  totalContacts: number;
  newContacts: number;
  inProgressContacts: number;
  completedContacts: number;
  archivedContacts: number;
}

// 联系人状态类型
export type ContactStatus = "New" | "In Progress" | "Completed" | "Archived";

// Lead source type for CRM tracking
export type LeadSource =
  | "Website Contact Form"
  | "Product Inquiry"
  | "Newsletter Subscription";

// Base lead data for CRM
export interface BaseLeadData {
  email: string;
  referenceId?: string;
}

// Contact lead data
export interface ContactLeadData extends BaseLeadData {
  firstName: string;
  lastName: string;
  company?: string;
  subject?: string;
  message: string;
  marketingConsent?: boolean;
}

// Product inquiry lead data
export interface ProductLeadData extends BaseLeadData {
  firstName: string;
  lastName: string;
  company?: string;
  message: string;
  productSlug: string;
  productName: string;
  quantity: string | number;
  requirements?: string;
  marketingConsent?: boolean;
}

// Newsletter subscription lead data
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- intentionally minimal, only email from BaseLeadData
export interface NewsletterLeadData extends BaseLeadData {}

// Union type for all lead data
export type LeadData = ContactLeadData | ProductLeadData | NewsletterLeadData;
