import { NextResponse } from "next/server";
import { API_ERROR_CODES } from "@/constants/api-error-codes";

const HTTP_CONFLICT = 409;
const MAX_IN_FLIGHT_ENTRIES = 1000;

const pendingRequests = new Map<string, Promise<NextResponse>>();
const inFlightFingerprints = new Map<string, string>();

export function setInFlightFingerprint(
  idempotencyKey: string,
  fingerprint: string,
): void {
  inFlightFingerprints.set(idempotencyKey, fingerprint);
}

export function registerInFlight(
  idempotencyKey: string,
  fingerprint: string,
  work: Promise<NextResponse>,
): void {
  if (pendingRequests.size < MAX_IN_FLIGHT_ENTRIES) {
    pendingRequests.set(idempotencyKey, work);
    inFlightFingerprints.set(idempotencyKey, fingerprint);
  }
}

export function checkInFlight(
  idempotencyKey: string,
  fingerprint: string,
): NextResponse | Promise<NextResponse> | null {
  const inFlight = pendingRequests.get(idempotencyKey);
  if (!inFlight) return null;

  const existingFingerprint = inFlightFingerprints.get(idempotencyKey);
  if (existingFingerprint && existingFingerprint !== fingerprint) {
    return NextResponse.json(
      {
        success: false,
        errorCode: API_ERROR_CODES.IDEMPOTENCY_KEY_REUSED,
      },
      { status: HTTP_CONFLICT },
    );
  }

  return inFlight;
}

export function clearRequestIdempotencyKey(key: string): void {
  pendingRequests.delete(key);
  inFlightFingerprints.delete(key);
}

export function clearAllRequestIdempotencyKeys(): void {
  pendingRequests.clear();
  inFlightFingerprints.clear();
}

export function getRequestIdempotencyCacheStats() {
  return {
    size: pendingRequests.size,
    keys: Array.from(new Set(pendingRequests.keys())),
  };
}
