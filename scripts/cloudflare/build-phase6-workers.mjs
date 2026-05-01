import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  PHASE6_WORKERS_BY_KEY,
  getPhase6ApiRouteRules,
  getPhase6ConfigFileName,
  getPhase6WorkerNames,
} from "./phase6-topology-contract.mjs";
import { parseJsoncText } from "./jsonc-utils.mjs";

const ROOT_DIR = process.cwd();
const OPEN_NEXT_DIR = path.join(ROOT_DIR, ".open-next");
const WORKERS_DIR = path.join(OPEN_NEXT_DIR, "workers");
const WRANGLER_DIR = path.join(OPEN_NEXT_DIR, "wrangler", "phase6");
const SOURCE_WRANGLER_CONFIG_PATH = path.join(ROOT_DIR, "wrangler.jsonc");
const PHASE6_ALIAS = {
  "@vercel/turbopack-ecmascript-runtime/browser/dev/hmr-client/hmr-client.ts":
    "../../../scripts/cloudflare/shims/empty-module.mjs",
};

const BIND_DOMAIN = process.argv.includes("--bind-domain");

const DOMAIN_ROUTES = {
  preview: [{ pattern: "preview.example.com/*", zone_name: "example.com" }],
  production: [{ pattern: "example.com/*", zone_name: "example.com" }],
};

const API_ROUTE_BINDING_RULES = getPhase6ApiRouteRules().map((rule) => ({
  match: `(pathname) => pathname === ${JSON.stringify(rule.pathname)}`,
  binding: PHASE6_WORKERS_BY_KEY[rule.workerKey].binding,
  target: rule.workerKey,
}));
const FORBIDDEN_RUNTIME_CACHE_CONFIG_KEYS = [
  "r2_buckets",
  "d1_databases",
  "durable_objects",
  "migrations",
];

function normalizeWorkerNames(baseName) {
  return getPhase6WorkerNames(baseName);
}

function cloneJSON(value) {
  return value ? JSON.parse(JSON.stringify(value)) : value;
}

function withServiceEnvironment(services, envName) {
  return services.map((service) => ({
    ...service,
    environment: envName,
  }));
}

function withEnvSuffixedServiceName(services, envName) {
  return services.map((service) => ({
    ...service,
    service: `${service.service}-${envName}`,
  }));
}

function resolveEnvConfig(baseConfig, envName) {
  const envConfig = baseConfig.env?.[envName] ?? {};
  return {
    vars: cloneJSON(envConfig.vars ?? {}),
  };
}

function assertNoRuntimeCacheConfig(config, label) {
  for (const key of FORBIDDEN_RUNTIME_CACHE_CONFIG_KEYS) {
    if (Object.prototype.hasOwnProperty.call(config, key)) {
      throw new Error(
        `[phase6] ${label} must not declare ${key}; runtime cache bindings were removed.`,
      );
    }
  }
}

function assertRuntimeCacheBindingsAbsent(baseConfig) {
  assertNoRuntimeCacheConfig(baseConfig, "wrangler.jsonc");

  for (const [envName, envConfig] of Object.entries(baseConfig.env ?? {})) {
    assertNoRuntimeCacheConfig(envConfig, `wrangler.jsonc env.${envName}`);
  }
}

function createCommonConfig(baseConfig, name, main, { includeAssets }) {
  const config = {
    compatibility_date: baseConfig.compatibility_date,
    compatibility_flags: cloneJSON(baseConfig.compatibility_flags ?? []),
    name,
    main,
    alias: cloneJSON(PHASE6_ALIAS),
  };

  // Keep placement as a deployment-wide intent. The current launch posture is
  // all phase6 workers inherit wrangler.jsonc Smart Placement until production
  // traffic proves a worker-specific placement split is better.
  if (baseConfig.placement) {
    config.placement = cloneJSON(baseConfig.placement);
  }

  if (includeAssets) {
    config.assets = {
      directory: "../../assets",
      binding: baseConfig.assets?.binding ?? "ASSETS",
    };
  }

  return config;
}

function createServerWorkerConfig(
  baseConfig,
  workerNames,
  workerKey,
  envNames,
) {
  const name = workerNames[workerKey];
  const config = createCommonConfig(
    baseConfig,
    name,
    `../../workers/${workerKey}.mjs`,
    {
      includeAssets: workerKey === "web",
    },
  );

  config.env = {};
  for (const envName of envNames) {
    const envConfig = resolveEnvConfig(baseConfig, envName);
    config.env[envName] = {
      vars: envConfig.vars,
    };
  }

  return config;
}

