import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import type { SplittedFunctionOptions } from "@opennextjs/aws/types/open-next";
import {
  getPhase6ApiPathnames,
  getPhase6ApiSourceRoutes,
} from "#phase6-topology-contract";

const cloudflareConfig = defineCloudflareConfig({});

// Split high-traffic lead routes into a separate worker. Runtime cache
// invalidation was removed on 2026-04-26, so the old ops split is gone.
// Worker placement is controlled by wrangler.jsonc Smart Placement.
const splitFunctions: Record<string, SplittedFunctionOptions> = {
  apiLead: {
    runtime: "node",
    // Keep disabled by default. The 2026-04-01 isolated re-check no longer
    // reproduced the old build-time ENOENT, but local Cloudflare preview still
    // lacks a clean proof after re-enabling minification.
    minify: false,
    routes: getPhase6ApiSourceRoutes("apiLead"),
    patterns: getPhase6ApiPathnames("apiLead"),
  },
};

cloudflareConfig.functions = splitFunctions;
// Keep disabled by default. The old build-time minifier crash is no longer
// treated as guaranteed, but this repo still lacks a clean local/deployed proof
// with minify enabled. Bundle size relies on the paid Workers plan.
cloudflareConfig.default.minify = false;

export default cloudflareConfig;
