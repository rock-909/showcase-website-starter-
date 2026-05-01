import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import * as route from "@/app/api/health/route";
import {
  OBSERVABILITY_SURFACE_HEADER,
  REQUEST_ID_HEADER,
} from "@/lib/api/request-observability";

describe("api/health", () => {
  it("returns ok status with observability headers", async () => {
    const res = await route.GET(
      new NextRequest("http://localhost:3000/api/health", {
        headers: {
          [REQUEST_ID_HEADER]: "health-test-request",
        },
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get(REQUEST_ID_HEADER)).toBe("health-test-request");
    expect(res.headers.get(OBSERVABILITY_SURFACE_HEADER)).toBe("cache-health");
    const body = await res.json();
    expect(body.status).toBe("ok");
  });
});
