import type { NextRequest } from "next/server";
import { API_ERROR_CODES } from "@/constants/api-error-codes";
import { HTTP_BAD_REQUEST, HTTP_PAYLOAD_TOO_LARGE } from "@/constants";
import { logger } from "@/lib/logger";

const DEFAULT_MAX_JSON_BODY_BYTES = 64 * 1024;

type ReadBodyFailure = {
  ok: false;
  errorCode:
    | typeof API_ERROR_CODES.INVALID_JSON_BODY
    | typeof API_ERROR_CODES.PAYLOAD_TOO_LARGE;
  statusCode: typeof HTTP_BAD_REQUEST | typeof HTTP_PAYLOAD_TOO_LARGE;
};

type ReadBodySuccess<T> = {
  ok: true;
  data: T;
  rawBody: string;
  bodyHash: string;
};

export type ReadAndHashBodyResult<T> = ReadBodySuccess<T> | ReadBodyFailure;

function createPayloadTooLargeFailure(): ReadBodyFailure {
  return {
    ok: false,
    errorCode: API_ERROR_CODES.PAYLOAD_TOO_LARGE,
    statusCode: HTTP_PAYLOAD_TOO_LARGE,
  };
}

function createInvalidJsonFailure(): ReadBodyFailure {
  return {
    ok: false,
    errorCode: API_ERROR_CODES.INVALID_JSON_BODY,
    statusCode: HTTP_BAD_REQUEST,
  };
}

function resolveMaxBytes(options?: { maxBytes?: number }): number {
  return typeof options?.maxBytes === "number" && options.maxBytes > 0
    ? options.maxBytes
    : DEFAULT_MAX_JSON_BODY_BYTES;
}

interface DecodeContext {
  route: string | undefined;
  maxBytes: number;
}

function decodeChunk(
  decoder: TextDecoder,
  value: Uint8Array,
  context: DecodeContext,
): string | ReadBodyFailure {
  const { route, maxBytes } = context;
  try {
    return decoder.decode(value, { stream: true });
  } catch (error) {
    logger.warn("Failed to decode JSON body as UTF-8", {
      route,
      maxBytes,
      error: error instanceof Error ? error.message : String(error),
    });
    return createInvalidJsonFailure();
  }
}

function finalizeDecodedBody(
  decoder: TextDecoder,
  context: DecodeContext,
): string | ReadBodyFailure {
  const { route, maxBytes } = context;
  try {
    return decoder.decode();
  } catch (error) {
    logger.warn("Failed to decode JSON body as UTF-8", {
      route,
      maxBytes,
      error: error instanceof Error ? error.message : String(error),
    });
    return createInvalidJsonFailure();
  }
}

function decodeBodyChunk(
  value: Uint8Array,
  state: {
    totalBytes: number;
    route: string | undefined;
    maxBytes: number;
    decoder: TextDecoder;
    context: DecodeContext;
  },
):
  | { ok: true; totalBytes: number; text: string }
  | { ok: false; failure: ReadBodyFailure } {
  const {
    totalBytes: previousTotalBytes,
    route,
    maxBytes,
    decoder,
    context,
  } = state;
  const totalBytes = previousTotalBytes + value.byteLength;
  if (totalBytes > maxBytes) {
    logger.warn("JSON body exceeds byte-size limit", {
      route,
      maxBytes,
    });
    return { ok: false, failure: createPayloadTooLargeFailure() };
  }

  const decodedChunk = decodeChunk(decoder, value, context);
  if (typeof decodedChunk !== "string") {
    return { ok: false, failure: decodedChunk };
  }

  return {
    ok: true,
    totalBytes,
    text: decodedChunk,
  };
}

async function readDecodedText(context: {
  reader: ReadableStreamDefaultReader<Uint8Array>;
  decoder: TextDecoder;
  route: string | undefined;
  maxBytes: number;
}): Promise<string | ReadBodyFailure> {
  const { reader, decoder, route, maxBytes } = context;
  const decodeContext: DecodeContext = { route, maxBytes };
  let totalBytes = 0;
  let text = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    const chunkResult = decodeBodyChunk(value, {
      totalBytes,
      route,
      maxBytes,
      decoder,
      context: decodeContext,
    });
    if (!chunkResult.ok) {
      await reader.cancel();
      return chunkResult.failure;
    }

    ({ totalBytes } = chunkResult);
    text += chunkResult.text;
  }

  const trailingText = finalizeDecodedBody(decoder, decodeContext);
  if (typeof trailingText !== "string") {
    return trailingText;
  }

  return `${text}${trailingText}`;
}

async function readBodyWithinLimit(
  req: NextRequest,
  route: string | undefined,
  maxBytes: number,
): Promise<string | ReadBodyFailure> {
  if (!req.body) {
    return "";
  }

  const reader = req.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });

  try {
    return await readDecodedText({
      reader,
      decoder,
      route,
      maxBytes,
    });
  } finally {
    reader.releaseLock();
  }
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(
      ([left], [right]) => left.localeCompare(right),
    );
    return `{${entries
      .map(
        ([key, nestedValue]) =>
          `${JSON.stringify(key)}:${stableStringify(nestedValue)}`,
      )
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

async function createBodyHash(value: unknown): Promise<string> {
  const encoded = new TextEncoder().encode(stableStringify(value));
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function readAndHashJsonBody<T>(
  req: NextRequest,
  options?: {
    route?: string;
    maxBytes?: number;
  },
): Promise<ReadAndHashBodyResult<T>> {
  const maxBytes = resolveMaxBytes(options);
  const route = options?.route;
  const contentLengthHeader = req.headers.get("content-length");
  const contentLength = contentLengthHeader
    ? Number.parseInt(contentLengthHeader, 10)
    : Number.NaN;

  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    logger.warn("JSON body exceeds declared content-length limit", {
      route,
      maxBytes,
      contentLength,
    });
    return createPayloadTooLargeFailure();
  }

  try {
    const rawBody = await readBodyWithinLimit(req, route, maxBytes);
    if (typeof rawBody !== "string") {
      return rawBody;
    }

    const raw = JSON.parse(rawBody) as unknown;
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
      logger.warn("Invalid JSON structure - expected object", {
        route,
        receivedType: Array.isArray(raw) ? "array" : typeof raw,
      });
      return createInvalidJsonFailure();
    }

    return {
      ok: true,
      data: raw as T,
      rawBody,
      bodyHash: await createBodyHash(raw),
    };
  } catch (error) {
    logger.warn("Failed to parse JSON body", {
      route,
      error: error instanceof Error ? error.message : String(error),
    });
    return createInvalidJsonFailure();
  }
}
