import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getPhase6PatchPrefetchWorkerKeys } from "./phase6-topology-contract.mjs";

const ROOT_DIR = process.cwd();
const HANDLER_PATH = path.join(
  ROOT_DIR,
  ".open-next",
  "server-functions",
  "default",
  "handler.mjs",
);
const SERVER_FUNCTION_INDEX_PATHS = getPhase6PatchPrefetchWorkerKeys().map(
  (workerKey) =>
    path.join(
      ROOT_DIR,
      ".open-next",
      "server-functions",
      workerKey,
      "index.mjs",
    ),
);

const MANIFEST_GUARD_NEEDLE =
  ";throw new Error(`Unexpected loadManifest(${path2}) call!`)}function evalManifest";
const MANIFEST_GUARD_PATCH =
  ";if(/(?:^|\\/)(?:[^/]*manifest(?:\\.json)?|prefetch-hints\\.json)$/.test(path2))return{};throw new Error(`Unexpected loadManifest(${path2}) call!`)}function evalManifest";

const MIDDLEWARE_REQUIRE_NEEDLE =
  "getMiddlewareManifest(){return this.minimalMode?null:require(this.middlewareManifestPath)}";
const MIDDLEWARE_REQUIRE_PATCH =
  "getMiddlewareManifest(){return this.minimalMode?null:(0,_loadmanifestexternal.loadManifest)(this.middlewareManifestPath)}";
const CACHE_HANDLER_REQUIRE_NEEDLE =
  'var cacheHandlerPath = __require.resolve("./cache.cjs");';
const CACHE_HANDLER_REQUIRE_PATCH =
  'var cacheHandlerPath = new URL("./cache.cjs", import.meta.url).pathname;';
const COMPOSABLE_CACHE_HANDLER_REQUIRE_NEEDLE =
  'var composableCacheHandlerPath = __require.resolve("./composable-cache.cjs");';
const COMPOSABLE_CACHE_HANDLER_REQUIRE_PATCH =
  'var composableCacheHandlerPath = new URL("./composable-cache.cjs", import.meta.url).pathname;';

async function patchServerFunctionIndex(filePath) {
  const source = await readFile(filePath, "utf8");
  let patched = source;
  let changed = false;

  if (patched.includes(CACHE_HANDLER_REQUIRE_PATCH)) {
    // already patched
  } else if (patched.includes(CACHE_HANDLER_REQUIRE_NEEDLE)) {
    patched = patched.replace(
      CACHE_HANDLER_REQUIRE_NEEDLE,
      CACHE_HANDLER_REQUIRE_PATCH,
    );
    changed = true;
  } else {
    throw new Error(
      `[cf-prefetch-patch] expected cache handler require not found in ${path.relative(ROOT_DIR, filePath)}`,
    );
  }

  if (patched.includes(COMPOSABLE_CACHE_HANDLER_REQUIRE_PATCH)) {
    // already patched
  } else if (patched.includes(COMPOSABLE_CACHE_HANDLER_REQUIRE_NEEDLE)) {
    patched = patched.replace(
      COMPOSABLE_CACHE_HANDLER_REQUIRE_NEEDLE,
      COMPOSABLE_CACHE_HANDLER_REQUIRE_PATCH,
    );
    changed = true;
  } else {
    throw new Error(
      `[cf-prefetch-patch] expected composable cache handler require not found in ${path.relative(ROOT_DIR, filePath)}`,
    );
  }

  if (!changed) {
    console.log(
      `[cf-prefetch-patch] cache handler paths already patched in ${path.relative(ROOT_DIR, filePath)}`,
    );
    return;
  }

  await writeFile(filePath, patched, "utf8");
  console.log(
    `[cf-prefetch-patch] patched cache handler paths in ${path.relative(ROOT_DIR, filePath)}`,
  );
}

async function main() {
  const source = await readFile(HANDLER_PATH, "utf8");
  let patched = source;
  const applied = [];

  if (patched.includes(MIDDLEWARE_REQUIRE_PATCH)) {
    console.log(
      "[cf-prefetch-patch] middleware manifest loader already patched",
    );
  } else if (patched.includes(MIDDLEWARE_REQUIRE_NEEDLE)) {
    patched = patched.replace(
      MIDDLEWARE_REQUIRE_NEEDLE,
      MIDDLEWARE_REQUIRE_PATCH,
    );
    applied.push("middleware manifest loader");
  } else {
    throw new Error(
      "[cf-prefetch-patch] expected middleware manifest loader not found in generated handler",
    );
  }

  if (patched.includes(MANIFEST_GUARD_PATCH)) {
    console.log("[cf-prefetch-patch] manifest guard already patched");
  } else if (
    patched.includes("prefetch-hints") &&
    patched.includes("dynamic-css-manifest") &&
    patched.includes("subresource-integrity-manifest")
  ) {
    console.log(
      "[cf-prefetch-patch] upstream manifest handling already present; no manifest-guard patch needed",
    );
  } else if (patched.includes(MANIFEST_GUARD_NEEDLE)) {
    patched = patched.replace(MANIFEST_GUARD_NEEDLE, MANIFEST_GUARD_PATCH);
    applied.push("manifest guard");
  } else {
    throw new Error(
      "[cf-prefetch-patch] expected manifest guard not found in generated handler",
    );
  }

  if (applied.length === 0) {
    console.log(
      "[cf-prefetch-patch] handler already matches local compatibility patches",
    );
  } else {
    await writeFile(HANDLER_PATH, patched, "utf8");
    console.log(`[cf-prefetch-patch] patched ${applied.join(" + ")}`);
  }

  for (const filePath of SERVER_FUNCTION_INDEX_PATHS) {
    await patchServerFunctionIndex(filePath);
  }
}

main().catch((error) => {
  console.error("[cf-prefetch-patch] failed:", error);
  process.exit(1);
});