/**
 * Derive gateway service bindings from API_ROUTE_BINDING_RULES (single source of truth).
 * Always includes WORKER_WEB; API bindings are generated from the route rules.
 */
function createGatewayServiceBindings(workerNames) {
  const seen = new Set();
  const apiBindings = [];

  for (const rule of API_ROUTE_BINDING_RULES) {
    if (seen.has(rule.binding)) continue;
    seen.add(rule.binding);
    apiBindings.push({
      binding: rule.binding,
      service: workerNames[rule.target],
    });
  }

  return [{ binding: "WORKER_WEB", service: workerNames.web }, ...apiBindings];
}

function createGatewayConfig(baseConfig, workerNames, envNames) {
  const config = createCommonConfig(
    baseConfig,
    workerNames.gateway,
    "../../workers/gateway.mjs",
    { includeAssets: true },
  );

  const serviceBindings = createGatewayServiceBindings(workerNames);
  config.services = serviceBindings;
  config.env = {};

  for (const envName of envNames) {
    const envConfig = resolveEnvConfig(baseConfig, envName);
    const envBlock = {
      services: withEnvSuffixedServiceName(serviceBindings, envName),
      vars: envConfig.vars,
    };

    if (BIND_DOMAIN && DOMAIN_ROUTES[envName]) {
      envBlock.routes = cloneJSON(DOMAIN_ROUTES[envName]);
    }

    config.env[envName] = envBlock;
  }

  return config;
}

function createGatewayWorkerSource() {
  const routeRulesSource = API_ROUTE_BINDING_RULES.map(
    (rule) =>
      `  {\n    target: "${rule.target}",\n    binding: "${rule.binding}",\n    match: ${rule.match},\n  }`,
  ).join(",\n");

  const routeResolver = API_ROUTE_BINDING_RULES.map(
    (rule, index) => `
  if (routeRules[${index}].match(pathname)) {
    return routeRules[${index}];
  }`,
  ).join("");

  return `//@ts-expect-error: Will be resolved by wrangler build
import { handleImageRequest } from "../cloudflare/images.js";
//@ts-expect-error: Will be resolved by wrangler build
import { runWithCloudflareRequestContext } from "../cloudflare/init.js";
//@ts-expect-error: Will be resolved by wrangler build
import { maybeGetSkewProtectionResponse } from "../cloudflare/skew-protection.js";
// @ts-expect-error: Will be resolved by wrangler build
import { handler as middlewareHandler } from "../middleware/handler.mjs";

const routeRules = [
${routeRulesSource}
];

function readRequestId(request) {
  const directRequestId = request.headers.get("x-request-id")?.trim();
  if (directRequestId) {
    return directRequestId;
  }

  const correlationId = request.headers.get("x-correlation-id")?.trim();
  if (correlationId) {
    return correlationId;
  }

  return crypto.randomUUID();
}

function createHealthResponse(request) {
  const headers = new Headers({
    "cache-control": "no-store",
    "content-type": "application/json",
    "x-observability-surface": "cache-health",
  });
  headers.set("x-request-id", readRequestId(request));
  headers.set("x-phase6-origin-target", "gateway-health");

  return new Response(JSON.stringify({ status: "ok" }), {
    headers,
    status: 200,
  });
}

function resolveOriginRoute(pathname) {${routeResolver}
  return { target: "web", binding: "WORKER_WEB", match: () => true };
}

function getBoundService(env, bindingName) {
  const service = env[bindingName];
  if (!service || typeof service.fetch !== "function") {
    throw new Error(\`Missing service binding: \${bindingName}\`);
  }
  return service;
}

export default {
  async fetch(request, env, ctx) {
    return runWithCloudflareRequestContext(request, env, ctx, async () => {
      const skewResponse = maybeGetSkewProtectionResponse(request);
      if (skewResponse) {
        return skewResponse;
      }

      const url = new URL(request.url);

      if (url.pathname === "/api/health") {
        return createHealthResponse(request);
      }

      if (url.pathname.startsWith("/cdn-cgi/image/")) {
        const match = url.pathname.match(/\\/cdn-cgi\\/image\\/.+?\\/(?<url>.+)$/);
        if (!match) {
          return new Response("Not Found!", { status: 404 });
        }

        const imageUrl = match.groups.url;
        return imageUrl.match(/^https?:\\/\\//)
          ? fetch(imageUrl, { cf: { cacheEverything: true } })
          : env.ASSETS?.fetch(new URL(\`/\${imageUrl}\`, url));
      }

      if (
        url.pathname ===
        \`\${globalThis.__NEXT_BASE_PATH__}/_next/image\${globalThis.__TRAILING_SLASH__ ? "/" : ""}\`
      ) {
        return handleImageRequest(url, request.headers, env);
      }

      const middlewareResult = await middlewareHandler(request, env, ctx);
      if (middlewareResult instanceof Response) {
        return middlewareResult;
      }

      const rewrittenPathname = new URL(middlewareResult.url).pathname;
      const route = resolveOriginRoute(rewrittenPathname);
      const targetService = getBoundService(env, route.binding);
      const response = await targetService.fetch(middlewareResult);
      const nextHeaders = new Headers(response.headers);
      nextHeaders.set("x-phase6-origin-target", route.target);

      return new Response(response.body, {
        headers: nextHeaders,
        status: response.status,
        statusText: response.statusText,
      });
    });
  },
};
`;
}

