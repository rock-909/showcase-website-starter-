import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createIdempotencyStore,
  MemoryIdempotencyStore,
  RedisIdempotencyStore,
  type IdempotencyEntry,
} from "@/lib/security/stores/idempotency-store";

const mockLoggerInfo = vi.hoisted(() => vi.fn());
const mockLoggerWarn = vi.hoisted(() => vi.fn());
const mockLoggerError = vi.hoisted(() => vi.fn());

vi.mock("@/lib/logger", () => ({
  logger: {
    info: mockLoggerInfo,
    warn: mockLoggerWarn,
    error: mockLoggerError,
  },
}));

function setEnv(key: string, value: string | undefined): void {
  const env = process.env as Record<string, string | undefined>;
  if (value === undefined) {
    delete env[key];
  } else {
    env[key] = value;
  }
}

describe("idempotency-store", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    setEnv("UPSTASH_REDIS_REST_URL", undefined);
    setEnv("UPSTASH_REDIS_REST_TOKEN", undefined);
    setEnv("ALLOW_MEMORY_IDEMPOTENCY", undefined);
    setEnv("NODE_ENV", undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe("createIdempotencyStore", () => {
    it("should create Redis store when Upstash credentials are configured", () => {
      setEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
      setEnv("UPSTASH_REDIS_REST_TOKEN", "token");

      const store = createIdempotencyStore();

      expect(store).toBeInstanceOf(RedisIdempotencyStore);
      expect(mockLoggerInfo).toHaveBeenCalledWith(
        "[Idempotency] Using Upstash Redis store",
      );
    });

    it("should throw in production without Redis unless override is set", () => {
      setEnv("NODE_ENV", "production");

      expect(() => createIdempotencyStore()).toThrow(
        "Production requires Upstash Redis",
      );
    });

    it("still throws in production when Upstash config is only partially present", () => {
      setEnv("NODE_ENV", "production");
      setEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");

      expect(() => createIdempotencyStore()).toThrow(
        "Production requires Upstash Redis",
      );
    });

    it("should create the in-memory store outside production", () => {
      const store = createIdempotencyStore();

      expect(store).toBeInstanceOf(MemoryIdempotencyStore);
      expect(mockLoggerInfo).toHaveBeenCalledWith(
        "[Idempotency] Using in-memory store (development only)",
      );
    });

    it("falls back to memory when Upstash config is partial outside production", () => {
      setEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");

      const store = createIdempotencyStore();

      expect(store).toBeInstanceOf(MemoryIdempotencyStore);
      expect(mockLoggerInfo).toHaveBeenCalledWith(
        "[Idempotency] Using in-memory store (development only)",
      );
    });
  });

  describe("RedisIdempotencyStore", () => {
    const entry: IdempotencyEntry = {
      status: "pending",
      fingerprint: "POST:/api/inquiry",
      createdAt: 1_700_000_000_000,
      expiresAt: 1_700_000_100_000,
    };

    it("should use SET NX for atomic key claims", async () => {
      const fetchMock = vi.fn(
        async () =>
          new Response(JSON.stringify({ result: "OK" }), { status: 200 }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const store = new RedisIdempotencyStore(
        "https://example.upstash.io",
        "t",
      );
      const claimed = await store.setIfNotExists("idem:key", entry, 60_000);

      expect(claimed).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith(
        "https://example.upstash.io",
        expect.objectContaining({
          method: "POST",
          headers: {
            Authorization: "Bearer t",
            "Content-Type": "application/json",
          },
          body: JSON.stringify([
            "SET",
            "idem:key",
            JSON.stringify(entry),
            "PX",
            60_000,
            "NX",
          ]),
        }),
      );
    });

    it("returns false when Redis SET NX reports the key already exists", async () => {
      const fetchMock = vi.fn(
        async () =>
          new Response(JSON.stringify({ result: null }), { status: 200 }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const store = new RedisIdempotencyStore(
        "https://example.upstash.io",
        "t",
      );

      await expect(
        store.setIfNotExists("idem:key", entry, 60_000),
      ).resolves.toBe(false);
    });

    it("throws when Redis SET NX fails", async () => {
      const fetchMock = vi.fn(
        async () =>
          new Response(JSON.stringify({ error: "boom" }), {
            status: 500,
            statusText: "boom",
          }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const store = new RedisIdempotencyStore(
        "https://example.upstash.io",
        "t",
      );

      await expect(
        store.setIfNotExists("idem:key", entry, 60_000),
      ).rejects.toThrow("Upstash operation failed");
    });

    it("stores entries via pipeline SET + PEXPIRE", async () => {
      const fetchMock = vi.fn(
        async () =>
          new Response(JSON.stringify({ result: "OK" }), { status: 200 }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const store = new RedisIdempotencyStore(
        "https://example.upstash.io",
        "t",
      );
      await store.set("idem:key", entry, 12_345);

      expect(fetchMock).toHaveBeenCalledWith(
        "https://example.upstash.io/pipeline",
        expect.objectContaining({
          method: "POST",
          headers: {
            Authorization: "Bearer t",
            "Content-Type": "application/json",
          },
          body: JSON.stringify([
            ["SET", "idem:key", JSON.stringify(entry)],
            ["PEXPIRE", "idem:key", "12345"],
          ]),
        }),
      );
    });

    it("throws when Redis set pipeline fails", async () => {
      const fetchMock = vi.fn(
        async () =>
          new Response(JSON.stringify({ error: "boom" }), {
            status: 500,
            statusText: "boom",
          }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const store = new RedisIdempotencyStore(
        "https://example.upstash.io",
        "t",
      );

      await expect(store.set("idem:key", entry, 1000)).rejects.toThrow(
        "Upstash operation failed",
      );
    });

    it("should get entries via POST command body instead of path-style REST", async () => {
      const fetchMock = vi.fn(
        async () =>
          new Response(JSON.stringify({ result: JSON.stringify(entry) }), {
            status: 200,
          }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const store = new RedisIdempotencyStore(
        "https://example.upstash.io",
        "t",
      );
      const result = await store.get("unsafe/key?value=yes");

      expect(result).toEqual(entry);
      expect(fetchMock).toHaveBeenCalledWith(
        "https://example.upstash.io",
        expect.objectContaining({
          method: "POST",
          headers: {
            Authorization: "Bearer t",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(["GET", "unsafe/key?value=yes"]),
        }),
      );
    });

    it("returns null when Redis GET resolves to an empty result", async () => {
      const fetchMock = vi.fn(
        async () =>
          new Response(JSON.stringify({ result: null }), { status: 200 }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const store = new RedisIdempotencyStore(
        "https://example.upstash.io",
        "t",
      );

      await expect(store.get("idem:key")).resolves.toBeNull();
      expect(fetchMock).toHaveBeenCalledWith(
        "https://example.upstash.io",
        expect.objectContaining({
          headers: {
            Authorization: "Bearer t",
            "Content-Type": "application/json",
          },
        }),
      );
    });

    it("throws when Redis GET returns a non-object JSON payload", async () => {
      const fetchMock = vi.fn(
        async () =>
          new Response(JSON.stringify({ result: "null" }), { status: 200 }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const store = new RedisIdempotencyStore(
        "https://example.upstash.io",
        "t",
      );

      await expect(store.get("idem:key")).rejects.toThrow(
        "Upstash get returned invalid JSON entry",
      );
    });

    it("throws when Redis GET returns a primitive JSON payload", async () => {
      const fetchMock = vi.fn(
        async () =>
          new Response(JSON.stringify({ result: JSON.stringify("bad") }), {
            status: 200,
          }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const store = new RedisIdempotencyStore(
        "https://example.upstash.io",
        "t",
      );

      await expect(store.get("idem:key")).rejects.toThrow(
        "Upstash get returned invalid JSON entry",
      );
    });

    it("throws when Redis GET returns a non-200 response", async () => {
      const fetchMock = vi.fn(
        async () =>
          new Response(JSON.stringify({ error: "boom" }), {
            status: 500,
            statusText: "boom",
          }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const store = new RedisIdempotencyStore(
        "https://example.upstash.io",
        "t",
      );

      await expect(store.get("idem:key")).rejects.toThrow("Upstash get failed");
    });
    it("should delete entries via DEL command body instead of HTTP DELETE path", async () => {
      const fetchMock = vi.fn(
        async () =>
          new Response(JSON.stringify({ result: 1 }), { status: 200 }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const store = new RedisIdempotencyStore(
        "https://example.upstash.io",
        "t",
      );
      await store.delete("unsafe/key?value=yes");

      expect(fetchMock).toHaveBeenCalledWith(
        "https://example.upstash.io",
        expect.objectContaining({
          method: "POST",
          headers: {
            Authorization: "Bearer t",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(["DEL", "unsafe/key?value=yes"]),
        }),
      );
    });

    it("logs delete failures instead of throwing", async () => {
      const fetchMock = vi.fn(
        async () =>
          new Response(JSON.stringify({ error: "boom" }), {
            status: 500,
            statusText: "boom",
          }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const store = new RedisIdempotencyStore(
        "https://example.upstash.io",
        "t",
      );

      await expect(store.delete("idem:key")).resolves.toBeUndefined();
      expect(mockLoggerError).toHaveBeenCalledWith(
        "[Idempotency] Failed to delete idempotency key: boom",
      );
    });

    it("does not log when Redis delete succeeds", async () => {
      const fetchMock = vi.fn(
        async () =>
          new Response(JSON.stringify({ result: 1 }), { status: 200 }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const store = new RedisIdempotencyStore(
        "https://example.upstash.io",
        "t",
      );

      await expect(store.delete("idem:key")).resolves.toBeUndefined();
      expect(mockLoggerError).not.toHaveBeenCalled();
    });
  });

  describe("MemoryIdempotencyStore", () => {
    const entry: IdempotencyEntry = {
      status: "pending",
      createdAt: 1_700_000_000_000,
      expiresAt: 1_700_000_100_000,
    };

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(entry.createdAt);
    });

    it("claims missing keys and rejects active duplicates", async () => {
      const store = new MemoryIdempotencyStore();

      await expect(store.setIfNotExists("idem:key", entry, 500)).resolves.toBe(
        true,
      );
      await expect(store.setIfNotExists("idem:key", entry, 500)).resolves.toBe(
        false,
      );
    });

    it("allows reclaiming expired keys", async () => {
      const store = new MemoryIdempotencyStore();

      await store.setIfNotExists("idem:key", entry, 500);
      vi.setSystemTime(entry.expiresAt + 1);

      await expect(store.setIfNotExists("idem:key", entry, 500)).resolves.toBe(
        true,
      );
    });

    it("treats entries expiring exactly now as reclaimable", async () => {
      const store = new MemoryIdempotencyStore();

      await store.setIfNotExists("idem:key", entry, 500);
      vi.setSystemTime(entry.expiresAt);

      await expect(store.setIfNotExists("idem:key", entry, 500)).resolves.toBe(
        true,
      );
    });

    it("expires entries when their timer fires", async () => {
      const store = new MemoryIdempotencyStore();

      await store.set("idem:key", entry, 500);
      await expect(store.get("idem:key")).resolves.toEqual(entry);

      await vi.advanceTimersByTimeAsync(500);
      vi.setSystemTime(entry.expiresAt + 1);

      await expect(store.get("idem:key")).resolves.toBeNull();
    });

    it("evicts entries when the timer fires even if expiresAt is still in the future", async () => {
      const store = new MemoryIdempotencyStore();
      const longLivedEntry: IdempotencyEntry = {
        ...entry,
        expiresAt: entry.expiresAt + 10_000,
      };

      await store.set("idem:key", longLivedEntry, 500);
      await vi.advanceTimersByTimeAsync(500);
      vi.setSystemTime(entry.createdAt + 500);

      await expect(store.get("idem:key")).resolves.toBeNull();
    });

    it("treats entries expiring at the current instant as stale on get", async () => {
      const store = new MemoryIdempotencyStore();
      const exactExpiryEntry: IdempotencyEntry = {
        ...entry,
        expiresAt: entry.createdAt + 10,
      };

      await store.set("idem:key", exactExpiryEntry, 1000);
      vi.setSystemTime(exactExpiryEntry.expiresAt);

      await expect(store.get("idem:key")).resolves.toBeNull();
    });

    it("clears stored timers when delete is called", async () => {
      const store = new MemoryIdempotencyStore();

      await store.set("idem:key", entry, 500);
      await store.delete("idem:key");

      await expect(store.get("idem:key")).resolves.toBeNull();

      await vi.advanceTimersByTimeAsync(1000);

      await expect(store.get("idem:key")).resolves.toBeNull();
    });

    it("replaces existing timers when a key is updated", async () => {
      const store = new MemoryIdempotencyStore();

      await store.set("idem:key", entry, 500);
      await vi.advanceTimersByTimeAsync(250);

      const updatedEntry: IdempotencyEntry = {
        ...entry,
        status: "success",
        response: { ok: true },
        expiresAt: entry.expiresAt + 1000,
      };

      await store.set("idem:key", updatedEntry, 1000);
      await vi.advanceTimersByTimeAsync(249);
      vi.setSystemTime(entry.createdAt + 499);

      await expect(store.get("idem:key")).resolves.toEqual(updatedEntry);

      await vi.advanceTimersByTimeAsync(251);
      vi.setSystemTime(entry.createdAt + 750);

      await expect(store.get("idem:key")).resolves.toEqual(updatedEntry);

      await vi.advanceTimersByTimeAsync(500);
      vi.setSystemTime(updatedEntry.expiresAt + 1);

      await expect(store.get("idem:key")).resolves.toBeNull();
    });
  });
});
