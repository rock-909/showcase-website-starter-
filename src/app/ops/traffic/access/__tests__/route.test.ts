import { describe, expect, it, vi } from "vitest";

import { POST } from "@/app/ops/traffic/access/route";

describe("ops traffic access route", () => {
  it("sets a signed cookie for the correct access key", async () => {
    vi.stubEnv("OPS_DASHBOARD_ACCESS_KEY", "owner-access-key-123456");
    const form = new FormData();
    form.set("accessKey", "owner-access-key-123456");

    const response = await POST(
      new Request("http://localhost/ops/traffic/access", {
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
      new Request("http://localhost/ops/traffic/access", {
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
});
