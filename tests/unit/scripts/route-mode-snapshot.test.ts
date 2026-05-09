import { describe, expect, it } from "vitest";
import { parseRouteModeSummary } from "../../../scripts/quality/route-mode-snapshot.mjs";

const SAMPLE_SUMMARY = `
Route (app)
┌ ○ /_not-found
├ ◐ /[locale]
├ ƒ /api/contact
├ ○ /api/health
└ ƒ /sitemap.xml

○  (Static)             prerendered as static content
◐  (Partial Prerender)  prerendered as static HTML with dynamic server-streamed content
ƒ  (Dynamic)            server-rendered on demand
`;

describe("route mode snapshot parser", () => {
  it("parses static, partial prerender, and dynamic routes", () => {
    expect(parseRouteModeSummary(SAMPLE_SUMMARY)).toEqual([
      { mode: "static", route: "/_not-found" },
      { mode: "partial-prerender", route: "/[locale]" },
      { mode: "dynamic", route: "/api/contact" },
      { mode: "static", route: "/api/health" },
      { mode: "dynamic", route: "/sitemap.xml" },
    ]);
  });
});
