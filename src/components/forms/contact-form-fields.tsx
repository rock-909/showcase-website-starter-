/**
 * Contact form fields and field composition helpers.
 */

import { memo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  buildFormFieldsFromConfig,
  CONTACT_FORM_CONFIG,
  type ContactFormFieldDescriptor,
} from "@/config/contact-form-config";
import { FORM_FIELD_REQUIRED_CLASS_NAME } from "@/components/forms/form-status-styles";

export { AdditionalFields } from "@/components/forms/fields/additional-fields";
export { CheckboxFields } from "@/components/forms/fields/checkbox-fields";
export { ContactFields } from "@/components/forms/fields/contact-fields";
export { NameFields } from "@/components/forms/fields/name-fields";
export { MessageField } from "@/components/forms/fields/message-field";

export interface FormFieldsProps {
  t: (key: string) => string;
  isPending: boolean;
}

export function getFieldInputProps(
  field: ContactFormFieldDescriptor,
): Partial<React.ComponentProps<"input"> & React.ComponentProps<"textarea">> {
  switch (field.key) {
    case "firstName":
      return {
        autoComplete: "given-name",
        autoCapitalize: "words",
      };
    case "lastName":
      return {
        autoComplete: "family-name",
        autoCapitalize: "words",
      };
    case "email":
      return {
        autoComplete: "email",
        inputMode: "email",
        spellCheck: false,
        autoCapitalize: "none",
      };
    case "company":
      return {
        autoComplete: "organization",
        autoCapitalize: "words",
      };
    case "phone":
      return {
        autoComplete: "tel",
        inputMode: "tel",
        spellCheck: false,
      };
    case "subject":
      return {
        autoComplete: "off",
        autoCapitalize: "sentences",
      };
    case "message":
      return {
        autoComplete: "off",
        spellCheck: true,
      };
    default:
      return {};
  }
}

export const FormFields = memo(({ t, isPending }: FormFieldsProps) => {
  const configuredFields = buildFormFieldsFromConfig(CONTACT_FORM_CONFIG);
  const textInputs = configuredFields.filter(
    (field) =>
      !field.isCheckbox && field.type !== "textarea" && !field.isHoneypot,
  );
  const textareas = configuredFields.filter(
    (field) => field.type === "textarea",
  );
  const checkboxFields = configuredFields.filter((field) => field.isCheckbox);
  const honeypotField = configuredFields.find((field) => field.isHoneypot);

  const renderLabelClass = (field: ContactFormFieldDescriptor) =>
    ["text-sm", field.required ? FORM_FIELD_REQUIRED_CLASS_NAME : ""]
      .filter(Boolean)
      .join(" ");

  const renderPlaceholder = (field: ContactFormFieldDescriptor) =>
    field.placeholderKey ? t(field.placeholderKey) : undefined;

  return (
    <>
      {textInputs.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {textInputs.map((field) => (
            <div key={field.key} className="space-y-2">
              <Label htmlFor={field.key} className={renderLabelClass(field)}>
                {t(field.labelKey)}
              </Label>
              <Input
                id={field.key}
                name={field.key}
                type={field.type}
                placeholder={renderPlaceholder(field)}
                disabled={isPending}
                required={field.required}
                {...getFieldInputProps(field)}
              />
            </div>
          ))}
        </div>
      )}

      {textareas.map((field) => (
        <div key={field.key} className="space-y-2">
          <Label htmlFor={field.key} className={renderLabelClass(field)}>
            {t(field.labelKey)}
          </Label>
          <Textarea
            id={field.key}
            name={field.key}
            placeholder={renderPlaceholder(field)}
            disabled={isPending}
            required={field.required}
            rows={4}
            {...getFieldInputProps(field)}
          />
        </div>
      ))}

      {checkboxFields.length > 0 && (
        <div className="space-y-4">
          {checkboxFields.map((field) => (
            <div key={field.key} className="space-y-2">
              <div className="flex items-center space-x-2">
                <input
                  id={field.key}
                  name={field.key}
                  type="checkbox"
                  disabled={isPending}
                  required={field.required}
                  className="h-4 w-4 rounded border border-input"
                />
                <Label htmlFor={field.key} className={renderLabelClass(field)}>
                  {t(field.labelKey)}
                </Label>
              </div>
            </div>
          ))}
        </div>
      )}

      {honeypotField && (
        <input
          id={honeypotField.key}
          name={honeypotField.key}
          type="text"
          autoComplete="off"
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only"
        />
      )}
    </>
  );
});

FormFields.displayName = "FormFields";
