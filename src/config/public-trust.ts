import type { BrandAssets } from "@/config/site-types";
import { SINGLE_SITE_FACTS } from "@/config/single-site";

const PLACEHOLDER_PHONE_VALUES = new Set(["+86-518-0000-0000"]);
const PHONE_ZERO_BLOCK_PATTERN = /(?:^|[-\s])0{3,}(?:[-\s]|$)/;

export function isPublicPhoneConfigured(
  phone: string | null | undefined,
): phone is string {
  if (typeof phone !== "string") return false;

  const trimmed = phone.trim();
  if (trimmed.length === 0) return false;
  if (PLACEHOLDER_PHONE_VALUES.has(trimmed)) return false;
  if (PHONE_ZERO_BLOCK_PATTERN.test(trimmed)) return false;

  return true;
}

export function getPublicContactPhone(
  phone: string | null | undefined = SINGLE_SITE_FACTS.contact.phone,
): string | undefined {
  return isPublicPhoneConfigured(phone) ? phone.trim() : undefined;
}

export function getPublicLogoPath(
  logo: BrandAssets["logo"] = SINGLE_SITE_FACTS.brandAssets.logo,
): string | undefined {
  return logo.status === "ready" ? logo.horizontal : undefined;
}
