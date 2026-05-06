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

# Cloudflare / OpenNext Rules

Use this file when changing Cloudflare/OpenNext build, preview, deploy,
middleware, worker config, or Cloudflare-only runtime behavior.

For generic Next.js APIs, read the installed docs under
`node_modules/next/dist/docs/`.

## Public command surface

The public story is Cloudflare/OpenNext through stable commands:

```bash
pnpm build
pnpm build:cf
pnpm preview:cf
pnpm smoke:cf:preview
pnpm deploy:cf
pnpm smoke:cf:deploy
```

Do not introduce new owner-facing phase commands. If older phase scripts still
exist internally, keep them behind the stable names above until Phase 5 removes
or hides them.

## Proof table

| Change touches | Minimum proof |
| --- | --- |
| Standard Next.js runtime behavior | `pnpm build` |
| Cloudflare/OpenNext build path | `pnpm build` then `pnpm build:cf` |
| Local Cloudflare preview behavior | `pnpm preview:cf` + `pnpm smoke:cf:preview` |
| Deployed Cloudflare behavior | `pnpm smoke:cf:deploy` |
| Public submission routes or compatibility actions | related route/action/IP tests + `pnpm build` + `pnpm build:cf` |

Never run `pnpm build` and `pnpm build:cf` in parallel. They both write to
`.next`.

## Runtime entry

Keep `src/middleware.ts` until a dedicated Cloudflare proof branch shows the
renamed Next.js `proxy.ts` convention works with this OpenNext setup:

```bash
pnpm build
pnpm build:cf
pnpm smoke:cf:preview
pnpm smoke:cf:preview:strict
```

If a deployed preview URL exists, also run:

```bash
pnpm smoke:cf:deploy -- --base-url "$DEPLOYED_BASE_URL"
```

The matcher must remain static string literals.

## Public submission identity

Browser contact submissions go through `/api/contact`. Middleware must not
inject internal client-IP headers for public form flows.

Server Action contact code is compatibility-only. It must validate internally
and fail closed when request identity is unavailable rather than relying on
middleware-provided trusted IP headers.

## Cache and runtime bindings

- Do not add `cacheTag()`, `revalidateTag()`, or `revalidatePath()` to
  production code without a new Cloudflare proof plan.
- Content updates flow through rebuild/redeploy unless a future CMS integration
  proves a different path.
- `wrangler.jsonc` must not add `r2_buckets`, `d1_databases`, or
  `durable_objects` for this starter by default.
- `open-next.config.ts` must not add custom incremental cache, tag cache, or
  queue overrides by default.

If those platform pieces become real requirements later, update this file,
the related proof docs, and the matching tests in the same branch.
