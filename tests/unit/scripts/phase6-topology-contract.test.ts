import { describe, expect, it } from "vitest";
import {
  getPhase6ApiPathnames,
  getPhase6ApiRouteRules,
  getPhase6ApiSourceRoutes,
  getPhase6DeploymentOrder,
  getPhase6PatchPrefetchWorkerKeys,
  getPhase6ServerActionsKeyWorkerNames,
  getPhase6WorkerNames,
} from "../../../scripts/cloudflare/phase6-topology-contract.mjs";

describe("phase6 topology contract", () => {
  it("derives worker names from one shared catalog", () => {
    expect(getPhase6WorkerNames("showcase-website")).toEqual({
      gateway: "showcase-website-gateway",
      web: "showcase-website-web",
      apiLead: "showcase-website-api-lead",
    });
  });

  it("keeps deploy order aligned with the shared catalog", () => {
    expect(getPhase6DeploymentOrder()).toEqual([
      "web.jsonc",
      "api-lead.jsonc",
      "gateway.jsonc",
    ]);
  });

  it("keeps server-actions key sync list aligned with the same catalog", () => {
    expect(getPhase6ServerActionsKeyWorkerNames("showcase-website")).toEqual([
      "showcase-website-gateway",
      "showcase-website-web",
      "showcase-website-api-lead",
    ]);
  });

  it("keeps prefetch patch targets aligned with the same catalog", () => {
    expect(getPhase6PatchPrefetchWorkerKeys()).toEqual(["apiLead"]);
  });

  it("keeps phase6 API route split explicit and excludes old cache invalidation", () => {
    expect(getPhase6ApiSourceRoutes("apiLead")).toEqual([
      "app/api/inquiry/route",
      "app/api/subscribe/route",
      "app/api/verify-turnstile/route",
      "app/api/health/route",
    ]);

    expect(getPhase6ApiPathnames("apiLead")).toEqual([
      "/api/inquiry",
      "/api/subscribe",
      "/api/verify-turnstile",
      "/api/health",
    ]);

    const allPathnames = getPhase6ApiPathnames();
    expect(allPathnames).not.toContain("/api/cache/invalidate");
    expect(getPhase6ApiRouteRules()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          pathname: "/api/inquiry",
          sourceRoute: "app/api/inquiry/route",
          workerKey: "apiLead",
        }),
      ]),
    );
  });
});
