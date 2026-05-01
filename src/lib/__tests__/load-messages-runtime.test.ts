import { afterEach, describe, expect, it, vi } from "vitest";

interface CacheOptions {
  revalidate?: number | false;
  tags?: string[];
}

type UnstableCacheMock = (
  loader: () => Promise<unknown>,
  keyParts?: string[],
  options?: CacheOptions,
) => () => Promise<unknown>;

function createUnstableCacheMock() {
  return vi.fn<UnstableCacheMock>((loader) => loader);
}

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.doUnmock("@/lib/env");
  vi.doUnmock("next/cache");
});

describe("load-messages runtime gating", () => {
  it("bypasses cache in CI mode", async () => {
    const unstableCache = createUnstableCacheMock();

    vi.doMock("next/cache", () => ({
      unstable_cache: unstableCache,
    }));
    vi.doMock("@/lib/env", () => ({
      isRuntimeCi: () => true,
      isRuntimeDevelopment: () => false,
      isRuntimePlaywright: () => false,
      isRuntimeProductionBuildPhase: () => false,
      isRuntimeCloudflare: () => false,
    }));

    const { loadCriticalMessages } = await import("@/lib/load-messages");

    await loadCriticalMessages("en");

    expect(unstableCache).not.toHaveBeenCalled();
  });

  it("bypasses cache during production build phase", async () => {
    const unstableCache = createUnstableCacheMock();

    vi.doMock("next/cache", () => ({
      unstable_cache: unstableCache,
    }));
    vi.doMock("@/lib/env", () => ({
      isRuntimeCi: () => false,
      isRuntimeDevelopment: () => false,
      isRuntimePlaywright: () => false,
      isRuntimeProductionBuildPhase: () => true,
      isRuntimeCloudflare: () => false,
    }));

    const { loadDeferredMessages } = await import("@/lib/load-messages");

    await loadDeferredMessages("zh");

    expect(unstableCache).not.toHaveBeenCalled();
  });

  it("uses cache outside CI and production build", async () => {
    const unstableCache = createUnstableCacheMock();

    vi.doMock("next/cache", () => ({
      unstable_cache: unstableCache,
    }));
    vi.doMock("@/lib/env", () => ({
      isRuntimeCi: () => false,
      isRuntimeDevelopment: () => true,
      isRuntimePlaywright: () => false,
      isRuntimeProductionBuildPhase: () => false,
      isRuntimeCloudflare: () => false,
    }));

    const { loadCriticalMessages } = await import("@/lib/load-messages");

    await loadCriticalMessages("en");

    expect(unstableCache).toHaveBeenCalledTimes(1);
    expect(unstableCache.mock.calls[0]?.[2]).toMatchObject({
      tags: ["i18n:critical:en", "i18n:all"],
    });
  });

  it("passes deferred locale cache tags to unstable_cache", async () => {
    const unstableCache = createUnstableCacheMock();

    vi.doMock("next/cache", () => ({
      unstable_cache: unstableCache,
    }));
    vi.doMock("@/lib/env", () => ({
      isRuntimeCi: () => false,
      isRuntimeDevelopment: () => true,
      isRuntimePlaywright: () => false,
      isRuntimeProductionBuildPhase: () => false,
      isRuntimeCloudflare: () => false,
    }));

    const { loadDeferredMessages } = await import("@/lib/load-messages");

    await loadDeferredMessages("zh");

    expect(unstableCache).toHaveBeenCalledTimes(1);
    expect(unstableCache.mock.calls[0]?.[2]).toMatchObject({
      tags: ["i18n:deferred:zh", "i18n:all"],
    });
  });

  it("bypasses unstable_cache on Cloudflare runtime", async () => {
    const unstableCache = createUnstableCacheMock();

    vi.doMock("next/cache", () => ({
      unstable_cache: unstableCache,
    }));
    vi.doMock("@/lib/env", () => ({
      isRuntimeCi: () => false,
      isRuntimeDevelopment: () => true,
      isRuntimePlaywright: () => false,
      isRuntimeProductionBuildPhase: () => false,
      isRuntimeCloudflare: () => true,
    }));

    const { loadCriticalMessages } = await import("@/lib/load-messages");

    await loadCriticalMessages("en");

    expect(unstableCache).not.toHaveBeenCalled();
  });
});
