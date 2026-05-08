# Starter Review Pro Reset Implementation Plan

> Historical snapshot: this plan keeps the dependency versions that were true when it was written. For current versions, use `docs/technical/tech-stack.md` and `package.json`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reproduce the upstream `review-pro-reset` direction in `showcase-website-starter`, treating inherited source-site complexity as the default assumption and keeping only real reusable starter capabilities.

**Architecture:** The original source-site reset plan is the main route: simplify rules first, then unify public submissions, make lead capture record-first, shrink middleware/runtime surfaces, collapse deployment/test/script residue, and finish with a scorecard. Starter identity is an execution guard, not a reason to keep old runtime complexity.

**Tech Stack:** Next.js 16.2.4 App Router, React 19.2.5, TypeScript 6.0.3, next-intl 4.11.0, Vitest, Playwright, Cloudflare/OpenNext, pnpm.

---

## File responsibility map

- `docs/superpowers/specs/2026-05-05-starter-review-pro-reset-design.md`
  - Current-workspace design contract for porting the upstream reset into the starter.
- `docs/superpowers/plans/2026-05-05-starter-review-pro-reset.md`
  - This executable implementation plan.
- `.claude/rules/*.md`
  - Cross-tool rule layer. Target is real constraints only, not old governance bureaucracy.
- `docs/website/README.md`, `docs/website/AI工作流.md`, `docs/website/quality-proof.md`, `docs/website/新项目替换清单.md`
  - Starter identity and replacement-proof truth. Keep reusable capabilities; do not preserve old runtime debt.
- `.claude/skills/**`, `.codex/skills/**`
  - Project-local AI capability layers. Keep them; only fix metadata or genericize old-project residue.
- `.github/workflows/vercel-deploy.yml`, `.github/workflows/cloudflare-deploy.yml`, `.github/workflows/ci.yml`, `.github/workflows/code-quality.yml`, `.github/workflows/uplink-health.yml`
  - Deployment and CI story. Target is one default Cloudflare story and a small CI surface.
- `vercel.json`, `open-next.config.ts`, `wrangler.jsonc`, `scripts/cloudflare/**`, `scripts/deploy/**`
  - Platform config and deploy implementation detail.
- `src/app/api/inquiry/route.ts`, `src/app/api/subscribe/route.ts`, future `src/app/api/contact/route.ts`, `src/lib/actions/contact.ts`
  - Public submission adapters.
- `src/components/contact/contact-form-island.tsx`, `src/components/forms/contact-form-container.tsx`, `src/components/forms/use-contact-form.ts`
  - Contact form browser entry. The former `src/components/contact/contact-form.tsx` and `src/components/forms/contact-form.tsx` wrapper layers were deleted in Phase 2 after tests proved direct lazy loading.
- `src/lib/lead-pipeline/process-lead.ts`, `src/lib/lead-pipeline/processors/*.ts`, `src/lib/lead-pipeline/lead-schema.ts`, `src/lib/lead-pipeline/utils.ts`, `src/lib/lead-pipeline/pipeline-observability.ts`, `src/lib/lead-pipeline/settle-service.ts`
  - Lead processing behavior. Target is record-first and small.
- `src/middleware.ts`, `src/app/api/health/route.ts`
  - Runtime entry and health ownership.
- `src/lib/env*.ts`, `src/lib/public-env.ts`, `src/lib/logger*.ts`
  - Env/logger surface. Shrink unused keys and obsolete platform residue. Keep browser-safe boundaries unless merge safety is proved.
- `src/lib/airtable.ts`, `src/lib/resend.ts`, `src/lib/content.ts`, `src/lib/content-query.ts`, `src/lib/lead-pipeline/index.ts`, `src/app/actions.ts`
  - Re-export/facade candidates. Delete only after imports are migrated.
- `src/app/[locale]/layout.tsx`, `src/lib/i18n/client-messages.ts`, `messages/**`
  - i18n client payload and translation compatibility.
