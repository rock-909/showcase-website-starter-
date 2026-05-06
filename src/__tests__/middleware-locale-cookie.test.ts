import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { recordApiResponseSignalMock } = vi.hoisted(() => ({
  recordApiResponseSignalMock: vi.fn().mockResolvedValue(undefined),
}));

const { intlMiddlewareMock } = vi.hoisted(() => ({
  intlMiddlewareMock: vi.fn(),
}));

vi.mock("next-intl/middleware", () => ({
  default: () => intlMiddlewareMock,
}));

vi.mock("@/lib/observability/api-signals", () => ({
  recordApiResponseSignal: recordApiResponseSignalMock,
}));

import middleware from "../middleware";

beforeEach(() => {
  vi.clearAllMocks();
  recordApiResponseSignalMock.mockResolvedValue(undefined);
  intlMiddlewareMock.mockImplementation(() => NextResponse.next());
});

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe("middleware locale cookie", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("CF_PAGES", "1");
  });

  it("sets NEXT_LOCALE cookie once (no duplicate Set-Cookie header)", () => {
    const request = new NextRequest("http://localhost/en/about", {
      headers: {
        cookie: "NEXT_LOCALE=zh",
      },
    });

    const response = middleware(request);

    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(countOccurrences(setCookie, "NEXT_LOCALE=")).toBe(1);
    expect(intlMiddlewareMock).toHaveBeenCalledTimes(1);
  });

  it("sets NEXT_LOCALE cookie with max-age (persisted preference)", () => {
    const request = new NextRequest("http://localhost/en/about", {
      headers: {
        cookie: "NEXT_LOCALE=zh",
      },
    });

    const response = middleware(request);
    const setCookie = (response.headers.get("set-cookie") ?? "").toLowerCase();

    expect(setCookie).toContain("next_locale=");
    expect(setCookie).toContain("max-age=31536000");
    expect(setCookie).toContain("samesite=lax");
    expect(intlMiddlewareMock).toHaveBeenCalledTimes(1);
  });

  it("redirects invalid locale prefix to default locale and persists cookie", () => {
    const request = new NextRequest("http://localhost/fr/about", {
      headers: {
        cookie: "NEXT_LOCALE=zh",
      },
    });

    const response = middleware(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/en/about");

    const setCookie = (response.headers.get("set-cookie") ?? "").toLowerCase();
    expect(setCookie).toContain("next_locale=en");
    expect(setCookie).toContain("max-age=31536000");
  });

  it("redirects invalid locale prefix for dynamic product routes", () => {
    const request = new NextRequest("http://localhost/fr/products/eu", {
      headers: {
        cookie: "NEXT_LOCALE=zh",
      },
    });

    const response = middleware(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost/en/products/eu",
    );

    const setCookie = (response.headers.get("set-cookie") ?? "").toLowerCase();
    expect(setCookie).toContain("next_locale=en");
    expect(setCookie).toContain("max-age=31536000");
  });

  it("normalizes root redirect locale cookie flags and strips leaked middleware cookie header", () => {
    vi.stubEnv("APP_ENV", "preview");
    intlMiddlewareMock.mockImplementation(() => {
      const response = NextResponse.redirect("http://localhost/en");
      response.headers.set(
        "set-cookie",
        "NEXT_LOCALE=en; Path=/; Max-Age=31536000; SameSite=Lax",
      );
      response.headers.set(
        "x-middleware-set-cookie",
        "NEXT_LOCALE=en; Path=/; Max-Age=31536000; SameSite=Lax",
      );
      return response;
    });

    const request = new NextRequest("http://localhost/");
    const response = middleware(request);

    const setCookie = (response.headers.get("set-cookie") ?? "").toLowerCase();
    expect(response.headers.get("x-middleware-set-cookie")).toBeNull();
    expect(setCookie).toContain("next_locale=en");
    expect(setCookie).toContain("httponly");
    expect(setCookie).toContain("secure");
    expect(setCookie).toContain("max-age=31536000");
  });

  it("does not add client-IP request overrides", () => {
    const request = new NextRequest("http://localhost/en/contact", {
      headers: {
        "cf-connecting-ip": "198.51.100.77",
        "x-forwarded-for": "203.0.113.9",
      },
    });

    const response = middleware(request);

    expect(response.headers.get("x-middleware-override-headers")).toBe(
      "x-nonce",
    );
    expect(response.headers.get("x-middleware-request-x-nonce")).toBeTruthy();
  });
});
