import fc from "fast-check";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { createRequestFingerprint } from "../idempotency";

type FingerprintParts = {
  method: string;
  path: string;
  bodyHash?: string;
};

function createRequest(method: string, path: string): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, { method });
}

function buildFingerprint(parts: FingerprintParts): string {
  return createRequestFingerprint(
    createRequest(parts.method, parts.path),
    parts.bodyHash,
  );
}

function isValidFingerprintFormat(
  fingerprint: string,
  expectedHash: string | undefined,
): boolean {
  const segments = fingerprint.split(":");
  const expectedLength = expectedHash ? 3 : 2;

  if (segments.length !== expectedLength) return false;

  const [method, path, bodyHash] = segments;
  if (!method || !path?.startsWith("/")) return false;
  if (expectedHash === undefined) return bodyHash === undefined;
  return bodyHash === expectedHash;
}

const fingerprintPartsArb: fc.Arbitrary<FingerprintParts> = fc
  .record({
    method: fc.constantFrom("GET", "POST", "PUT", "PATCH", "DELETE"),
    segments: fc.array(fc.stringMatching(/^[a-z0-9-]{1,12}$/), {
      maxLength: 4,
    }),
    bodyHash: fc.option(fc.stringMatching(/^[a-f0-9]{8,16}$/), {
      nil: undefined,
    }),
  })
  .map(({ method, segments, bodyHash }) => ({
    method,
    path: segments.length === 0 ? "/" : `/${segments.join("/")}`,
    ...(bodyHash !== undefined ? { bodyHash } : {}),
  }));

describe("idempotency property tests", () => {
  it("createRequestFingerprint always matches the documented format", () => {
    fc.assert(
      fc.property(fingerprintPartsArb, (parts) => {
        const fingerprint = buildFingerprint(parts);

        expect(isValidFingerprintFormat(fingerprint, parts.bodyHash)).toBe(
          true,
        );
      }),
    );
  });

  it("different semantic inputs produce different fingerprints", () => {
    fc.assert(
      fc.property(fingerprintPartsArb, fingerprintPartsArb, (left, right) => {
        fc.pre(
          left.method !== right.method ||
            left.path !== right.path ||
            left.bodyHash !== right.bodyHash,
        );

        expect(buildFingerprint(left)).not.toBe(buildFingerprint(right));
      }),
    );
  });
});
