import { headers } from "next/headers";

async function unsafeReads(request: Request) {
  // ruleid: raw-proxy-header-read-outside-trusted-entry
  const clientIP = headers().get("cf-connecting-ip");

  // ruleid: raw-proxy-header-read-outside-trusted-entry
  const forwardedFor = request.headers.get("x-forwarded-for");

  return { clientIP, forwardedFor };
}

async function safeReads(request: Request) {
  // ok: raw-proxy-header-read-outside-trusted-entry
  const trustedClientIP = getClientIP(request);

  // ok: raw-proxy-header-read-outside-trusted-entry
  const trustedHeaderClientIP = getClientIPFromHeaders(await headers());

  return { trustedClientIP, trustedHeaderClientIP };
}
