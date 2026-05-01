import { z } from "zod";
import {
  CONTACT_FORM_VALIDATION_CONSTANTS,
  type ContactFormFieldConfig,
} from "@/config/contact-form-config";
import {
  type ContactFormFieldValidatorContext,
  type ContactFormFieldValidators,
} from "@/config/contact-form-validation";

const applyOptionality = (
  schema: z.ZodTypeAny,
  field: ContactFormFieldConfig,
): z.ZodTypeAny => (field.required ? schema : schema.optional());

/**
 * Factory function for creating name field validators (firstName, lastName)
 * Eliminates code duplication by parameterizing the field label
 */
const createNameValidator = (fieldLabel: string) => {
  return ({ field }: ContactFormFieldValidatorContext) => {
    const { NAME_MIN_LENGTH, NAME_MAX_LENGTH } =
      CONTACT_FORM_VALIDATION_CONSTANTS;
    const schema = z
      .string()
      .min(
        NAME_MIN_LENGTH,
        `${fieldLabel} must be at least ${NAME_MIN_LENGTH} characters`,
      )
      .max(
        NAME_MAX_LENGTH,
        `${fieldLabel} must be less than ${NAME_MAX_LENGTH} characters`,
      )
      .regex(
        /^[a-zA-Z\s\u4e00-\u9fff]+$/,
        `${fieldLabel} can only contain letters and spaces`,
      );

    return applyOptionality(schema, field);
  };
};

export const firstName = createNameValidator("First name");
export const lastName = createNameValidator("Last name");

export function email({ field, config }: ContactFormFieldValidatorContext) {
  let schema = z
    .string()
    .email("Please enter a valid email address")
    .max(
      CONTACT_FORM_VALIDATION_CONSTANTS.EMAIL_MAX_LENGTH,
      `Email must be less than ${CONTACT_FORM_VALIDATION_CONSTANTS.EMAIL_MAX_LENGTH} characters`,
    )
    .transform((val) => val.toLowerCase());

  const whitelist = config.validation.emailDomainWhitelist;
  if (whitelist.length > 0) {
    const allowedDomains = new Set(
      whitelist.map((allowed) => allowed.toLowerCase()),
    );
    schema = schema.refine(
      (value) => allowedDomains.has(value.slice(value.indexOf("@") + 1)),
      "Email domain is not allowed",
    );
  }

  return applyOptionality(schema, field);
}

export function company({ field }: ContactFormFieldValidatorContext) {
  const { COMPANY_MIN_LENGTH, COMPANY_MAX_LENGTH } =
    CONTACT_FORM_VALIDATION_CONSTANTS;
  const schema = z
    .string()
    .transform((val) => val.trim())
    .refine(
      (val) =>
        val.length >= COMPANY_MIN_LENGTH && val.length <= COMPANY_MAX_LENGTH,
      {
        message: `Company name must be between ${COMPANY_MIN_LENGTH} and ${COMPANY_MAX_LENGTH} characters`,
      },
    )
    .refine((val) => /^[a-zA-Z0-9\s\u4e00-\u9fff&.,'-]+$/.test(val), {
      message: "Company name contains invalid characters",
    });

  return applyOptionality(schema, field);
}

export function message({ field, config }: ContactFormFieldValidatorContext) {
  const schema = z
    .string()
    .min(
      config.validation.messageMinLength,
      `Message must be at least ${config.validation.messageMinLength} characters`,
    )
    .max(
      config.validation.messageMaxLength,
      `Message must be less than ${config.validation.messageMaxLength} characters`,
    )
    .transform((val) => val.trim());

  return applyOptionality(schema, field);
}

export function phone({ field }: ContactFormFieldValidatorContext) {
  const { PHONE_MAX_DIGITS } = CONTACT_FORM_VALIDATION_CONSTANTS;
  const schema = z.string().refine((value) => {
    if (!value) return true;
    const normalized = value.replace(/[\s\-()]/g, "");
    if (!/^[+]?[0-9]+$/.test(normalized)) {
      return false;
    }
    const digitsOnly = normalized.replace("+", "");
    return digitsOnly.length <= PHONE_MAX_DIGITS;
  }, "Please enter a valid phone number");

  return applyOptionality(schema, field);
}

export function subject({ field }: ContactFormFieldValidatorContext) {
  const { SUBJECT_MIN_LENGTH, SUBJECT_MAX_LENGTH } =
    CONTACT_FORM_VALIDATION_CONSTANTS;
  const schema = z.string().refine((value) => {
    if (!value) return true;
    return (
      value.length >= SUBJECT_MIN_LENGTH && value.length <= SUBJECT_MAX_LENGTH
    );
  }, `Subject must be between ${SUBJECT_MIN_LENGTH} and ${SUBJECT_MAX_LENGTH} characters`);

  return applyOptionality(schema, field);
}

export function acceptPrivacy({ field }: ContactFormFieldValidatorContext) {
  const schema = z
    .boolean()
    .refine((value) => value === true, "You must accept the privacy policy");

  return applyOptionality(schema, field);
}

export function marketingConsent({ field }: ContactFormFieldValidatorContext) {
  const schema = z.boolean();
  return applyOptionality(schema, field);
}

export function website({ field }: ContactFormFieldValidatorContext) {
  const schema = z
    .string()
    .max(
      CONTACT_FORM_VALIDATION_CONSTANTS.HONEYPOT_MAX_LENGTH,
      "This field should be empty",
    );

  return applyOptionality(schema, field);
}

export const contactFieldValidators: ContactFormFieldValidators = {
  firstName,
  lastName,
  email,
  company,
  message,
  phone,
  subject,
  acceptPrivacy,
  marketingConsent,
  website,
};
