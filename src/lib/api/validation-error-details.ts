import { type ZodIssue } from "zod";

export type ValidationFieldErrorKeys = Partial<Record<string, string>>;

const FALLBACK_VALIDATION_DETAIL = "errors.generic";

function getBaseValidationKey(
  issue: ZodIssue,
  fieldKeys: ValidationFieldErrorKeys,
): string {
  const [rawField] = issue.path;
  if (typeof rawField !== "string") {
    return FALLBACK_VALIDATION_DETAIL;
  }

  return fieldKeys[rawField] ?? FALLBACK_VALIDATION_DETAIL;
}

function isRequiredMinimum(issue: ZodIssue): boolean {
  return (
    "minimum" in issue &&
    typeof issue.minimum === "number" &&
    issue.minimum <= 1
  );
}

export function mapZodIssueToValidationDetail(
  issue: ZodIssue,
  fieldKeys: ValidationFieldErrorKeys,
): string {
  const baseKey = getBaseValidationKey(issue, fieldKeys);

  switch (issue.code) {
    case "too_small":
      return isRequiredMinimum(issue)
        ? `${baseKey}.required`
        : `${baseKey}.tooShort`;
    case "too_big":
      return `${baseKey}.tooLong`;
    case "invalid_type":
      return `${baseKey}.invalid`;
    case "custom":
      return `${baseKey}.invalid`;
    default:
      return baseKey === FALLBACK_VALIDATION_DETAIL
        ? FALLBACK_VALIDATION_DETAIL
        : `${baseKey}.invalid`;
  }
}

export function mapZodIssuesToValidationDetails(
  issues: readonly ZodIssue[],
  fieldKeys: ValidationFieldErrorKeys,
): string[] {
  return Array.from(
    new Set(
      issues.map((issue) => mapZodIssueToValidationDetail(issue, fieldKeys)),
    ),
  );
}
