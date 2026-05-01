import "server-only";

import type AirtableNS from "airtable";
import type {
  AirtableQueryOptions,
  AirtableRecord,
  ContactFormData,
  ContactStatus,
} from "@/lib/airtable/types";
import { airtableRecordSchema } from "@/lib/airtable/record-schema";
import { logger, sanitizeCompany, sanitizeEmail } from "@/lib/logger";
import { sanitizePlainText } from "@/lib/security-validation";
import { ONE, PERCENTAGE_FULL, ZERO } from "@/constants";

function sanitizeFormData(formData: ContactFormData): ContactFormData {
  return {
    firstName: sanitizePlainText(formData.firstName),
    lastName: sanitizePlainText(formData.lastName),
    email: formData.email.toLowerCase().trim(),
    company: sanitizePlainText(formData.company),
    message: sanitizePlainText(formData.message),
    phone: formData.phone ? sanitizePlainText(formData.phone) : undefined,
    subject: formData.subject ? sanitizePlainText(formData.subject) : undefined,
    acceptPrivacy: formData.acceptPrivacy,
    marketingConsent: formData.marketingConsent,
    website: formData.website,
  };
}

function escapeAirtableFormulaValue(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

export async function createContactRecord(params: {
  base: AirtableNS.Base;
  tableName: string;
  formData: ContactFormData;
}): Promise<AirtableRecord> {
  const { base, tableName, formData } = params;

  try {
    const sanitizedData = sanitizeFormData(formData);

    const recordData = {
      "First Name": sanitizedData.firstName,
      "Last Name": sanitizedData.lastName,
      Email: sanitizedData.email,
      Company: sanitizedData.company,
      Message: sanitizedData.message,
      Phone: sanitizedData.phone || "",
      Subject: sanitizedData.subject || "",
      "Submitted At": new Date().toISOString(),
      Status: "New" as const,
      Source: "Website Contact Form",
      "Marketing Consent": sanitizedData.marketingConsent || false,
    };

    const validatedRecord = airtableRecordSchema.parse({
      fields: recordData,
    });

    const records = await base.table(tableName).create([
      {
        fields: validatedRecord.fields,
      },
    ]);

    const [createdRecord] = records;

    if (!createdRecord) {
      throw new Error("Failed to create record");
    }

    logger.info("Contact record created successfully", {
      recordId: createdRecord.id,
      email: sanitizeEmail(sanitizedData.email),
      company: sanitizeCompany(sanitizedData.company),
    });

    return {
      id: createdRecord.id,
      fields: createdRecord.fields as AirtableRecord["fields"],
      createdTime: createdRecord.get("Created Time") as string,
    };
  } catch (error) {
    logger.error("Failed to create contact record", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw new Error("Failed to create contact record", { cause: error });
  }
}

export async function getContactRecords(params: {
  base: AirtableNS.Base;
  tableName: string;
  options?: AirtableQueryOptions;
}): Promise<AirtableRecord[]> {
  const { base, tableName, options = {} } = params;

  try {
    const { maxRecords = PERCENTAGE_FULL, filterByFormula, sort } = options;

    const selectOptions: {
      maxRecords: number;
      filterByFormula?: string;
      sort?: Array<{ field: string; direction: "asc" | "desc" }>;
    } = { maxRecords };

    if (filterByFormula) {
      selectOptions.filterByFormula = filterByFormula;
    }
    if (sort) {
      selectOptions.sort = sort;
    }

    const records = await base.table(tableName).select(selectOptions).all();

    return records.map((record) => ({
      id: record.id,
      fields: record.fields as AirtableRecord["fields"],
      createdTime: record.get("Created Time") as string,
    }));
  } catch (error) {
    logger.error("Failed to fetch contact records", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw new Error("Failed to fetch contact records", { cause: error });
  }
}

export async function updateContactRecordStatus(params: {
  base: AirtableNS.Base;
  tableName: string;
  recordId: string;
  status: ContactStatus;
}): Promise<void> {
  const { base, tableName, recordId, status } = params;

  try {
    await base.table(tableName).update([
      {
        id: recordId,
        fields: {
          Status: status,
          "Updated At": new Date().toISOString(),
        },
      },
    ]);

    logger.info("Contact record status updated", {
      recordId,
      newStatus: status,
    });
  } catch (error) {
    logger.error("Failed to update contact record status", {
      error: error instanceof Error ? error.message : "Unknown error",
      recordId,
      status,
    });
    throw new Error("Failed to update contact status", { cause: error });
  }
}

export async function deleteContactRecord(params: {
  base: AirtableNS.Base;
  tableName: string;
  recordId: string;
}): Promise<void> {
  const { base, tableName, recordId } = params;

  try {
    await base.table(tableName).destroy([recordId]);

    logger.info("Contact record deleted", {
      recordId,
    });
  } catch (error) {
    logger.error("Failed to delete contact record", {
      error: error instanceof Error ? error.message : "Unknown error",
      recordId,
    });
    throw new Error("Failed to delete contact record", { cause: error });
  }
}

export async function isDuplicateEmailAddress(params: {
  base: AirtableNS.Base;
  tableName: string;
  email: string;
}): Promise<boolean> {
  const { base, tableName, email } = params;

  try {
    const normalizedEmail = escapeAirtableFormulaValue(
      email.trim().toLowerCase(),
    );
    const records = await base
      .table(tableName)
      .select({
        filterByFormula: `{Email} = "${normalizedEmail}"`,
        maxRecords: ONE,
      })
      .all();

    return records.length > ZERO;
  } catch (error) {
    logger.error("Failed to check duplicate email", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    // Re-throw to let callers decide how to handle the failure
    // instead of silently returning false (which masks API/network errors)
    throw new Error("Failed to check duplicate email", { cause: error });
  }
}
