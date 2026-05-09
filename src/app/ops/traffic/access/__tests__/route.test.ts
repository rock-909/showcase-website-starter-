import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCheckDistributedRateLimit = vi.hoisted(() => vi.fn());
const mockCreateRateLimitHeaders = vi.hoisted(() => vi.fn(() => new Headers()));
const mockConstantTimeCompare = vi.hoisted(() => vi.fn());

vi.mock("@/lib/security/distributed-rate-limit", async (importOriginal) => {
  const original =
    await importOriginal<
      typeof import("@/lib/security/distributed-rate-limit")
    >();
  return {
    ...original,
    checkDistributedRateLimit: mockCheckDistributedRateLimit,
    createRateLimitHeaders: mockCreateRateLimitHeaders,
  };
});

vi.mock("@/lib/security-crypto", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/lib/security-crypto")>();
  return {
    ...original,
    constantTimeCompare: mockConstantTimeCompare,
  };
});

import { POST } from "@/app/ops/traffic/access/route";

describe("ops traffic access route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckDistributedRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 4,
      resetTime: Date.now() + 60000,
      retryAfter: null,
    });
    mockConstantTimeCompare.mockImplementation(
      (a: string, b: string) => a === b,
    );
  });

  it("sets a signed cookie for the correct access key", async () => {
    vi.stubEnv("OPS_DASHBOARD_ACCESS_KEY", "owner-access-key-123456");
    const form = new FormData();
    form.set("accessKey", "owner-access-key-123456");

    const response = await POST(
      new NextRequest("http://localhost/ops/traffic/access", {
        method: "POST",
        body: form,
      }),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/ops/traffic");
    expect(response.headers.get("set-cookie")).toContain("ops_traffic_access=");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("SameSite=strict");
    expect(response.headers.get("set-cookie")).toContain("Path=/ops/traffic");
  });

  it("does not reveal data or set a success cookie for a wrong key", async () => {
    vi.stubEnv("OPS_DASHBOARD_ACCESS_KEY", "owner-access-key-123456");
    const form = new FormData();
    form.set("accessKey", "wrong");

    const response = await POST(
      new NextRequest("http://localhost/ops/traffic/access", {
        method: "POST",
        body: form,
      }),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/ops/traffic?access=denied");
    expect(response.headers.get("set-cookie")).not.toContain(
      "owner-access-key",
    );
    expect(response.headers.get("set-cookie")).toContain(
      "ops_traffic_access=;",
    );
    expect(response.headers.get("set-cookie")).toContain("Path=/ops/traffic");
  });

  it("rate limits invalid owner access attempts before comparing the key", async () => {
    vi.stubEnv("OPS_DASHBOARD_ACCESS_KEY", "owner-access-key-123456");
    mockCheckDistributedRateLimit.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetTime: Date.now() + 60000,
      retryAfter: 60,
      deniedReason: "limit",
    });
    const form = new FormData();
    form.set("accessKey", "wrong");

    const response = await POST(
      new NextRequest("http://localhost/ops/traffic/access", {
        method: "POST",
        body: form,
      }),
    );

    expect(response.status).toBe(429);
    expect(mockConstantTimeCompare).not.toHaveBeenCalled();
  });

  it("uses constant-time comparison for provided access keys", async () => {
    vi.stubEnv("OPS_DASHBOARD_ACCESS_KEY", "owner-access-key-123456");
    const form = new FormData();
    form.set("accessKey", "owner-access-key-123456");

    await POST(
      new NextRequest("http://localhost/ops/traffic/access", {
        method: "POST",
        body: form,
      }),
    );

    expect(mockConstantTimeCompare).toHaveBeenCalledWith(
      "owner-access-key-123456",
      "owner-access-key-123456",
    );
  });
});
