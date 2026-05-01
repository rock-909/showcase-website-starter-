import { URL } from "node:url";
import runtimeEnv from "../lib/runtime-env.js";

const DEFAULT_BASE_URL =
  runtimeEnv.readEnvString("CLOUDFLARE_PREVIEW_BASE_URL") ||
  "http://127.0.0.1:8787";

function parseArgs(argv) {
  const args = {
    baseUrl: DEFAULT_BASE_URL,
    includeApiHealth: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === "--") {
      continue;
    }

    if (arg === "--base-url" && i + 1 < argv.length) {
      args.baseUrl = argv[++i];
      continue;
    }

    if (arg === "--include-api-health") {
      args.includeApiHealth = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function normalizeSetCookieFlags(cookieHeader) {
  return cookieHeader
    .split(";")
    .slice(1)
    .map((part) => part.trim().toLowerCase())
    .filter((part) => !part.startsWith("expires="))
    .filter(Boolean)
    .sort();
}

async function request(baseUrl, pathname) {
  const url = new URL(pathname, baseUrl);
  const response = await fetch(url, {
    redirect: "manual",
    headers: {
      "user-agent": "cloudflare-preview-smoke",
    },
  });

  return {
    pathname,
    status: response.status,
    location: response.headers.get("location"),
    setCookie: response.headers.get("set-cookie"),
    leakedMiddlewareCookie: response.headers.get("x-middleware-set-cookie"),
    body: await response.text(),
  };
}

function assert(condition, message, failures) {
  if (!condition) {
    failures.push(message);
  }
}

async function main() {
  const { baseUrl, includeApiHealth } = parseArgs(process.argv);
  const failures = [];

  console.log(
    `[cf-preview-smoke] Probing ${baseUrl} (${includeApiHealth ? "strict" : "page/header"} mode)`,
  );

  const rootResponse = await request(baseUrl, "/");
  const invalidLocaleResponse = await request(baseUrl, "/invalid/contact");
  const invalidLocaleDynamicResponse = await request(
    baseUrl,
    "/fr/products/eu/fittings",
  );
  const pageResponses = await Promise.all([
    request(baseUrl, "/en"),
    request(baseUrl, "/zh"),
    request(baseUrl, "/en/contact"),
    request(baseUrl, "/zh/contact"),
  ]);
  const apiHealthResponse = includeApiHealth
    ? await request(baseUrl, "/api/health")
    : null;

  assert(
    [200, 307, 308].includes(rootResponse.status),
    `Expected / to return 200/307/308, got ${rootResponse.status}`,
    failures,
  );

  if ([307, 308].includes(rootResponse.status)) {
    assert(
      rootResponse.location === "/en",
      `Expected / redirect location to be /en, got ${rootResponse.location ?? "(missing)"}`,
      failures,
    );
  }

  assert(
    [307, 308].includes(invalidLocaleResponse.status),
    `Expected /invalid/contact to redirect, got ${invalidLocaleResponse.status}`,
    failures,
  );
  assert(
    invalidLocaleResponse.location === "/en/contact",
    `Expected /invalid/contact redirect location to be /en/contact, got ${invalidLocaleResponse.location ?? "(missing)"}`,
    failures,
  );
  assert(
    [307, 308].includes(invalidLocaleDynamicResponse.status),
    `Expected /fr/products/eu/fittings to redirect, got ${invalidLocaleDynamicResponse.status}`,
    failures,
  );
  assert(
    invalidLocaleDynamicResponse.location === "/en/products/eu/fittings",
    `Expected /fr/products/eu/fittings redirect location to be /en/products/eu/fittings, got ${invalidLocaleDynamicResponse.location ?? "(missing)"}`,
    failures,
  );

  for (const response of [
    rootResponse,
    invalidLocaleResponse,
    invalidLocaleDynamicResponse,
    ...pageResponses,
    ...(apiHealthResponse ? [apiHealthResponse] : []),
  ]) {
    assert(
      response.leakedMiddlewareCookie === null,
      `Unexpected x-middleware-set-cookie leak on ${response.pathname}`,
      failures,
    );
  }

  for (const response of pageResponses) {
    assert(
      response.status === 200,
      `Expected ${response.pathname} to return 200, got ${response.status}`,
      failures,
    );
    assert(
      !response.body.includes("Unexpected loadManifest"),
      `Unexpected manifest loader failure surfaced on ${response.pathname}`,
      failures,
    );
  }

  if (apiHealthResponse) {
    assert(
      apiHealthResponse.status === 200,
      `Expected /api/health to return 200, got ${apiHealthResponse.status}`,
      failures,
    );
    assert(
      !apiHealthResponse.body.includes("Unexpected loadManifest"),
      "Unexpected manifest loader failure surfaced on /api/health",
      failures,
    );
  } else {
    console.log(
      "[cf-preview-smoke] Skipping /api/health (diagnostic-only in local preview).",
    );
    console.log(
      "[cf-preview-smoke] Policy: local preview proves page/header/cookie behavior. API proof belongs to deployed smoke.",
    );
    console.log("[cf-preview-smoke] Reference: .claude/rules/cloudflare.md");
  }

  if (
    rootResponse.setCookie &&
    invalidLocaleResponse.setCookie &&
    invalidLocaleDynamicResponse.setCookie
  ) {
    const rootFlags = normalizeSetCookieFlags(rootResponse.setCookie);
    const invalidFlags = normalizeSetCookieFlags(
      invalidLocaleResponse.setCookie,
    );
    const invalidDynamicFlags = normalizeSetCookieFlags(
      invalidLocaleDynamicResponse.setCookie,
    );
    assert(
      JSON.stringify(rootFlags) === JSON.stringify(invalidFlags),
      `NEXT_LOCALE cookie flags differ between / and /invalid/contact (${rootFlags.join(", ") || "none"} vs ${invalidFlags.join(", ") || "none"})`,
      failures,
    );
    assert(
      JSON.stringify(rootFlags) === JSON.stringify(invalidDynamicFlags),
      `NEXT_LOCALE cookie flags differ between / and /fr/products/eu/fittings (${rootFlags.join(", ") || "none"} vs ${invalidDynamicFlags.join(", ") || "none"})`,
      failures,
    );
  }

  if (failures.length > 0) {
    console.error("[cf-preview-smoke] Failures detected:");
    for (const failure of failures) {
      console.error(`  - ${failure}`);
    }
    process.exit(1);
  }

  console.log("[cf-preview-smoke] All checks passed");
}

main().catch((error) => {
  console.error("[cf-preview-smoke] Unexpected error:", error);
  process.exit(1);
});
