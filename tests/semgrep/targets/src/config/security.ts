// This fixture mirrors the repo's explicit allowlist for modules imported by next.config.ts.
// ok: env-access-bypass-in-config
export const configuredReportUri = process.env.CSP_REPORT_URI?.trim();

// ok: env-access-bypass-in-config
export const isEnabled = process.env.SECURITY_HEADERS_ENABLED !== "disabled";