- `package.json`, `scripts/**`, `tests/**`
  - Public command surface and proof taxonomy.

## Current baseline

At `2d2361446a7fc94e700ee308ec303c2e64c15736` on `Alx-707/verify-research-fixes`:

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

## Current verification snapshot

- Full checks already passed during review:
  - `pnpm type-check`
  - `pnpm brand:check`
  - `pnpm content:check`
  - `pnpm lint:check`
  - `pnpm test` (`350` files / `4473` tests)
- Fresh static evidence collected in this workspace:
  - workflows: `ci.yml` `591` lines, `cloudflare-deploy.yml` `245`, `code-quality.yml` `96`, `uplink-health.yml` `65`, `vercel-deploy.yml` `654`;
  - `package.json`: `160` scripts, including review, quality, architecture, mutation, phase, visual, and multiple e2e families;
  - `partialSuccess` is still used in pipeline, routes, contact action path, UI, and tests;
  - contact/product lead processors still use `Promise.all` for email and Airtable;
  - middleware still owns `/api/health`, nonce/header overrides, security headers, locale behavior, and trusted client-IP propagation;
  - env/logger facade imports still exist in client and app code.

## Mandatory preflight before implementation tasks

- [x] Run `git status --short --branch`.
- [x] Confirm current branch is not `main`.
- [x] Read `docs/website/README.md`, `docs/website/新项目替换清单.md`, and `docs/website/AI工作流.md`.
- [x] If touching Next.js route/layout/middleware/config code, read the relevant local Next docs under `node_modules/next/dist/docs/`.
- [ ] Before staging, run `git diff --cached --name-only`; expected: no unrelated staged files.
- [x] Do not use permanent deletion commands. For tracked files, normal patch/git deletion is acceptable as a reviewed source change. For local-only directories, move to Trash.

---

## Phase 0: Adopt the reset plan in the starter workspace

**Files:**
- Created: `docs/superpowers/specs/2026-05-05-starter-review-pro-reset-design.md`
- Created: `docs/superpowers/plans/2026-05-05-starter-review-pro-reset.md`

- [x] Read the upstream `review-pro-reset` design and plan.
- [x] Compare it against current starter docs and current code baseline.
- [x] Verify that inherited complexity is present in current workspace.
- [x] Create current-workspace spec and implementation plan.
- [x] Recalibrate the plan so the upstream reset is the main route, not just a reference.
- [x] Keep these docs updated as implementation phases reveal current-code drift.

Expected:

- The live plan recognizes the starter as derived from a source-site codebase.
- Starter exceptions are narrow and tied to reusable capability, not inherited debt.

---

## Phase 1: Simplify `.claude/rules/`

**Files to inspect/modify:**
- `.claude/rules/security.md`
- `.claude/rules/cloudflare.md`
- `.claude/rules/testing.md`
- `.claude/rules/conventions.md`
- `.claude/rules/i18n.md`
- `.claude/rules/code-quality.md`
- `.claude/rules/coding-standards.md`
- `.claude/rules/content.md`
- `.claude/rules/structured-data.md`
- `.claude/rules/ui.md`
- `docs/website/quality-proof.md`

- [x] Read all rule files once and mark text as `real-current-constraint`, `starter-capability`, `old-governance`, or `delete`.
- [x] Replace public-form security rules with short rules: size gate, Zod, Turnstile, record-first lead behavior, no default idempotency/body-hash/distributed-rate-limit mandate.
- [x] Replace phase-based Cloudflare rules with stable build/preview/deploy/smoke rules.
- [x] Replace testing governance with buyer journey, locale routing, lead behavior, starter replacement checks, and Cloudflare proof.
- [x] Keep `.claude/skills/` and `.codex/skills/` as project-local capability layers.
- [x] Scan skills for old brand/product/domain residue; genericize residue if found, but do not delete the skill directories.
- [x] Keep reusable AI workflow and component governance where it maps to `docs/website/AI工作流.md` or current starter checks.
- [x] Remove wording that treats mutation, review clusters, architecture metrics, AI-smell gates, or quality bureaucracy as default workflows.
- [x] Review `docs/website/quality-proof.md`; no content change needed because it already separates local gates, CI, preview/deploy proof, canary, and owner signoff.

