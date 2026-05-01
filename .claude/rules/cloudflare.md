---
paths:
  - "src/middleware.ts"
  - "open-next.config.ts"
  - "wrangler.jsonc"
  - "scripts/cloudflare/**"
  - "src/app/actions.ts"
  - "src/app/**/actions.ts"
  - "src/lib/actions/**"
  - "src/lib/security/**"
---

# Cloudflare Deployment Constraints

> Most rules in this file are **repo-specific operational constraints** for the current Next.js + OpenNext + Cloudflare stack. Keep Next.js / Cloudflare official APIs aligned, but do not mistake these repo runbooks for generic platform rules.

## Use This File When

- Changing Cloudflare/OpenNext build, preview, deploy, middleware, worker topology, or runtime cache behavior
- Touching Server Actions that depend on client identity, IP detection, or request headers
- Debugging Cloudflare preview/deploy failures or platform-only runtime behavior

## Do Not Use This File For

- Generic Next.js API behavior; consult `node_modules/next/dist/docs/`
- General API validation, rate limits, or CSP policy; use `security.md`
- General i18n key management; use `i18n.md`

## Validation Decision Table

| Change touches | Minimum proof |
|----------------|---------------|
| Standard Next.js page/runtime behavior | `pnpm build` |
| Cloudflare/OpenNext build path | `pnpm build` then `pnpm build:cf` |
| Cloudflare page rendering | `pnpm preview:cf` + `pnpm smoke:cf:preview` |
| Deployed Cloudflare behavior | `pnpm smoke:cf:deploy` |
| Client IP / Server Action identity chain | related IP/action tests + `pnpm build` + `pnpm build:cf` |
| Cache/runtime binding architecture | `pnpm review:cf:official-compare` |

## Build Chain

### Never parallel-run `pnpm build` and `pnpm build:cf`

Both write to `.next`. Parallel execution produces false failures.

```bash
# ✅ Sequential
pnpm clean:next-artifacts && pnpm build
pnpm build:cf

# ❌ Parallel — .next corruption
pnpm build & pnpm build:cf
```

If `Maximum call stack size exceeded` appears, first check for stale `.next` / `.open-next` / `.wrangler/tmp` artifacts before suspecting business code regression.

### Build pass ≠ page proof

`pnpm build:cf` passing does not prove Cloudflare pages work. Always run smoke separately:

```bash
pnpm build:cf
pnpm preview:cf          # local page verification
pnpm smoke:cf:preview    # automated page smoke
```

Production-like deploys must go through the phase6 split-worker entrypoints.
`deploy:cf` and `deploy:cf:preview` are aliases to phase6. Do not call raw
`wrangler deploy --env ...` against `wrangler.jsonc`; that is the old
single-worker entrypoint and bypasses the current topology checks.

`pnpm preview:cf:wrangler` is intentionally guarded — running it fails fast via `scripts/cloudflare/legacy-entrypoint-guard.mjs`. Do not edit that guard to bypass it without an explicit architecture re-decision.

### OpenNext minify stays off

In `open-next.config.ts`, keep `minify: false` for split functions and default worker. Re-enabling requires full smoke pass (`build:cf` + `preview:cf` + `smoke:cf:deploy`).

## Runtime Entry

### middleware.ts is the Cloudflare-compatible entry

Next.js 16 recommends the renamed `proxy.ts` convention, but this repo must not rename `src/middleware.ts` until a dedicated Cloudflare proof branch passes:

```bash
pnpm build
pnpm build:cf
pnpm smoke:cf:preview
pnpm smoke:cf:preview:strict
```

If a preview deployment URL is created, also run:

```bash
pnpm smoke:cf:deploy -- --base-url "$DEPLOYED_BASE_URL"
```

Until that proof exists, `src/middleware.ts` remains the repo-compatible runtime entry.

This wording is based on the installed Next.js docs:

```text
node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md
node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md
```

Those docs say the functionality remains the same, `middleware` is deprecated/renamed to `proxy`, and the file convention is `proxy.ts`; they do not prove this repo's Cloudflare/OpenNext adapter path, so the repo-specific proof lane still controls execution.

All locale redirect, CSP nonce, and security header changes go in `src/middleware.ts`.

### matcher must be static literals

```typescript
// ❌ Turbopack error: "matcher need to be static strings"
export const config = { matcher: buildMatcherArray() };

// ✅ Static string literals only
export const config = { matcher: ['/((?!_next|api).*)'] };
```

## Server Actions on Cloudflare

### Client IP: use middleware-derived internal header

Server Actions only have `headers()`, not `NextRequest`. Direct `cf-connecting-ip` / `x-forwarded-for` loses trusted-source context.

