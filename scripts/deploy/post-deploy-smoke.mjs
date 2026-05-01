import { URL } from "node:url";
import runtimeEnv from "../lib/runtime-env.js";

const DEFAULT_BASE_URL =
  runtimeEnv.readEnvString("DEPLOY_SMOKE_BASE_URL") || "";
const REQUEST_TIMEOUT_MS = 30000;
const REQUEST_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getRetryDelayMs(attempt) {
  return RETRY_DELAY_MS * 2 ** attempt;
}

function parseArgs(argv) {
  const args = {
    baseUrl: DEFAULT_BASE_URL,
    headerName: runtimeEnv.readEnvString("DEPLOY_SMOKE_HEADER_NAME") || "",
    headerValue: runtimeEnv.readEnvString("DEPLOY_SMOKE_HEADER_VALUE") || "",
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

    if (arg === "--header-name" && i + 1 < argv.length) {
      args.headerName = argv[++i];
      continue;
    }

    if (arg === "--header-value" && i + 1 < argv.length) {
      args.headerValue = argv[++i];
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!args.baseUrl) {
    throw new Error("Missing required --base-url");
  }

  if (Boolean(args.headerName) !== Boolean(args.headerValue)) {
    throw new Error(
      "Both --header-name and --header-value must be provided together",
    );
  }

  return args;
}

function buildHeaders(headerName, headerValue) {
  const headers = {
    "user-agent": "post-deploy-smoke",
  };

  if (headerName && headerValue) {
    headers[headerName] = headerValue;
  }

  return headers;
}

async function request(baseUrl, pathname, headers, retryEvents) {
  const url = new URL(pathname, baseUrl);

  let retries = 0;
  let lastError;

  for (let attempt = 0; attempt <= REQUEST_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        redirect: "manual",
        headers,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const body = await response.text();

      if (response.status >= 500 && attempt < REQUEST_RETRIES) {
        retries += 1;
        const nextAttempt = attempt + 2;
        retryEvents.push({
          pathname,
          reason: `status ${response.status}`,
          nextAttempt,
        });
        console.warn(
          `[post-deploy-smoke] ${pathname} returned ${response.status}; retrying attempt ${nextAttempt}/${REQUEST_RETRIES + 1}`,
        );
        await delay(getRetryDelayMs(attempt));
        continue;
      }

      return {
        pathname,
        status: response.status,
        location: response.headers.get("location"),
        body,
        retries,
      };
    } catch (error) {
      lastError = error;
      if (!isRetriableFetchError(error)) {
        throw error;
      }

      if (attempt < REQUEST_RETRIES) {
        retries += 1;
        const nextAttempt = attempt + 2;
        retryEvents.push({
          pathname,
          reason: error instanceof Error ? error.message : String(error),
          nextAttempt,
        });
        console.warn(
          `[post-deploy-smoke] ${pathname} request failed; retrying attempt ${nextAttempt}/${REQUEST_RETRIES + 1}`,
        );
        await delay(getRetryDelayMs(attempt));
      }
    }
  }

  throw new Error("post-deploy-smoke retry loop exited without a response", {
    cause: lastError,
  });
}

function isRetriableFetchError(error) {
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return true;
  }

  return (
    error instanceof Error &&
    "cause" in error &&
    typeof error.cause === "object" &&
    error.cause !== null &&
    "code" in error.cause &&
    error.cause.code === "UND_ERR_CONNECT_TIMEOUT"
  );
}

function assert(condition, message, failures) {
  if (!condition) {
    failures.push(message);
  }
}

async function main() {
  const { baseUrl, headerName, headerValue } = parseArgs(process.argv);
  const headers = buildHeaders(headerName, headerValue);
  const failures = [];
  const retryEvents = [];

  console.log(`[post-deploy-smoke] Probing ${baseUrl}`);

  const rootResponse = await request(baseUrl, "/", headers, retryEvents);
  const invalidLocaleResponse = await request(
    baseUrl,
    "/invalid/contact",
    headers,
    retryEvents,
  );
  // Probe serially so Cloudflare cold-start retries stay readable and do not
  // hammer a freshly deployed workers.dev preview.
  const pages = [];
  for (const pathname of [
    "/en",
    "/zh",
    "/api/health",
    "/en/contact",
    "/zh/contact",
  ]) {
    pages.push(await request(baseUrl, pathname, headers, retryEvents));
  }

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

  for (const response of pages) {
    assert(
      response.status === 200,
      `Expected ${response.pathname} to return 200, got ${response.status}`,
      failures,
    );
  }

  if (failures.length > 0) {
    console.error("[post-deploy-smoke] Failures detected:");
    for (const failure of failures) {
      console.error(`  - ${failure}`);
    }
    process.exit(1);
  }

  if (retryEvents.length > 0) {
    console.warn("[post-deploy-smoke] Retried probes:");
    for (const retry of retryEvents) {
      console.warn(
        `  - ${retry.pathname}: ${retry.reason}; next attempt ${retry.nextAttempt}/${REQUEST_RETRIES + 1}`,
      );
    }
  }

  console.log("[post-deploy-smoke] All checks passed");
}

main().catch((error) => {
  console.error("[post-deploy-smoke] Unexpected error:", error);
  process.exit(1);
});