Run:

```bash
rg -n "idempotency|required|body hash|phase5|phase6|mutation|quality:gate|architecture|governance|AI-smell|coverage gate|guardrail|legacy" .claude/rules
wc -l .claude/rules/*.md
pnpm brand:check
pnpm type-check
```

Expected:

- Remaining old terms are either explicitly forbidden as defaults or justified as current runtime constraints.
- `.claude/rules/*.md` line count drops materially.
- No rule preserves inherited complexity only because the source site once needed it.
- Skill directories remain present.

Stop line:

- Stop if deleting a rule would remove a real starter capability without a replacement doc or test.
- Stop if any planned cleanup deletes `.claude/skills/` or `.codex/skills/`.

---

## Phase 2: Unified public submission model

**Files to inspect/modify:**
- `src/app/api/inquiry/route.ts`
- `src/app/api/subscribe/route.ts`
- Create: `src/app/api/contact/route.ts`
- `src/lib/actions/contact.ts`
- `src/lib/contact-form-processing.ts`
- `src/lib/contact/submit-canonical-contact.ts`
- `src/components/forms/use-contact-form.ts`
- `src/components/forms/contact-form-container.tsx`
- `src/components/contact/contact-form-island.tsx`
- `src/middleware.ts`

- [x] Write failing route-level tests for `/api/contact`: invalid payload, Turnstile failure, successful submission.
- [x] Implement `/api/contact` using the same public route-handler pattern as inquiry and subscribe.
- [x] Move contact validation, request context, and Turnstile handling into the route model.
- [x] Change browser contact form submission to `/api/contact`.
- [x] Keep `src/lib/actions/contact.ts` only as temporary compatibility until no browser path depends on it.
- [x] Remove `src/app/actions.ts` re-export after imports move.
- [x] Collapse the contact wrapper chain so `ContactFormIsland` lazy-loads the real form entry directly.
- [ ] Remove middleware internal-IP dependency for contact after route migration proves it is unused.
  - Current status: intentionally deferred. Browser contact no longer depends on Server Actions, but `src/lib/actions/contact.ts` remains as a temporary compatibility adapter and its tests still prove Cloudflare Server Action identity via `INTERNAL_TRUSTED_CLIENT_IP_HEADER`. Remove this in Phase 4 together with middleware/client-IP simplification, not as a hidden Phase 2 side effect.

Run:

```bash
pnpm exec vitest run src/app/api/inquiry src/app/api/subscribe src/app/api/contact src/components/forms src/components/contact
pnpm type-check
```

Expected:

- Contact, inquiry, and subscribe have route-handler submission paths.
- The browser contact flow no longer depends on Server Action identity propagation.
- Contact wrapper chain is shorter and import ownership is clear.

Stop line:

- Stop if contact route migration duplicates more logic than it removes; extract shared validation/submission logic before continuing.

---

## Phase 3: Record-first lead pipeline

**Files to inspect/modify:**
- `src/lib/lead-pipeline/process-lead.ts`
- `src/lib/lead-pipeline/lead-schema.ts`
- `src/lib/lead-pipeline/utils.ts`
- `src/lib/lead-pipeline/processors/contact.ts`
- `src/lib/lead-pipeline/processors/product.ts`
- `src/lib/lead-pipeline/processors/newsletter.ts`
- `src/lib/lead-pipeline/pipeline-observability.ts`
- `src/lib/lead-pipeline/metrics.ts`
- `src/lib/lead-pipeline/service-result.ts`
- `src/lib/lead-pipeline/settle-service.ts`
- `src/lib/lead-pipeline/retry-async.ts`
- `src/lib/lead-pipeline/with-timeout.ts`
- `src/app/api/inquiry/route.ts`
- `src/app/api/subscribe/route.ts`
- `src/app/api/contact/route.ts`
- `src/lib/contact-form-processing.ts`
- `src/lib/actions/contact.ts`
- related tests under `src/lib/lead-pipeline/__tests__`, `src/app/api/**/__tests__`, `src/app/__tests__`