function createServiceWorkerSource(functionName, importPath) {
  return `//@ts-expect-error: Will be resolved by wrangler build
import { runWithCloudflareRequestContext } from "../cloudflare/init.js";

let cachedHandler;

async function getServerHandler() {
  if (cachedHandler) {
    return cachedHandler;
  }

  // @ts-expect-error: Will be resolved by wrangler build
  const mod = await import("${importPath}");
  if (typeof mod.handler !== "function") {
    throw new Error("OpenNext handler is not available");
  }

  cachedHandler = mod.handler;
  return cachedHandler;
}

export default {
  async fetch(request, env, ctx) {
    return runWithCloudflareRequestContext(request, env, ctx, async () => {
      const handler = await getServerHandler();
      const response = await handler(request, env, ctx, request.signal);
      const headers = new Headers(response.headers);
      headers.set("x-phase6-worker", "${functionName}");
      return new Response(response.body, {
        headers,
        status: response.status,
        statusText: response.statusText,
      });
    });
  },
};
`;
}

async function writeJsonFile(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function main() {
  const wranglerText = await readFile(SOURCE_WRANGLER_CONFIG_PATH, "utf8");
  const baseConfig = parseJsoncText(SOURCE_WRANGLER_CONFIG_PATH, wranglerText);
  assertRuntimeCacheBindingsAbsent(baseConfig);
  const baseWorkerName = baseConfig.name ?? "showcase-website";
  const workerNames = normalizeWorkerNames(baseWorkerName);

  await mkdir(WORKERS_DIR, { recursive: true });
  await mkdir(WRANGLER_DIR, { recursive: true });

  // Derive unique API worker targets from the single source of truth
  const apiWorkerTargets = [
    ...new Set(API_ROUTE_BINDING_RULES.map((rule) => rule.target)),
  ];

  // Generate worker source files: gateway + web + API workers from route rules
  const workerFiles = {
    gateway: createGatewayWorkerSource(),
    web: createServiceWorkerSource(
      "web",
      "../server-functions/default/handler.mjs",
    ),
  };

  for (const target of apiWorkerTargets) {
    workerFiles[target] = createServiceWorkerSource(
      target,
      `../server-functions/${target}/index.mjs`,
    );
  }

  await Promise.all(
    Object.entries(workerFiles).map(([name, content]) =>
      writeFile(path.join(WORKERS_DIR, `${name}.mjs`), content, "utf8"),
    ),
  );

  // Generate wrangler configs: gateway + web + API workers from route rules
  const envNames = ["preview", "production"];
  const gatewayConfig = createGatewayConfig(baseConfig, workerNames, envNames);
  const webConfig = createServerWorkerConfig(
    baseConfig,
    workerNames,
    "web",
    envNames,
  );

  const configWriteOps = [
    writeJsonFile(path.join(WRANGLER_DIR, "gateway.jsonc"), gatewayConfig),
    writeJsonFile(path.join(WRANGLER_DIR, "web.jsonc"), webConfig),
  ];

  for (const target of apiWorkerTargets) {
    const configFileName = getPhase6ConfigFileName(target);
    const config = createServerWorkerConfig(
      baseConfig,
      workerNames,
      target,
      envNames,
    );
    configWriteOps.push(
      writeJsonFile(path.join(WRANGLER_DIR, configFileName), config),
    );
  }

  await Promise.all(configWriteOps);

  console.log("[phase6] generated workers and wrangler configs");
  console.log(`[phase6] workers: ${path.relative(ROOT_DIR, WORKERS_DIR)}`);
  console.log(`[phase6] configs: ${path.relative(ROOT_DIR, WRANGLER_DIR)}`);
  if (BIND_DOMAIN) {
    console.log(
      "[phase6] gateway routes: domain binding enabled (--bind-domain)",
    );
  } else {
    console.log("[phase6] gateway routes: workers.dev only (no --bind-domain)");
  }
}

await main();
