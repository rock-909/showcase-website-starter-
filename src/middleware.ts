import { NextRequest, NextResponse } from "next/server";
import { createObservedCacheHealthResponse } from "@/lib/api/cache-health-response";
import createMiddleware from "next-intl/middleware";
import { generateNonce, getSecurityHeaders } from "@/config/security";
import { routing, type Locale } from "@/i18n/routing-config";
import { isSecureAppEnv } from "@/lib/env";
import { INTERNAL_TRUSTED_CLIENT_IP_HEADER } from "@/lib/security/client-ip-headers";
import { getTrustedClientIPForInternalHeader } from "@/lib/security/client-ip";
import { REQUEST_ID_HEADER } from "@/lib/api/request-observability";

const intlMiddleware = createMiddleware(routing);
const SUPPORTED_LOCALES = new Set<string>(routing.locales);
const NONCE_REQUEST_HEADER_KEY = "x-nonce";
function getRequestIdForHealth(request: NextRequest): string {
  const fromRequest =
    request.headers.get(REQUEST_ID_HEADER)?.trim() ||
    request.headers.get("x-correlation-id")?.trim();

  if (fromRequest) {
    return fromRequest;
  }

  return globalThis.crypto?.randomUUID?.() ?? `health-${Date.now()}`;
}

function tryHandleHealthRoute(request: NextRequest): NextResponse | null {
  if (request.nextUrl.pathname !== "/api/health") {
    return null;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    return null;
  }

  return createObservedCacheHealthResponse(request, {
    requestId: getRequestIdForHealth(request),
  });
}

function applyCommonMiddlewareHeaders(
  response: NextResponse,
  nonce: string,
  trustedClientIP: string | null,
): void {
  removeLeakedMiddlewareCookieHeader(response);
  applyRequestHeaderOverride(response, NONCE_REQUEST_HEADER_KEY, nonce);
  if (trustedClientIP) {
    applyRequestHeaderOverride(
      response,
      INTERNAL_TRUSTED_CLIENT_IP_HEADER,
      trustedClientIP,
    );
  }
  addSecurityHeaders(response, nonce);
}

function isValidLocale(candidate: string): candidate is Locale {
  return SUPPORTED_LOCALES.has(candidate);
}

function applyRequestHeaderOverride(
  response: NextResponse,
  headerKey: string,
  headerValue: string,
): void {
  const normalizedKey = headerKey.toLowerCase();
  response.headers.set(`x-middleware-request-${normalizedKey}`, headerValue);

  const existing = response.headers.get("x-middleware-override-headers");
  const keys = new Set(
    (existing ?? "")
      .split(",")
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean),
  );
  keys.add(normalizedKey);
  response.headers.set(
    "x-middleware-override-headers",
    Array.from(keys).join(","),
  );
}

function addSecurityHeaders(response: NextResponse, nonce: string): void {
  const securityHeaders = getSecurityHeaders(nonce);
  securityHeaders.forEach(({ key, value }) => {
    response.headers.set(key, value);
  });
}

function extractLocaleCandidate(pathname: string): Locale | undefined {
  const segments = pathname.split("/").filter(Boolean);
  const candidate = segments[0];
  return candidate && isValidLocale(candidate) ? candidate : undefined;
}

function setLocaleCookie(resp: NextResponse, locale: Locale): void {
  try {
    const { localeCookie } = routing;
    const maxAge =
      typeof localeCookie === "object" && localeCookie !== null
        ? localeCookie.maxAge
        : undefined;
    resp.cookies.set("NEXT_LOCALE", locale, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: isSecureAppEnv(),
      ...(typeof maxAge === "number" ? { maxAge } : {}),
    });
  } catch {
    // ignore cookie errors
  }
}

function removeLeakedMiddlewareCookieHeader(response: NextResponse): void {
  response.headers.delete("x-middleware-set-cookie");
}

function extractLocaleFromLocationHeader(
  request: NextRequest,
  locationHeader: string | null,
): Locale | undefined {
  if (!locationHeader) return undefined;

  try {
    const redirectUrl = new URL(locationHeader, request.url);
    return extractLocaleCandidate(redirectUrl.pathname);
  } catch {
    return undefined;
  }
}

