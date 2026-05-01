/**
 * Idempotency Key Generation (Client/Server Safe)
 *
 * This module intentionally does NOT import next/server so it can be used
 * in client components without pulling in server-only code.
 */

export function generateIdempotencyKey(): string {
  const timestamp = Date.now();

  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `${timestamp}-${crypto.randomUUID().replaceAll("-", "")}`;
  }

  if (
    typeof crypto !== "undefined" &&
    typeof crypto.getRandomValues === "function"
  ) {
    const buf = new Uint32Array(3);
    crypto.getRandomValues(buf);
    const random = Array.from(buf, (value) =>
      value.toString(36).padStart(4, "0"),
    ).join("");
    return `${timestamp}-${random}`;
  }

  throw new Error("Secure random generator unavailable for idempotency key");
}
