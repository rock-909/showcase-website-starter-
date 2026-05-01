import type { ZodIssue } from "zod";

const FIELD_ERROR_KEY_PREFIX = new Map<string, string>([
  ["firstName", "errors.firstName"],
  ["lastName", "errors.lastName"],
  ["email", "errors.email"],
  ["company", "errors.company"],
  ["message", "errors.message"],
  ["phone", "errors.phone"],
  ["subject", "errors.subject"],
  ["acceptPrivacy", "errors.acceptPrivacy"],
  ["website", "errors.website"],
]);

const FALLBACK_ERROR_KEY = "errors.generic";

function getBaseErrorKey(issue: ZodIssue): string {
  const [rawField] = issue.path;
  if (typeof rawField !== "string") {
    return FALLBACK_ERROR_KEY;
  }

  return FIELD_ERROR_KEY_PREFIX.get(rawField) ?? FALLBACK_ERROR_KEY;
}

function isRequiredMinimum(issue: ZodIssue): boolean {
  return (
    "minimum" in issue &&
    typeof issue.minimum === "number" &&
    issue.minimum <= 1
  );
}

function handleCustomIssue(baseKey: string, issue: ZodIssue): string {
  const message = issue.message?.toLowerCase?.() ?? "";

  if (baseKey === "errors.acceptPrivacy") {
    return `${baseKey}.required`;
  }

  if (baseKey === "errors.subject") {
    return `${baseKey}.length`;
  }

  if (baseKey === "errors.phone") {
    return `${baseKey}.invalid`;
  }

  if (baseKey === "errors.email" && message.includes("domain")) {
    return `${baseKey}.domainNotAllowed`;
  }

  return baseKey === FALLBACK_ERROR_KEY
    ? FALLBACK_ERROR_KEY
    : `${baseKey}.invalid`;
}

export function mapZodIssueToErrorKey(issue: ZodIssue): string {
  const baseKey = getBaseErrorKey(issue);
  const message = issue.message?.toLowerCase?.() ?? "";

  if (message.includes("required")) {
    return `${baseKey}.required`;
  }

  switch (issue.code) {
    case "too_small":
      return isRequiredMinimum(issue)
        ? `${baseKey}.required`
        : `${baseKey}.tooShort`;
    case "too_big":
      return baseKey === "errors.website"
        ? `${baseKey}.shouldBeEmpty`
        : `${baseKey}.tooLong`;
    case "custom":
      return handleCustomIssue(baseKey, issue);
    case "invalid_type":
      return `${baseKey}.invalid`;
    default:
      return handleCustomIssue(baseKey, issue);
  }
}