- [x] Write failing tests for Airtable success plus email failure returning user success with `referenceId`.
- [x] Write failing tests for Airtable failure preventing email send.
- [x] Write or update tests proving normal inquiry/contact submission returns a reference ID.
- [x] Define the new `LeadResult` shape: no user-facing `partialSuccess`, no public `emailResult`/`crmResult`.
- [x] Rewrite `processLead` to store first and send email second for contact/product.
- [x] Keep newsletter simpler than inquiry/contact; do not force it through artificial email symmetry.
- [x] Update API routes and contact route/action adapters to the new result shape.
- [x] Remove user-facing `partialSuccess` branches from routes, UI status, actions, and tests.
- [ ] Delete or merge processor, observability, settle/retry/timeout helpers only after `rg` proves no production consumers remain.
  - Current status: retained remaining helpers where production imports still exist. The user-visible `partialSuccess` contract was removed; remaining tests only assert absence of that field.

Run:

```bash
pnpm exec vitest run src/lib/lead-pipeline src/app/api/inquiry src/app/api/subscribe src/app/api/contact src/app/__tests__/actions.test.ts src/app/__tests__/contact-integration.test.ts
pnpm type-check
```

Expected:

- Airtable-first behavior is proved by tests.
- Email failure after record creation does not tell the buyer the submission failed.
- Airtable failure does not send email.
- No user-facing `partialSuccess` state remains.

Stop line:

- Stop if UI or API clients still need a replacement message contract for what was previously `partialSuccess`.

---

## Phase 4: Middleware, runtime surfaces, i18n payload, and Cloudflare command surface

**Files to inspect/modify:**
- `src/middleware.ts`
- `src/app/api/health/route.ts`
- `src/__tests__/middleware-locale-cookie.test.ts`
- `tests/integration/api/health.test.ts`
- `src/lib/env.ts`
- `src/lib/env-runtime.ts`
- `src/lib/env-schemas.ts`
- `src/lib/public-env.ts`
- `src/lib/logger.ts`
- `src/lib/logger-core.ts`
- `src/app/[locale]/layout.tsx`
- `src/lib/i18n/client-messages.ts`
- `package.json`
- `scripts/cloudflare/**`
- `scripts/deploy/**`
- `open-next.config.ts`
- `wrangler.jsonc`
- local Next docs under `node_modules/next/dist/docs/`

- [x] Read current local Next docs before changing middleware/proxy behavior.
- [x] Write/update tests proving `/api/health` route returns the stable payload without middleware short-circuit.
- [x] Remove `/api/health` from middleware matcher and remove health handling from middleware.
- [x] Remove internal trusted client-IP header override after Phase 2 proves contact no longer needs it.
- [x] Keep nonce/security headers only if current rendering and CSP still need them; otherwise simplify.
  - Decision: retained. `src/config/security.ts`, `src/app/[locale]/layout.tsx`, `docs/technical/technical-debt.md`, and `src/config/__tests__/security.test.ts` document/prove the current CSP trade-off: request nonce still exists, while `script-src-elem 'unsafe-inline'` is explicitly allowed for prerendered App Router output. Removing headers would reduce a real security capability, not old source-site residue.
- [x] Map client imports of `@/lib/public-env` and `@/lib/logger-core`.
- [x] Treat `src/lib/public-env.ts` as the expected browser-safe env boundary. Keep it unless a replacement proves static `NEXT_PUBLIC_*` reads and no server key exposure.
- [x] Treat `src/lib/env.ts` as the server/app facade. Keep `env-runtime.ts` and `env-schemas.ts` as internal modules if the boundary test continues to prove app code does not import them directly.
- [x] Remove unused env keys and old-platform keys after runtime consumers are removed; do not collapse the physical files just to reduce file count.
  - Removed unused server env schema/runtime keys for old database/auth/admin/cache-invalidation/AI-provider/generic tuning surfaces. Retained Vercel compatibility env, Cloudflare env, Turnstile, Airtable/Resend, Upstash/KV, rate-limit pepper, and memory fallback flags because runtime, validation, workflows, or tests still consume them.
