"use server";

/**
 * Re-export from the canonical lib location.
 * Server Actions live in src/lib/actions/contact.ts — components and pages
 * should import from "@/lib/actions/contact" directly.
 */
export {
  contactFormAction,
  type ContactFormResult,
  type ContactFormWithToken,
} from "@/lib/actions/contact";
