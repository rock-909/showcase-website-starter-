---
paths:
  - "src/app/**/*.{ts,tsx}"
  - "src/components/**/*.{ts,tsx}"
  - "src/lib/cache/**"
  - "src/lib/content/**"
  - "src/middleware.ts"
  - "next.config.ts"
---

# Architecture Constraints

> For Next.js API reference, consult `node_modules/next/dist/docs/`.
> This file records repo-specific architecture decisions. Do not copy generic Next.js API guidance here.

## Page Props Convention

App Router pages and layouts must use the installed Next.js 16 async request API shape: `params` and `searchParams` are Promises. Check the bundled docs before changing page prop types.

## Routing & Layout

- **Locale-based**: `/[locale]/page-name` (en, zh)
- Push `"use client"` as low as possible. Keep layouts and non-interactive sections as Server Components; move interactivity into leaf components.

## Route Error Boundary Policy

Use route-level `error.tsx` for pages where a buyer-facing flow depends on dynamic data, form/runtime services, or route parameters:

- `contact` has a route boundary because it contains the lead form path.
- `products` has a route boundary because catalog/product rendering is a main buyer path.

Pure static MDX/legal/about-style pages may rely on the layout/global fallback unless they add external fetches, user actions, or dynamic route parameters. If a static page later becomes interactive or externally data-backed, add a route-level boundary in the same change.

## Cache Policy

- Use `React.cache()` only for request-level dedupe, such as repeated content reads during metadata and page rendering.
- Non-conversion pages may use a narrow `"use cache"` + `cacheLife()` boundary when Next.js build requires it, but `cacheTag()` and runtime tag invalidation are outside the current launch path without an explicit Cloudflare/OpenNext proof plan.
- Reserve the `*Cached` suffix for exported cross-request/cache-components wrappers. Do not use `*Cached` for a plain low-level helper unless it actually defines the cache boundary.

## Radix UI + Dynamic Import

This is a **repo mitigation**, not a universal Next.js rule:

- If a Radix-based interactive widget is dynamically imported and SSR causes hydration mismatch in this repo, default to a client wrapper with `next/dynamic(..., { ssr: false })`
- If the component is LCP-critical or renders correctly on the server, prefer direct import instead of forcing `ssr: false`

Applies to: Tabs, Dialog, Accordion, Select, DropdownMenu, Popover.

For LCP-critical content, avoid `dynamic` and use direct import.

## Hydration Pitfalls

| Cause | Fix |
|-------|-----|
| Radix UI + dynamic | First classify it as a repo-specific mismatch; if SSR is the cause here, use `ssr: false` (see above) |
| Date/Time rendering | Use `useEffect` in Client Component |
| Invalid HTML nesting (div inside p) | Fix DOM structure |
| `next/script` `beforeInteractive` + CSP nonce | Use `afterInteractive` or `lazyOnload` |

## Production Truth-Source Hygiene

- Before keeping or deleting a shared helper, distinguish production consumers (`src/**`) from test-only consumers (`__tests__/`, `tests/**`).
- Zero-consumer or test-only files should not remain in `src/lib/*`, `src/types/*`, or `src/config/*`.

## Route Deletion Steps

When removing any route (page), follow this order:

1. Delete the route directory under `src/app/[locale]/`
2. Remove from `src/config/paths/types.ts` - delete from `DynamicPageType` union
3. Remove from `src/config/paths/paths-config.ts` - delete from `DYNAMIC_PATHS_CONFIG`
4. Remove from `src/lib/i18n/route-parsing.ts` - delete from `DYNAMIC_ROUTE_PATTERNS`
5. Remove from `src/app/sitemap.ts` - delete URL generation for the route
6. Remove navigation links - grep `src/components/` for the route path
7. Remove param helpers - grep `src/constants/` for the route's slug/params
8. Remove/update tests - grep `__tests__/` and `tests/` for route references
9. Run `pnpm type-check` - TypeScript will catch remaining dangling imports