- [x] Treat `logger-core.ts` as the current client-safe logger. Keep it unless bundle/dependency proof shows merged `logger.ts` does not pull `@/lib/env`, server schemas, raw secret maps, or PII sanitizers into client chunks.
  - Early Phase 2/4 boundary proof completed: `tests/architecture/env-boundary.test.ts` now proves `logger-core.ts` does not import `@/lib/env`, `env-runtime`, `env-schemas`, or server PII helpers; Client Components must not import `@/lib/logger` or PII sanitizers. `logger.ts` remains the server facade with `LOG_LEVEL` and sanitizers.
- [x] If merge proof is too expensive or ambiguous, retain the split and improve comments/import rules instead.
  - Decision: retained split. This is a safety boundary, not a facade cleanup candidate.
- [x] Audit and narrow root `NextIntlClientProvider` client messages.
- [x] Hide or remove phase-based public scripts.
- [x] Keep Cloudflare deploy logic behind stable `build:cf`, `preview:cf`, `deploy:cf`, and smoke commands.
  - Public package commands no longer expose `build:cf:phase*` or `deploy:cf:phase*`. Internal split-worker implementation still carries `phase6` names until a safe deploy-topology rename is separately planned.

Run:

```bash
pnpm exec vitest run src/__tests__/middleware-locale-cookie.test.ts tests/integration/api/health.test.ts src/lib/__tests__ src/lib/i18n/__tests__
pnpm exec vitest run tests/architecture/env-boundary.test.ts
pnpm website:review:client-boundary
pnpm build
pnpm build:cf
```

If preview is available:

```bash
pnpm preview:cf
pnpm smoke:cf:preview
```

Expected:

- `/api/health` has one runtime owner.
- Middleware is smaller.
- Env/logger surfaces are smaller where safe, and browser-safe boundaries remain explicit where needed.
- Root i18n provider does not hydrate unused message namespaces.
- Public command surface no longer presents phase deployment as the main story.

Stop line:

- Stop if env/logger consolidation pulls server-only code, secrets, raw server env maps, or PII helpers into client chunks.

---

## Phase 5: Tests, scripts, workflows, facades, and residue

**Files/directories to inspect/modify:**
- `package.json`
- `.github/workflows/ci.yml`
- `.github/workflows/cloudflare-deploy.yml`
- `.github/workflows/code-quality.yml`
- `.github/workflows/uplink-health.yml`
- `.github/workflows/vercel-deploy.yml`
- `vercel.json`
- `README.md`
- `docs/website/部署设置.md`
- `docs/website/quality-proof.md`
- `scripts/**`
- `tests/**`
- `src/**/__tests__/**`
- `src/lib/airtable.ts`
- `src/lib/resend.ts`
- `src/lib/content.ts`
- `src/lib/content-query.ts`
- `src/lib/lead-pipeline/index.ts`
- `messages/en.json`
- `messages/zh.json`
- `.storybook/`
- `.devtools/`
- `.sisyphus/`
- `exa-results/`
- root audit report markdown files

- [x] Decide final deployment stance: Cloudflare-only, or Cloudflare-first with Vercel manual compatibility.
  - Decision: Cloudflare-first/default with Vercel manual compatibility only. `vercel.json` remains as compatibility config; automation is not part of the default push/PR story.
- [x] If Vercel is compatibility only, demote `vercel-deploy.yml` so it no longer runs on push/PR.
- [x] If Vercel is removed, delete tracked `vercel.json` and remove references from docs/scripts.
  - N/A by decision: Vercel was not removed. It is retained as manual compatibility config only.
