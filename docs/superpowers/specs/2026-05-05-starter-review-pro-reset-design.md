# Starter Review Pro Reset Design

## Goal

Port the upstream `review-pro-reset` plan into the current `showcase-website-starter` workspace because this starter is derived from a source-site codebase and still carries the same structural debt.

This is not a loose inspiration pass. The current workspace keeps the same kinds of overbuilt surfaces that the upstream source-site plan targets:

- public submissions wrapped in idempotency, partial success, and orchestration layers;
- a lead pipeline that runs email and Airtable side effects as a split-brain service pair;
- middleware that owns health, nonce/header overrides, security headers, locale behavior, and internal client-IP propagation;
- active Cloudflare and Vercel deployment lanes at the same time;
- env/logger/content facade layers;
- workflow, rule, script, mutation, review, and proof sprawl.

The reset direction is therefore accepted as the main route. The only starter-specific adjustment is this: reusable starter capabilities may stay when they are real capabilities for derived projects, but they cannot be used as a reason to preserve runtime complexity or old source-site residue.

## Current baseline

At `2d2361446a7fc94e700ee308ec303c2e64c15736` on branch `Alx-707/verify-research-fixes`:

| Metric | Current |
|---|---:|
| Repo file count excluding generated/dependency/report dirs | 1305 |
| `src` TS/TSX files | 686 |
| `src` TS/TSX lines | 118552 |
| `src/lib` TS/TSX files | 222 |
| `src/lib/lead-pipeline` TS/TSX files | 31 |
| Test/spec files | 368 |
| `package.json` scripts | 160 |
| `.github/workflows` files | 5 |
| `scripts/` files | 78 |
| `.claude/rules/*.md` lines | 1483 |

Fresh verification already performed during review:

- `pnpm type-check`
- `pnpm brand:check`
- `pnpm content:check`
- `pnpm lint:check`
- `pnpm test` (`350` test files, `4473` tests)
- targeted middleware, lead-pipeline, CORS, and Turnstile route suites

Additional current-workspace evidence:

- `.github/workflows/vercel-deploy.yml` is still active and larger than the Cloudflare deploy workflow.
- `package.json` still exposes phase, review, quality, architecture, mutation, visual, and e2e script families.
- `src/lib/lead-pipeline/processors/contact.ts` and `product.ts` still use `Promise.all` for email plus record creation.
- `partialSuccess` still appears in the lead pipeline, routes, contact action path, UI status styling, and tests.
- `src/middleware.ts` still handles `/api/health`, nonce/header override, security headers, locale behavior, and trusted client-IP propagation.
- `src/lib/env.ts`, `env-runtime.ts`, `env-schemas.ts`, `public-env.ts`, `logger.ts`, and `logger-core.ts` still form split env/logger surfaces.
- `.claude/rules/*.md` still totals `1483` lines.

## Target architecture

### Starter identity

The repo remains a reusable showcase website starter, not a single-site repo. Keep:

- generic replaceable website examples;
- `docs/website/**` replacement and quality-proof docs;
- project-local `.claude/skills/` and `.codex/skills/` as first-class starter capability layers;
- reusable skills for UI, SEO, content, copywriting, review, quality governance, Storybook, shadcn, and agent workflow;
- canonical starter proof commands: `brand:check`, `content:check`, `component:check`, `website:check`, and `website:build:cf`.

Remove or demote:

- old project-specific residue;
- AI self-governance artifacts that exist only to manage previous over-complexity;
- old proof outputs, audit reports, workflow outputs, phase naming, and branch-era compatibility layers;
- runtime abstractions that are not needed by a derived showcase site.

Do not delete `.claude/skills/` or `.codex/skills/` during this reset. The allowed cleanup is narrower: fix invalid skill metadata, remove old brand/product/domain residue inside a skill if found, and genericize project-specific examples. A current scan found no old brand/product markers in these skill directories.

Do not remove the five canonical starter proof command names. Their internals may be simplified only if the new implementation proves the same contract:

- `brand:check`: old project brand marker detection;
- `content:check`: slug and translation integrity;
- `component:check`: component governance plus Storybook/build proof;
- `website:check`: type, lint, tests, and production build;
- `website:build:cf`: Cloudflare/OpenNext build path.

### Public submissions

All public write paths should converge on one simple model:

```text
browser form -> route handler -> Zod -> Turnstile -> process lead -> Airtable first -> optional email
```

Rules:

- Airtable record creation is the business success condition.
- Email failure after Airtable success returns success to the user and logs an internal warning.
- Airtable failure returns failure and does not send email.
- Duplicated leads are an acceptable starter default; dropped leads are not.
- Keep body-size checks, Zod validation, and Turnstile for browser-exposed write paths.
- Do not keep idempotency, body hashing, distributed rate limiting, or user-facing partial-success machinery as starter defaults. A derived project can add them later if a real incident justifies the extra complexity.

### Contact flow

The contact form should move to the same public route-handler model as inquiry and subscribe.

`src/lib/actions/contact.ts` may stay temporarily as a compatibility adapter during the migration, but the target is:

- browser contact form submits to `/api/contact`;
- route handler owns `NextRequest` context;
- contact validation and Turnstile verification happen in the route model;
- middleware no longer injects internal client-IP headers for the browser contact flow;
- duplicate contact wrappers and re-export actions are deleted after imports move.

### Lead pipeline

The final lead pipeline should be small enough to read as a business transaction.

Keep:

- `src/lib/lead-pipeline/lead-schema.ts`
- `src/lib/lead-pipeline/process-lead.ts`
- `src/lib/lead-pipeline/utils.ts`
- concrete Airtable and Resend implementations