function splitPathSegments(pathname: string): string[] {
  return pathname.split("/").filter(Boolean);
}

function getRoutingPathPatterns(): string[] {
  const pathnames = routing.pathnames as Record<string, unknown> | undefined;
  if (!pathnames) return [];
  return Object.keys(pathnames);
}

function isOptionalCatchAllPattern(segment: string): boolean {
  return /^\[\[\.\.\..+\]\]$/u.test(segment);
}

function isCatchAllPattern(segment: string): boolean {
  return /^\[\.\.\..+\]$/u.test(segment);
}

function isDynamicPattern(segment: string): boolean {
  return /^\[.+\]$/u.test(segment);
}

function matchesRoutePattern(pattern: string, pathname: string): boolean {
  const patternSegments = splitPathSegments(pattern);
  const pathnameSegments = splitPathSegments(pathname);

  let patternIndex = 0;
  let pathIndex = 0;

  while (
    patternIndex < patternSegments.length &&
    pathIndex < pathnameSegments.length
  ) {
    const patternSegment = patternSegments[patternIndex];
    const pathSegment = pathnameSegments[pathIndex];

    if (!patternSegment || !pathSegment) return false;

    if (
      isOptionalCatchAllPattern(patternSegment) ||
      isCatchAllPattern(patternSegment)
    ) {
      return true;
    }

    if (isDynamicPattern(patternSegment)) {
      patternIndex += 1;
      pathIndex += 1;
      continue;
    }

    if (patternSegment !== pathSegment) {
      return false;
    }

    patternIndex += 1;
    pathIndex += 1;
  }

  return (
    patternIndex === patternSegments.length &&
    pathIndex === pathnameSegments.length
  );
}

function isKnownLocalizedPath(pathname: string): boolean {
  return getRoutingPathPatterns().some((pattern) =>
    matchesRoutePattern(pattern, pathname),
  );
}

function tryHandleInvalidLocalePrefix(
  request: NextRequest,
  nonce: string,
): NextResponse | null {
  const { pathname } = request.nextUrl;
  const segments = splitPathSegments(pathname);

  if (segments.length === 0) return null;

  const [first, ...rest] = segments;

  if (first && SUPPORTED_LOCALES.has(first)) {
    return null;
  }

  if (segments.length === 1 && isKnownLocalizedPath(pathname)) {
    return null;
  }

  const candidatePath = rest.length === 0 ? "/" : `/${rest.join("/")}`;
  const isKnownPath = isKnownLocalizedPath(candidatePath);

  if (!isKnownPath) {
    return null;
  }

  const targetUrl = request.nextUrl.clone();
  targetUrl.pathname = `/${routing.defaultLocale}${candidatePath}`;

  const resp = NextResponse.redirect(targetUrl);
  setLocaleCookie(resp, routing.defaultLocale);
  removeLeakedMiddlewareCookieHeader(resp);
  addSecurityHeaders(resp, nonce);

  return resp;
}

export default function middleware(request: NextRequest) {
  const healthHandled = tryHandleHealthRoute(request);
  if (healthHandled) {
    return healthHandled;
  }

  const nonce = generateNonce();
  const trustedClientIP = getTrustedClientIPForInternalHeader(request);

  const invalidLocaleHandled = tryHandleInvalidLocalePrefix(request, nonce);
  if (invalidLocaleHandled) {
    applyCommonMiddlewareHeaders(invalidLocaleHandled, nonce, trustedClientIP);
    return invalidLocaleHandled;
  }

  const response = intlMiddleware(request);
  const locale =
    extractLocaleCandidate(request.nextUrl.pathname) ??
    extractLocaleFromLocationHeader(request, response.headers.get("location"));
  const existingLocale = request.cookies.get("NEXT_LOCALE")?.value;
  if (response && locale && existingLocale !== locale) {
    setLocaleCookie(response, locale);
  }
  if (response) {
    applyCommonMiddlewareHeaders(response, nonce, trustedClientIP);
  }
  return response;
}

export const config = {
  matcher: ["/api/health", "/", "/((?!api|_next|_vercel|admin|.*\\..*).*)"],
};
