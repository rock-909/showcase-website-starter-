import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock next-intl/middleware
vi.mock("next-intl/middleware", () => ({
  default: vi.fn(() => vi.fn(() => NextResponse.next())),
}));

// Mock security config
vi.mock("@/config/security", () => ({
  generateNonce: vi.fn(() => "test-nonce-123"),
  getSecurityHeaders: vi.fn(() => []),
}));

// Mock routing config
vi.mock("@/i18n/routing-config", () => ({
  routing: {
    defaultLocale: "en",
    locales: ["en", "zh"],
    pathnames: {
      "/": "/",
      "/about": "/about",
    },
  },
}));

describe("Middleware Cookie Security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  describe("setLocaleCookie security attributes", () => {
    it("should set httpOnly: true to prevent XSS access", async () => {
      const { default: middleware } = await import("@/middleware");

      const request = new NextRequest("http://localhost:3000/en/about");
      const response = middleware(request);

      if (response) {
        // NextResponse.cookies.set with httpOnly: true will have the attribute
        // We verify via the set-cookie header
        const setCookieHeader = response.headers.get("set-cookie");
        expect(setCookieHeader).toContain("HttpOnly");
      }
    });

    it("should set secure: true in production environment", async () => {
      vi.stubEnv("APP_ENV", "production");

      // Re-import to pick up new env
      vi.resetModules();

      // Re-mock dependencies after reset
      vi.doMock("next-intl/middleware", () => ({
        default: vi.fn(() => vi.fn(() => NextResponse.next())),
      }));
      vi.doMock("@/config/security", () => ({
        generateNonce: vi.fn(() => "test-nonce-123"),
        getSecurityHeaders: vi.fn(() => []),
      }));
      vi.doMock("@/i18n/routing-config", () => ({
        routing: {
          defaultLocale: "en",
          locales: ["en", "zh"],
          pathnames: { "/": "/", "/about": "/about" },
        },
      }));

      const { default: middleware } = await import("@/middleware");

      const request = new NextRequest("http://localhost:3000/en/about");
      const response = middleware(request);

      if (response) {
        const setCookieHeader = response.headers.get("set-cookie");
        expect(setCookieHeader).toContain("Secure");
      }
    });

    it("should not set secure flag in development environment", async () => {
      vi.stubEnv("APP_ENV", "local");

      vi.resetModules();

      vi.doMock("next-intl/middleware", () => ({
        default: vi.fn(() => vi.fn(() => NextResponse.next())),
      }));
      vi.doMock("@/config/security", () => ({
        generateNonce: vi.fn(() => "test-nonce-123"),
        getSecurityHeaders: vi.fn(() => []),
      }));
      vi.doMock("@/i18n/routing-config", () => ({
        routing: {
          defaultLocale: "en",
          locales: ["en", "zh"],
          pathnames: { "/": "/", "/about": "/about" },
        },
      }));

      const { default: middleware } = await import("@/middleware");

      const request = new NextRequest("http://localhost:3000/en/about");
      const response = middleware(request);

      if (response) {
        const setCookieHeader = response.headers.get("set-cookie");
        // In development, Secure flag should not be present
        // The header format is: NEXT_LOCALE=en; Path=/; SameSite=Lax; HttpOnly
        // Without '; Secure' at the end
        expect(setCookieHeader).not.toMatch(/;\s*Secure(?:;|$)/i);
      }
    });

    it("should maintain sameSite: lax for cross-site navigation", async () => {
      const { default: middleware } = await import("@/middleware");

      const request = new NextRequest("http://localhost:3000/en/about");
      const response = middleware(request);

      if (response) {
        const setCookieHeader = response.headers.get("set-cookie");
        expect(setCookieHeader).toMatch(/SameSite=Lax/i);
      }
    });

    it("should set correct cookie path", async () => {
      const { default: middleware } = await import("@/middleware");

      const request = new NextRequest("http://localhost:3000/en/about");
      const response = middleware(request);

      if (response) {
        const setCookieHeader = response.headers.get("set-cookie");
        expect(setCookieHeader).toContain("Path=/");
      }
    });
  });

  describe("cookie security in different scenarios", () => {
    it("redirects no-JS locale fallback links to the same referer path", async () => {
      vi.resetModules();

      vi.doMock("next-intl/middleware", () => ({
        default: vi.fn(() => vi.fn(() => NextResponse.next())),
      }));
      vi.doMock("@/config/security", () => ({
        generateNonce: vi.fn(() => "test-nonce-123"),
        getSecurityHeaders: vi.fn(() => []),
      }));
      vi.doMock("@/i18n/routing-config", () => ({
        routing: {
          defaultLocale: "en",
          locales: ["en", "zh"],
          pathnames: {
            "/": "/",
            "/about": "/about",
            "/contact": "/contact",
            "/products/[market]": "/products/[market]",
          },
        },
      }));

      const { default: middleware } = await import("@/middleware");
      const request = new NextRequest(
        "http://localhost:3000/en?fromLocaleFallback=1",
        {
          headers: {
            referer: "http://localhost:3000/zh/contact",
          },
        },
      );

      const response = middleware(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe(
        "http://localhost:3000/en/contact",
      );
      expect(response.headers.get("set-cookie")).toContain("NEXT_LOCALE=en");
    });

    it("removes no-JS locale fallback sentinel query from redirected URLs", async () => {
      vi.resetModules();

      vi.doMock("next-intl/middleware", () => ({
        default: vi.fn(() => vi.fn(() => NextResponse.next())),
      }));
      vi.doMock("@/config/security", () => ({
        generateNonce: vi.fn(() => "test-nonce-123"),
        getSecurityHeaders: vi.fn(() => []),
      }));
      vi.doMock("@/i18n/routing-config", () => ({
        routing: {
          defaultLocale: "en",
          locales: ["en", "zh"],
          pathnames: {
            "/": "/",
            "/contact": "/contact",
          },
        },
      }));

      const { default: middleware } = await import("@/middleware");
      const request = new NextRequest(
        "http://localhost:3000/en?fromLocaleFallback=1",
        {
          headers: {
            referer:
              "http://localhost:3000/zh/contact?fromLocaleFallback=1&utm_source=test",
          },
        },
      );

      const response = middleware(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe(
        "http://localhost:3000/en/contact?utm_source=test",
      );
    });

    it("ignores cross-origin no-JS locale fallback referers", async () => {
      vi.resetModules();
      const intlMock = vi.fn(() => NextResponse.next());

      vi.doMock("next-intl/middleware", () => ({
        default: vi.fn(() => intlMock),
      }));
      vi.doMock("@/config/security", () => ({
        generateNonce: vi.fn(() => "test-nonce-123"),
        getSecurityHeaders: vi.fn(() => []),
      }));
      vi.doMock("@/i18n/routing-config", () => ({
        routing: {
          defaultLocale: "en",
          locales: ["en", "zh"],
          pathnames: { "/": "/", "/contact": "/contact" },
        },
      }));

      const { default: middleware } = await import("@/middleware");
      const request = new NextRequest(
        "http://localhost:3000/en?fromLocaleFallback=1",
        {
          headers: {
            referer: "https://example.test/zh/contact",
          },
        },
      );

      const response = middleware(request);

      expect(response.status).not.toBe(307);
      expect(response.headers.get("location")).toBeNull();
      expect(intlMock).toHaveBeenCalledTimes(1);
    });

    it("falls back to the locale root when no-JS locale fallback has no referer", async () => {
      vi.resetModules();
      const intlMock = vi.fn(() => NextResponse.next());

      vi.doMock("next-intl/middleware", () => ({
        default: vi.fn(() => intlMock),
      }));
      vi.doMock("@/config/security", () => ({
        generateNonce: vi.fn(() => "test-nonce-123"),
        getSecurityHeaders: vi.fn(() => []),
      }));
      vi.doMock("@/i18n/routing-config", () => ({
        routing: {
          defaultLocale: "en",
          locales: ["en", "zh"],
          pathnames: { "/": "/", "/contact": "/contact" },
        },
      }));

      const { default: middleware } = await import("@/middleware");
      const request = new NextRequest(
        "http://localhost:3000/zh?fromLocaleFallback=1",
      );

      const response = middleware(request);

      expect(response.status).not.toBe(307);
      expect(response.headers.get("location")).toBeNull();
      expect(intlMock).toHaveBeenCalledTimes(1);
    });

    it("does not locale-redirect owner ops dashboard routes", async () => {
      const { config } = await import("@/middleware");

      expect(config.matcher).toContain(
        "/((?!api|_next|_vercel|admin|ops|.*\\..*).*)",
      );
    });

    it("should apply security attributes when handling explicit localized request", async () => {
      vi.resetModules();
      const intlMock = vi.fn(() => NextResponse.next());

      vi.doMock("next-intl/middleware", () => ({
        default: vi.fn(() => intlMock),
      }));
      vi.doMock("@/config/security", () => ({
        generateNonce: vi.fn(() => "test-nonce-123"),
        getSecurityHeaders: vi.fn(() => []),
      }));
      vi.doMock("@/i18n/routing-config", () => ({
        routing: {
          defaultLocale: "en",
          locales: ["en", "zh"],
          pathnames: { "/": "/", "/about": "/about" },
        },
      }));

      const { default: middleware } = await import("@/middleware");

      // Request without existing NEXT_LOCALE cookie
      const request = new NextRequest("http://localhost:3000/zh/about");
      const response = middleware(request);

      if (response) {
        const setCookieHeader = response.headers.get("set-cookie");
        if (setCookieHeader) {
          expect(setCookieHeader).toContain("NEXT_LOCALE=zh");
          expect(setCookieHeader).toContain("HttpOnly");
          expect(setCookieHeader).toMatch(/SameSite=Lax/i);
        }
      }
      expect(intlMock).toHaveBeenCalledTimes(1);
    });

    it("should apply security attributes when redirecting invalid locale prefix", async () => {
      vi.resetModules();

      vi.doMock("next-intl/middleware", () => ({
        default: vi.fn(() => vi.fn(() => NextResponse.next())),
      }));
      vi.doMock("@/config/security", () => ({
        generateNonce: vi.fn(() => "test-nonce-123"),
        getSecurityHeaders: vi.fn(() => []),
      }));
      vi.doMock("@/i18n/routing-config", () => ({
        routing: {
          defaultLocale: "en",
          locales: ["en", "zh"],
          pathnames: { "/": "/", "/about": "/about" },
        },
      }));

      const { default: middleware } = await import("@/middleware");

      // Request with invalid locale prefix but known path
      const request = new NextRequest(
        "http://localhost:3000/invalid-lang/about",
      );
      const response = middleware(request);

      if (response) {
        const setCookieHeader = response.headers.get("set-cookie");
        if (setCookieHeader) {
          expect(setCookieHeader).toContain("HttpOnly");
          expect(setCookieHeader).toMatch(/SameSite=Lax/i);
        }
        expect(response.headers.get("location")).toBe(
          "http://localhost:3000/en/about",
        );
      }
    });

    it("should redirect invalid locale prefix for dynamic routes", async () => {
      vi.resetModules();

      vi.doMock("next-intl/middleware", () => ({
        default: vi.fn(() => vi.fn(() => NextResponse.next())),
      }));
      vi.doMock("@/config/security", () => ({
        generateNonce: vi.fn(() => "test-nonce-123"),
        getSecurityHeaders: vi.fn(() => []),
      }));
      vi.doMock("@/i18n/routing-config", () => ({
        routing: {
          defaultLocale: "en",
          locales: ["en", "zh"],
          pathnames: {
            "/": "/",
            "/about": "/about",
            "/products/[market]": "/products/[market]",
          },
        },
      }));

      const { default: middleware } = await import("@/middleware");

      const request = new NextRequest("http://localhost:3000/fr/products/eu");
      const response = middleware(request);

      if (response) {
        const setCookieHeader = response.headers.get("set-cookie");
        if (setCookieHeader) {
          expect(setCookieHeader).toContain("HttpOnly");
          expect(setCookieHeader).toMatch(/SameSite=Lax/i);
        }
        expect(response.headers.get("location")).toBe(
          "http://localhost:3000/en/products/eu",
        );
      }
    });

    it("should normalize root redirect locale cookie flags and remove leaked middleware cookie header", async () => {
      vi.stubEnv("APP_ENV", "preview");
      vi.resetModules();

      const intlMock = vi.fn(() => {
        const response = NextResponse.redirect("http://localhost:3000/en");
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

      vi.doMock("next-intl/middleware", () => ({
        default: vi.fn(() => intlMock),
      }));
      vi.doMock("@/config/security", () => ({
        generateNonce: vi.fn(() => "test-nonce-123"),
        getSecurityHeaders: vi.fn(() => []),
      }));
      vi.doMock("@/i18n/routing-config", () => ({
        routing: {
          defaultLocale: "en",
          locales: ["en", "zh"],
          pathnames: { "/": "/", "/about": "/about" },
          localeCookie: { maxAge: 60 * 60 * 24 * 365 },
        },
      }));

      const { default: middleware } = await import("@/middleware");

      const request = new NextRequest("http://localhost:3000/");
      const response = middleware(request);

      if (response) {
        const setCookieHeader = (
          response.headers.get("set-cookie") ?? ""
        ).toLowerCase();
        expect(response.headers.get("x-middleware-set-cookie")).toBeNull();
        expect(setCookieHeader).toContain("next_locale=en");
        expect(setCookieHeader).toContain("httponly");
        expect(setCookieHeader).toContain("secure");
      }

      expect(intlMock).toHaveBeenCalledTimes(1);
    });

    it("should not expose middleware-derived client IP overrides", async () => {
      vi.stubEnv("CF_PAGES", "1");
      const { default: middleware } = await import("@/middleware");

      const request = new NextRequest("http://localhost:3000/en/contact", {
        headers: {
          "cf-connecting-ip": "198.51.100.77",
        },
      });
      const response = middleware(request);

      expect(response.headers.get("x-middleware-override-headers")).toBe(
        "x-nonce",
      );
    });
  });
});
