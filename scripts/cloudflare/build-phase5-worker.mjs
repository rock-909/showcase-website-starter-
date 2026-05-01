import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const outputPath = path.join(process.cwd(), ".open-next", "worker.phase5.mjs");

const workerSource = `//@ts-expect-error: Will be resolved by wrangler build
import { handleImageRequest } from "./cloudflare/images.js";
//@ts-expect-error: Will be resolved by wrangler build
import { runWithCloudflareRequestContext } from "./cloudflare/init.js";
	//@ts-expect-error: Will be resolved by wrangler build
	import { maybeGetSkewProtectionResponse } from "./cloudflare/skew-protection.js";
	// @ts-expect-error: Will be resolved by wrangler build
	import { handler as middlewareHandler } from "./middleware/handler.mjs";
	
	const serverFunctionLoaders = {
	  default: () => import("./server-functions/default/handler.mjs"),
	  apiLead: () => import("./server-functions/apiLead/index.mjs"),
	};

const serverFunctionHandlerCache = new Map();

async function getServerFunctionHandler(name) {
  if (serverFunctionHandlerCache.has(name)) {
    return serverFunctionHandlerCache.get(name);
  }

  const loader = serverFunctionLoaders[name];
  if (!loader) {
    throw new Error(\`Unknown server function: \${name}\`);
  }

  const mod = await loader();
  if (typeof mod.handler !== "function") {
    throw new Error(\`Invalid server function module: \${name}\`);
  }

  serverFunctionHandlerCache.set(name, mod.handler);
  return mod.handler;
	}
	
	function resolveServerFunction(pathname) {
	  if (
	    pathname === "/api/inquiry" ||
    pathname === "/api/subscribe" ||
    pathname === "/api/verify-turnstile" ||
    pathname === "/api/health"
  ) {
    return "apiLead";
  }

  return "default";
}

export default {
  async fetch(request, env, ctx) {
    return runWithCloudflareRequestContext(request, env, ctx, async () => {
      const response = maybeGetSkewProtectionResponse(request);
      if (response) {
        return response;
      }

      const url = new URL(request.url);

      // Serve images in development.
      // Note: "/cdn-cgi/image/..." requests do not reach production workers.
      if (url.pathname.startsWith("/cdn-cgi/image/")) {
        const m = url.pathname.match(/\\/cdn-cgi\\/image\\/.+?\\/(?<url>.+)$/);
        if (m === null) {
          return new Response("Not Found!", { status: 404 });
        }

        const imageUrl = m.groups.url;
        return imageUrl.match(/^https?:\\/\\//)
          ? fetch(imageUrl, { cf: { cacheEverything: true } })
          : env.ASSETS?.fetch(new URL(\`/\${imageUrl}\`, url));
      }

      // Fallback for the Next default image loader.
      if (
        url.pathname ===
        \`\${globalThis.__NEXT_BASE_PATH__}/_next/image\${globalThis.__TRAILING_SLASH__ ? "/" : ""}\`
      ) {
        return await handleImageRequest(url, request.headers, env);
      }

      const reqOrResp = await middlewareHandler(request, env, ctx);
      if (reqOrResp instanceof Response) {
        return reqOrResp;
      }

      const rewrittenPathname = new URL(reqOrResp.url).pathname;
      const targetFunctionName = resolveServerFunction(rewrittenPathname);
      const serverHandler = await getServerFunctionHandler(targetFunctionName);

      return serverHandler(reqOrResp, env, ctx, request.signal);
    });
  },
};
`;

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, workerSource, "utf8");

console.log(`[phase5] generated ${path.relative(process.cwd(), outputPath)}`);
