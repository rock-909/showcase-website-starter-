import { afterEach, describe, expect, it, vi } from "vitest";

import { generateIdempotencyKey } from "../idempotency-key";

const originalCrypto = globalThis.crypto;

function setCrypto(value: Crypto | undefined): void {
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value,
  });
}

describe("generateIdempotencyKey", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    setCrypto(originalCrypto);
  });

  it("prefers crypto.randomUUID when available and strips hyphens", () => {
    vi.spyOn(Date, "now").mockReturnValue(1_234);
    setCrypto({
      randomUUID: vi.fn(() => "123e4567-e89b-12d3-a456-426614174000"),
    } as unknown as Crypto);

    expect(generateIdempotencyKey()).toBe(
      "1234-123e4567e89b12d3a456426614174000",
    );
  });

  it("falls back to crypto.getRandomValues when randomUUID is unavailable", () => {
    vi.spyOn(Date, "now").mockReturnValue(9_876);
    const getRandomValues = vi.fn((buffer: Uint32Array) => {
      buffer[0] = 35;
      buffer[1] = 1_295;
      buffer[2] = 46_655;
      return buffer;
    });
    setCrypto({ getRandomValues } as unknown as Crypto);

    expect(generateIdempotencyKey()).toBe("9876-000z00zz0zzz");
    expect(getRandomValues).toHaveBeenCalledWith(expect.any(Uint32Array));
  });

  it("throws a clear error when no secure random generator is available", () => {
    setCrypto(undefined);

    expect(() => generateIdempotencyKey()).toThrow(
      "Secure random generator unavailable for idempotency key",
    );
  });

  it("throws when crypto exists but getRandomValues is not callable", () => {
    setCrypto({} as Crypto);

    expect(() => generateIdempotencyKey()).toThrow(
      "Secure random generator unavailable for idempotency key",
    );
  });
});
