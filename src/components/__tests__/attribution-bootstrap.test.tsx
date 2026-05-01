import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockStoreAttributionData, mockFlushPendingAttribution } = vi.hoisted(
  () => ({
    mockStoreAttributionData: vi.fn(),
    mockFlushPendingAttribution: vi.fn(),
  }),
);

vi.mock("@/lib/utm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/utm")>();
  return {
    ...actual,
    storeAttributionData: () => {
      mockStoreAttributionData();
      actual.storeAttributionData();
    },
    flushPendingAttribution: () => {
      mockFlushPendingAttribution();
      actual.flushPendingAttribution();
    },
  };
});

function setMarketingConsent(marketing: boolean) {
  window.localStorage.setItem(
    "cookie-consent",
    JSON.stringify({
      consent: {
        necessary: true,
        analytics: false,
        marketing,
      },
      updatedAt: new Date().toISOString(),
      version: 1,
    }),
  );
}

describe("AttributionBootstrap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();
    Object.defineProperty(globalThis, "localStorage", {
      value: window.localStorage,
      configurable: true,
    });
    Object.defineProperty(globalThis, "sessionStorage", {
      value: window.sessionStorage,
      configurable: true,
    });
    window.history.replaceState({}, "", "/en");
    window.location.search = "";
    window.location.pathname = "/en";
  });

  it("detects attribution-bearing search strings", async () => {
    const module = await import("../attribution-bootstrap");
    expect(module.shouldLoadAttribution("?utm_source=test")).toBe(true);
    expect(module.shouldLoadAttribution("?gclid=test-click")).toBe(true);
    expect(module.shouldLoadAttribution("?fbclid=test-click")).toBe(true);
    expect(module.shouldLoadAttribution("?msclkid=test-click")).toBe(true);
    expect(module.shouldLoadAttribution("?foo=bar")).toBe(false);
    expect(module.shouldLoadAttribution("")).toBe(false);
  });

  it("renders nothing (returns null)", async () => {
    const module = await import("../attribution-bootstrap");
    const { container } = render(<module.AttributionBootstrap />);

    expect(container).toBeEmptyDOMElement();
  });

  it("does not load attribution logic when there are no attribution params", async () => {
    const module = await import("../attribution-bootstrap");
    const loadModule = vi.fn(module.loadAttributionModule);
    render(<module.AttributionBootstrap loadModule={loadModule} />);

    expect(loadModule).not.toHaveBeenCalled();
  });

  it("still avoids loading attribution logic on re-render when no params exist", async () => {
    const module = await import("../attribution-bootstrap");
    const loadModule = vi.fn(module.loadAttributionModule);

    const { rerender } = render(
      <module.AttributionBootstrap loadModule={loadModule} />,
    );

    rerender(<module.AttributionBootstrap loadModule={loadModule} />);
    rerender(<module.AttributionBootstrap loadModule={loadModule} />);

    expect(loadModule).not.toHaveBeenCalled();
  });

  it("loads attribution logic when attribution params exist", async () => {
    window.location.search = "?utm_source=google";
    const module = await import("../attribution-bootstrap");
    const loadModule = vi.fn(() =>
      Promise.resolve({
        flushPendingAttribution: vi.fn(),
        storeAttributionData: vi.fn(),
      }),
    );

    render(<module.AttributionBootstrap loadModule={loadModule} />);

    await waitFor(() => expect(loadModule).toHaveBeenCalledTimes(1));
  });

  it("flushes pending attribution through the real consent event path", async () => {
    setMarketingConsent(false);
    window.location.search = "?utm_source=google&gclid=abc123";
    window.location.pathname = "/en";

    const module = await import("../attribution-bootstrap");
    expect(window.location.search).toBe("?utm_source=google&gclid=abc123");
    expect(module.shouldLoadAttribution(window.location.search)).toBe(true);
    render(<module.AttributionBootstrap />);

    await waitFor(() => expect(mockStoreAttributionData).toHaveBeenCalled());
    expect(window.sessionStorage.getItem("marketing_attribution")).toBeNull();

    setMarketingConsent(true);
    await waitFor(() => {
      window.dispatchEvent(new Event("storage"));
      expect(mockFlushPendingAttribution).toHaveBeenCalled();
      const stored = window.sessionStorage.getItem("marketing_attribution");
      expect(stored).not.toBeNull();
      expect(JSON.parse(stored as string)).toMatchObject({
        utmSource: "google",
        gclid: "abc123",
        landingPage: "/en",
      });
    });
  });
});
