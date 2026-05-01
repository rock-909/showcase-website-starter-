import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";

import { API_ERROR_CODES } from "@/constants/api-error-codes";

import {
  checkInFlight,
  clearAllRequestIdempotencyKeys,
  clearRequestIdempotencyKey,
  getRequestIdempotencyCacheStats,
  registerInFlight,
  setInFlightFingerprint,
} from "../idempotency-runtime-cache";

describe("idempotency-runtime-cache", () => {
  beforeEach(() => {
    clearAllRequestIdempotencyKeys();
  });

  it("returns null when no in-flight work exists", () => {
    expect(checkInFlight("missing-key", "POST:/api/inquiry")).toBeNull();
  });

  it("returns the registered in-flight promise for matching fingerprints", async () => {
    const responsePromise = Promise.resolve(
      NextResponse.json({ source: "in-flight" }),
    );

    registerInFlight("same-key", "POST:/api/inquiry", responsePromise);

    const inFlight = checkInFlight("same-key", "POST:/api/inquiry");
    expect(inFlight).toBe(responsePromise);
    await expect(inFlight).resolves.toBeInstanceOf(NextResponse);
    expect(getRequestIdempotencyCacheStats()).toEqual({
      keys: ["same-key"],
      size: 1,
    });
  });

  it("returns a 409 response when an in-flight key is reused across fingerprints", async () => {
    registerInFlight(
      "reused-key",
      "POST:/api/inquiry",
      Promise.resolve(NextResponse.json({ ok: true })),
    );

    const response = await checkInFlight("reused-key", "POST:/api/subscribe");
    expect(response).toBeInstanceOf(NextResponse);
    expect(response?.status).toBe(409);
    await expect(response?.json()).resolves.toEqual({
      errorCode: API_ERROR_CODES.IDEMPOTENCY_KEY_REUSED,
      success: false,
    });
  });

  it("lets explicit fingerprint registration reuse a pending request", async () => {
    const responsePromise = Promise.resolve(
      NextResponse.json({ source: "manual-fingerprint" }),
    );

    registerInFlight("manual-key", "POST:/api/inquiry", responsePromise);
    setInFlightFingerprint("manual-key", "POST:/api/inquiry");

    const response = await checkInFlight("manual-key", "POST:/api/inquiry");
    expect(response).toBeInstanceOf(NextResponse);
    await expect(response?.json()).resolves.toEqual({
      source: "manual-fingerprint",
    });
  });

  it("updates the tracked fingerprint when setInFlightFingerprint overrides an existing key", async () => {
    registerInFlight(
      "override-key",
      "POST:/api/inquiry",
      Promise.resolve(NextResponse.json({ ok: true })),
    );
    setInFlightFingerprint("override-key", "POST:/api/subscribe");

    const response = await checkInFlight("override-key", "POST:/api/inquiry");
    expect(response).toBeInstanceOf(NextResponse);
    expect(response?.status).toBe(409);
    await expect(response?.json()).resolves.toEqual({
      errorCode: API_ERROR_CODES.IDEMPOTENCY_KEY_REUSED,
      success: false,
    });
  });

  it("clears individual keys and all pending state", () => {
    registerInFlight(
      "keep-key",
      "POST:/api/inquiry",
      Promise.resolve(NextResponse.json({ ok: true })),
    );
    registerInFlight(
      "drop-key",
      "POST:/api/inquiry",
      Promise.resolve(NextResponse.json({ ok: true })),
    );

    clearRequestIdempotencyKey("drop-key");
    expect(getRequestIdempotencyCacheStats()).toEqual({
      keys: ["keep-key"],
      size: 1,
    });

    clearAllRequestIdempotencyKeys();
    expect(getRequestIdempotencyCacheStats()).toEqual({ keys: [], size: 0 });
  });

  it("caps the number of tracked in-flight entries at the configured limit", () => {
    for (let index = 0; index < 1_000; index += 1) {
      registerInFlight(
        `key-${index}`,
        "POST:/api/inquiry",
        Promise.resolve(NextResponse.json({ index })),
      );
    }

    registerInFlight(
      "overflow-key",
      "POST:/api/inquiry",
      Promise.resolve(NextResponse.json({ overflow: true })),
    );

    const stats = getRequestIdempotencyCacheStats();
    expect(stats.size).toBe(1_000);
    expect(stats.keys).not.toContain("overflow-key");
    expect(checkInFlight("overflow-key", "POST:/api/inquiry")).toBeNull();
  });
});
