type RequestLike = {
  json(): Promise<{ field: string; value?: string }>;
  nextUrl: URL;
};

async function badBodyFieldWrite(request: RequestLike) {
  const body = await request.json();
  const target: Record<string, string | undefined> = {};

  // ruleid: object-injection-untrusted-key-write
  target[body.field] = body.value;

  return target;
}

function badSearchParamWrite(request: RequestLike) {
  const field = request.nextUrl.searchParams.get("field");
  const target: Record<string, string> = {};

  if (field !== null) {
    // ruleid: object-injection-untrusted-key-write
    target[field] = "unsafe";
  }

  return target;
}

function badInlineSearchParamWrite(request: RequestLike) {
  const target: Record<string, string> = {};

  // ruleid: object-injection-untrusted-key-write
  target[request.nextUrl.searchParams.get("field") ?? "fallback"] = "unsafe";

  return target;
}

function okLiteralWrite() {
  const target: Record<string, string> = {};

  // ok: object-injection-untrusted-key-write
  target["field"] = "safe";

  return target;
}

function okAllowedKeyWrite(field: "name" | "email") {
  const target: Record<"name" | "email", string> = {
    name: "",
    email: "",
  };

  // ok: object-injection-untrusted-key-write
  target[field] = "safe";

  return target;
}

const ALLOWED_FIELDS: readonly string[] = ["name", "email"];
const ALLOWED_FIELD_SET = new Set<string>(ALLOWED_FIELDS);

function okAllowlistIncludesWrite(request: RequestLike) {
  const field = request.nextUrl.searchParams.get("field");
  const target: Record<string, string> = {};

  if (field !== null && ALLOWED_FIELDS.includes(field)) {
    // ok: object-injection-untrusted-key-write
    target[field] = "safe";
  }

  return target;
}

function okAllowlistSetWrite(request: RequestLike) {
  const field = request.nextUrl.searchParams.get("field");
  const target: Record<string, string> = {};

  if (field !== null && ALLOWED_FIELD_SET.has(field)) {
    // ok: object-injection-untrusted-key-write
    target[field] = "safe";
  }

  return target;
}

function okEarlyReturnAllowlistWrite(request: RequestLike) {
  const field = request.nextUrl.searchParams.get("field");
  const target: Record<string, string> = {};

  if (field === null || !ALLOWED_FIELD_SET.has(field)) {
    return target;
  }

  // ok: object-injection-untrusted-key-write
  target[field] = "safe";

  return target;
}