Delete or merge after tests are updated:

- partial-success observability and recovery surfaces;
- generic processor files that exist only to preserve artificial symmetry;
- settle/retry/timeout wrappers that are only supporting the current two-service orchestration;
- `emailResult` / `crmResult` as a public result shape.

Newsletter can remain simpler than inquiry/contact. It should not force the inquiry path into a generic pipeline.

### Middleware

Middleware should be reduced to the smallest proven runtime responsibilities:

- locale routing;
- minimal locale cookie behavior if still needed;
- security headers only if current rendering and CSP policy still need them.

Middleware should stop owning:

- `/api/health`;
- lead processing context;
- Server Action client-IP propagation after contact route migration;
- custom platform diagnostics;
- request header mutation that only exists to support old architecture.

### Rules and docs

`.claude/rules/` stays as a cross-tool rule entry layer, but it should stop defending old complexity.

Target shape:

- `security.md`: short public form/API security rules. No default mandate for body hash, idempotency, distributed rate-limit, or partial-success systems.
- `cloudflare.md`: stable Cloudflare/OpenNext build, preview, deploy, and smoke rules. No phase system in the public command story.
- `testing.md`: buyer journey, lead behavior, locale routing, and Cloudflare proof. No mutation/review bureaucracy as a default workflow.
- remaining files: keep actual Next.js, i18n, content, UI, and TypeScript constraints; delete AI-generated governance language.

The starter docs remain the durable owner-facing truth, but internal proof tooling must be presented as maintainer tooling, not as client launch proof by itself.

### Deployment

Cloudflare/OpenNext is the default production deployment path for the starter.

Vercel is currently active enough to be misleading:

- `.github/workflows/vercel-deploy.yml` exists and triggers automation;
- `vercel.json` exists;
- Cloudflare workflow and OpenNext config also exist.

Target:

- one default deploy story: Cloudflare/OpenNext;
- Vercel either removed or demoted to clearly manual compatibility documentation;
- public commands stay stable:

```bash
pnpm build
pnpm build:cf
pnpm preview:cf
pnpm smoke:cf:preview
pnpm deploy:cf
pnpm smoke:cf:deploy
```

If old phase scripts are still needed internally, they sit behind these names and are not exposed as the owner/developer-facing story.

### Runtime and client payload

Simplify env/logger/i18n with client/server boundary proof, but do not force one physical file when the split is protecting the browser bundle.

- Keep `src/lib/public-env.ts` as the default browser-safe env boundary. It uses static `process.env.NEXT_PUBLIC_*` reads so Next.js can inline public values without exposing server env schemas or raw server env maps.
- Keep `src/lib/env.ts` as the server/app facade. `env-runtime.ts` and `env-schemas.ts` may remain internal support modules if tests continue to prove app code does not import them directly.
- Shrink env by removing unused server/client keys, Vercel/old-platform residue, and obsolete rate-limit/idempotency keys after the related runtime code is removed.
- Keep a client-safe logger boundary by default. Today client components import `@/lib/logger-core`; server code imports `@/lib/logger` for logger plus PII sanitizers.
- Before any logger merge, prove the client bundle does not import server env schemas, raw secret env maps, or PII sanitizers. If that cannot be proved cheaply, retain the split and improve naming/docs instead.
- remove pure re-export facades after imports are migrated, but do not confuse a safety boundary with a facade;
- narrow `NextIntlClientProvider` messages to client island needs;
- delete flat translation compatibility files only after scripts/tests/docs no longer need them.

### Tests, scripts, workflows, and residue

The target is not "no tests." The target is proof that answers real starter and buyer questions:

- Does the site render and route correctly?
- Do locale routes work?
- Do contact/inquiry/subscribe flows store records first?
- Does Cloudflare build and preview/deploy smoke still work?
- Do starter replacement checks still catch obvious placeholder and content issues?

Demote or delete checks that only prove old governance structures, mutation lanes, architecture bureaucracy, visual snapshot noise, or phase-era deployment assumptions.

## Stop lines

Stop and reassess if:

- contact no longer has a tested browser-visible submission path;
- record-first behavior cannot be proved;
- Cloudflare command simplification breaks the real OpenNext deployment path;
- env/logger consolidation pulls server-only code, secrets, or PII helpers into client bundles;
- deleting a workflow or script removes the only proof for a starter acceptance criterion;
- a proposed docs/rules deletion removes a reusable starter capability rather than old-project residue;
- current code drift means a file from the upstream source-site plan no longer exists or no longer serves the same role;
- removal would require permanent local deletion instead of git-tracked deletion or Trash-first handling for local-only directories.

## Acceptance criteria

- Current workspace has a reset spec and plan that accept the upstream source-site reset as the main route.
- Starter-specific exceptions are narrow and explicit: reusable starter capability stays; inherited runtime debt goes.
- Contact, inquiry, and subscribe converge on the same public submission model.
- Lead pipeline tests prove Airtable-first behavior.
- User-facing `partialSuccess` is gone.
- Middleware no longer owns health or contact identity propagation.
- Env/logger/re-export facades are reduced only where client/server proof allows.
- `public-env` and client-safe logger boundaries are retained unless bundle/dependency proof shows a merge is safe.
- `.claude/skills/`, `.codex/skills/`, and the five canonical starter proof commands remain available.
- Package scripts and workflows expose one default Cloudflare production path.
- `.claude/rules/*.md` line count drops materially and no longer mandates old governance systems.
- Final scorecard compares before/after metrics with the same counting method.