- [x] Collapse CI to install, lint, type-check, test, e2e where useful, build, and Cloudflare proof.
- [x] Delete or demote dedicated quality/code-review/uplink workflows if their proof role is covered elsewhere.
  - `ci.yml` now carries the push/PR proof story; Vercel and uplink health are manual-only compatibility/diagnostic workflows. `code-quality.yml` remains a non-PR deep security scan, not default starter proof.
- [x] Build a call graph for scripts from `package.json`, CI workflows, docs, and tests.
- [x] Mark scripts as `public`, `internal-maintainer`, `unused`, or `obsolete`.
  - Public starter commands retained. Phase and mutation package command families were removed from the public script surface; explicit Stryker commands remain available via `pnpm exec stryker ...` when a maintainer wants mutation testing.
- [x] Keep the five canonical starter proof command names: `brand:check`, `content:check`, `component:check`, `website:check`, `website:build:cf`.
- [x] If simplifying command internals, preserve each command contract:
  - `brand:check`: old project brand marker detection;
  - `content:check`: slug and translation integrity;
  - `component:check`: component governance plus Storybook/build proof;
  - `website:check`: type, lint, tests, and production build;
  - `website:build:cf`: Cloudflare/OpenNext build path.
  - Verified in `package.json` and `tests/unit/scripts/proof-lane-contract.test.ts`: all five command names remain and still map to their starter proof contracts.
- [x] Remove obsolete review, mutation, phase, visual, derivative, and architecture scripts after references are migrated.
  - Removed package-level phase deploy/build names and mutation command names. Kept internal split-worker implementation files because the stable Cloudflare commands still use them.
- [x] Delete pure re-export facades only after imports are migrated to concrete modules.
  - Deferred/retained by evidence, not skipped: `src/lib/airtable.ts`, `src/lib/resend.ts`, `src/lib/content.ts`, `src/lib/content-query.ts`, and `src/lib/lead-pipeline/index.ts` still have production/test consumers or mock contracts. Deleting them now would be churn without proof value.
- [x] Review flat translation compatibility files and delete them only after `validate:translations`, copy scripts, tests, and docs no longer depend on them.
  - Decision: keep `messages/en.json` and `messages/zh.json` for current compatibility; regenerated content only removes deleted partial-success keys.
- [x] Move local-only residue to Trash; do not permanently delete.
  - No untracked `.sisyphus/` or `exa-results/` residue existed. `.storybook/` and `.devtools/` are retained capabilities. Generated `.next`/`.open-next` cleanup already uses `.trash-next-artifacts/`; this ignored local artifact-trash is kept outside the source reset.

Run:

```bash
pnpm test
pnpm test:e2e
pnpm build
pnpm build:cf
```

Expected:

- Default development surface is smaller and understandable.
- Push/PR automation tells one deployment story.
- Buyer journey, locale routing, lead behavior, starter replacement checks, and Cloudflare proof remain covered.
- Removed checks do not leave important behavior unproved.
- The five canonical starter proof command names still exist.

Stop line:

- Stop if deleting workflow/script paths removes the only proof for a current starter acceptance criterion.

---

## Phase 6: Final scorecard

**Files:**
- Create: `docs/superpowers/current/starter-review-pro-reset-final-report.md`

- [x] Re-run baseline count commands with the same exclusions.
- [x] Compare before/after metrics.
- [x] List removed, demoted, consolidated, and explicitly retained systems.
- [x] Record verification commands and outputs.
- [x] Record any blocked items and why they were not forced.
- [x] Record starter-specific retained capabilities so future agents do not re-delete them blindly.

Minimum final validation:

```bash
pnpm type-check
pnpm lint:check
pnpm test
pnpm build
pnpm build:cf
```

Expected:

- Final report makes clear that the upstream reset was accepted as the main route.
- Remaining exceptions are small, evidence-backed starter capabilities.
- The repo no longer needs old governance language to explain or defend inherited complexity.
