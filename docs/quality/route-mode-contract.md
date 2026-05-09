# Route Mode Contract

This document records expected route modes for the starter. It is a proof note, not a hard gate yet.

## Current policy

- `○` static routes are expected for static assets and health checks.
- `◐` Partial Prerender routes are expected for localized marketing pages that stream dynamic server content under Cache Components.
- `ƒ` dynamic routes are expected for API routes, owner access, sitemap, and catch-all routes.

## Known build warning

`DYNAMIC_SERVER_USAGE` appears during `pnpm build`. Until this is fully attributed, do not claim static/dynamic boundaries are fully closed. Record route summary after each release-facing build.

## Deferred

`src/middleware.ts` to `src/proxy.ts` migration is intentionally deferred until Cloudflare/OpenNext support is proven.