```typescript
// ❌ Server Action trusting raw proxy headers
const ip = headers().get('cf-connecting-ip');

// ✅ Middleware derives and sets internal header
// middleware.ts: request.headers.set('x-internal-client-ip', derivedIP)
// Server Action reads internal header only
const ip = headers().get('x-internal-client-ip');
```

When changing Contact/inquiry client identity chain, verify middleware internal header is maintained. Run:
```bash
pnpm exec vitest run src/lib/security/__tests__/client-ip.test.ts src/app/__tests__/actions.test.ts
pnpm build && pnpm build:cf
```

## Cache Components on Cloudflare

### No `cacheTag()` anywhere in production code

Runtime tag invalidation (`revalidateTag` / `revalidatePath` / `cacheTag()`) was removed from the launch architecture on 2026-04-26. Do not reintroduce these calls anywhere in production code.

A narrow `"use cache"` + `cacheLife()` boundary is acceptable when Next.js Cache Components needs it for build correctness, but it must not attach a `cacheTag()`. Product market pages currently do not use a shared FAQ cache boundary.

Content updates flow through redeploy, not runtime invalidation APIs. If a future requirement (e.g., CMS integration) genuinely needs runtime tag invalidation, that is an explicit architecture re-decision — not a "just add the call back" change.

`tests/architecture/cache-directive-policy.test.ts` enforces this on the product market page.

### No `use cache` / `cacheLife` on conversion pages

Cloudflare runtime has `setTimeout()` and Cache Components boundary issues. Contact/inquiry/subscribe pages must not use `use cache` or `cacheLife` on data-fetching functions.

### Runtime message JSON bypasses `unstable_cache`

Do not wrap runtime i18n JSON module imports in `unstable_cache` on Cloudflare. Wrangler/Miniflare can revalidate those cached loaders across request contexts and fail with “Cannot perform I/O on behalf of a different request.” Use direct module imports for Cloudflare runtime; keep `unstable_cache` only for non-CI, non-build, non-Cloudflare runtime paths.

The same boundary applies to `react/cache` wrappers around `next-intl/server`
translation helpers. On Cloudflare runtime, call `getTranslations` directly
instead of using a module-level cached wrapper.

MDX/page content query helpers follow the same rule: React request-cache wrappers
are allowed for normal Next.js runtime, but Cloudflare runtime must use direct
content loader calls unless the caller is inside an explicit Next Cache
Components `"use cache"` boundary.

Cloudflare runtime must not read MDX files through Node `fs`. Page/post lookup
has to use the generated content manifest, which embeds frontmatter and body
text at build time.

### Loading.tsx for conversion pages

Route-level `loading.tsx` controls no-JS / slow-streaming first paint. For contact/inquiry/subscribe, either provide meaningful content or omit `loading.tsx` entirely — empty skeletons break SSR content contracts.

## Runtime Cache Stack Is Out of Scope

`wrangler.jsonc` must not declare `r2_buckets`, `d1_databases`, or `durable_objects`. `open-next.config.ts` must not register `incrementalCache`, `tagCache`, or `queue` overrides.

`pnpm review:cf:official-compare` enforces this — it fails the build if any forbidden binding (`WORKER_SELF_REFERENCE`, `NEXT_INC_CACHE_R2_BUCKET`, `NEXT_TAG_CACHE_D1`, `NEXT_CACHE_DO_QUEUE`) reappears or any DO class (`DOQueueHandler`, `DOShardedTagCache`, `BucketCachePurge`) is re-imported. Do not bypass that script.

The `apiOps` worker split is also out of scope. Only `apiLead` is allowed under `cloudflareConfig.functions`.

If a future requirement reintroduces runtime cache invalidation, it must come with: (1) an explicit architecture re-decision recorded in `docs/technical/deployment-notes.md`, (2) updates to this rule file, and (3) a paired update to `pnpm review:cf:official-compare`.

## Issue Classification

When Cloudflare-related failures occur, classify before debugging:

| Category | Example | Where to look |
|----------|---------|---------------|
| Platform entry | Wrangler/Miniflare startup crash | Local runtime, not business code |
| Generated artifact | `middleware-manifest.json` dynamic require | `scripts/cloudflare/patch-*.mjs` |
| Runtime regression | Page 500 after Next.js upgrade | `pnpm smoke:cf:preview` |
| Deployed behavior | API health fails post-deploy | `pnpm smoke:cf:deploy` |
| Cache architecture regression | `use cache` or `cacheTag` re-introduced | `tests/architecture/cache-directive-policy.test.ts` |
| Forbidden binding regression | `r2_buckets` / `d1_databases` / `durable_objects` reappears | `pnpm review:cf:official-compare` |

Reference: `docs/guides/CLOUDFLARE-ISSUE-TAXONOMY.md`
