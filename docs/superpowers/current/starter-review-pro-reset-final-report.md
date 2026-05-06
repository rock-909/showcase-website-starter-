# Starter Review Pro Reset Final Report

Date: 2026-05-06

## Outcome

The upstream `review-pro-reset` direction was accepted as the main reset route for this starter. The implementation now keeps reusable starter capabilities and removes or demotes inherited runtime/governance complexity that does not prove starter replacement quality.

This is still a reusable showcase website starter, not a finished client website.

## Before / after scorecard

Count method: repo-local files only, excluding generated/dependency/report/artifact directories such as `node_modules`, `.next`, `.open-next`, `reports`, and `.trash-next-artifacts`.

| Metric | Baseline | After |
| --- | ---: | ---: |
| Repo file count | 1305 | 1016 |
| `src` TS/TSX files | 686 | 684 |
| `src` TS/TSX lines | 118552 | 119215 |
| `src/lib` TS/TSX files | 222 | 221 |
| `src/lib/lead-pipeline` TS/TSX files | 31 | 31 |
| Test/spec files | 368 | 370 |
| `package.json` scripts | 160 | 142 |
| `.github/workflows` files | 5 | 5 |
| `scripts/` files | 78 | 76 |
| `.claude/rules/*.md` lines | 1483 | 711 |

Notes:

- `src` line count increased because the reset added `/api/contact` tests, route tests, and explicit boundary tests while removing wrapper/source complexity.
- Workflow count stays at 5 because Vercel and uplink workflows were demoted to manual compatibility/diagnostic workflows rather than removed.

## Main changes

### Kept as starter capability

- `.claude/skills/` and `.codex/skills/` remain in the repo.
- `brand:check`, `content:check`, `component:check`, `website:check`, and `website:build:cf` remain available.
- `.storybook/` and `.devtools/` remain because they support `component:check` and `dev:react-grab`.
- Vercel compatibility config remains, but only as manual compatibility, not default automation.

### Removed or demoted

- Browser contact submission moved to `/api/contact`.
- Deleted the old tracked contact wrapper chain:
  - `src/app/actions.ts`
  - `src/components/contact/contact-form.tsx`
  - `src/components/forms/contact-form.tsx`
- Removed user-facing `partialSuccess` contract from lead results, API response helpers, UI status styling, and translations.
- Removed middleware ownership of `/api/health`.
- Removed middleware internal client-IP request override for public form flows.
- Demoted Vercel and uplink workflows to `workflow_dispatch` only.
- Collapsed CI to starter proof: type, lint, brand/content checks, client-boundary review, tests, e2e, build, and Cloudflare build.
- Removed public phase/mutation command families and obsolete grouped guardrail runner command.
- Moved root audit markdown reports under `docs/audits/`.

### Explicitly retained by proof

- `src/lib/public-env.ts` remains the browser-safe public env boundary.
- `src/lib/env.ts` remains the server/app env facade.
- `src/lib/logger-core.ts` remains client-safe; `src/lib/logger.ts` remains server-only logger facade with `LOG_LEVEL` and PII sanitizers.
- `src/lib/airtable.ts`, `src/lib/resend.ts`, `src/lib/content.ts`, `src/lib/content-query.ts`, and `src/lib/lead-pipeline/index.ts` remain because imports/tests still depend on them.
- CSP/security headers and request nonce stay; current docs/tests show they are still a real security capability, not stale middleware debt.
- Internal Cloudflare split-worker implementation files still contain `phase6` naming. Public commands hide phase names; renaming internals would be a separate deploy-topology migration.

## Env/logger boundary decision

Logger was not blindly merged.

Current boundary:

```text
client components -> @/lib/logger-core
server code       -> @/lib/logger
browser env       -> @/lib/public-env
server env        -> @/lib/env
```

Fresh boundary proof exists in `tests/architecture/env-boundary.test.ts`:

- `logger-core.ts` must not import `@/lib/env`, `env-runtime`, `env-schemas`, or PII sanitizers.
- Client Components must not import `@/lib/logger` or PII helper names.
- `public-env.ts` uses static `process.env.NEXT_PUBLIC_*` reads and excludes server-only secret names.

## Deferred items

- Re-export facades are retained until a focused import migration proves deletion is safe.
- Vercel is retained as manual compatibility; therefore `vercel.json` is intentionally not removed.
- Internal `phase6` Cloudflare script names are retained behind stable public commands.
- Real deployed preview smoke/canary was not run because no deployed preview URL was provided in this workspace.

## Fresh verification

Focused checks passed during this reset:

```bash
pnpm exec vitest run src/__tests__/middleware-locale-cookie.test.ts tests/integration/api/health.test.ts src/lib/__tests__ src/lib/i18n/__tests__ tests/architecture/env-boundary.test.ts
pnpm exec vitest run tests/unit/scripts/proof-lane-contract.test.ts tests/unit/scripts/check-mutation-required.test.ts tests/unit/workflows/ci-preview-env.test.ts tests/unit/scripts/vercel-workflow-secret-redaction.test.ts tests/unit/scripts/phase6-topology-contract.test.ts
pnpm exec vitest run tests/unit/scripts/proof-lane-contract.test.ts tests/unit/scripts/guardrail-runner-deprecation.test.ts tests/unit/workflows/ci-preview-env.test.ts
pnpm exec vitest run src/components/forms/__tests__/contact-form-submission.test.tsx src/components/forms/__tests__/contact-form-validation.test.tsx src/components/forms/__tests__/use-contact-form.test.tsx
pnpm exec vitest run src/lib/__tests__/env.test.ts tests/architecture/env-boundary.test.ts
pnpm review:docs-truth
pnpm review:server-env-boundaries
pnpm review:cf:official-compare:source
pnpm website:review:client-boundary
pnpm build
pnpm build:cf
```

Final validation passed on 2026-05-06:

```bash
pnpm brand:check
# brand:check passed

pnpm type-check
# Types generated successfully; tsc --noEmit passed

pnpm content:check
# slug validation passed; translation validation passed for en/zh with 1263 keys each

pnpm lint:check
# eslint passed; eslint-disable usage check passed

pnpm test
# 352 test files passed; 4494 tests passed

pnpm build
# Next.js production build passed; 73 static pages generated

pnpm build:cf
# Next.js webpack build passed; OpenNext Cloudflare build complete; worker saved in .open-next/worker.js

pnpm component:check
# component governance tests passed; governance check passed with 0 errors and 31 existing story warnings; Storybook build completed successfully

pnpm website:check
# type-check, lint:check, test, and Next.js production build passed

pnpm website:build:cf
# Cloudflare/OpenNext build passed through the canonical starter command

pnpm review:docs-truth
# current-truth-docs: passed

pnpm review:server-env-boundaries
# review:server-env-boundaries passed

pnpm website:review:client-boundary
# client-boundary-budget passed: 30 client boundary files
```

Notes:

- `pnpm lint:check` initially caught two small static-rule issues: one destructuring rule and one non-literal file-read rule in a workflow test. Both were fixed directly and the full lint command was rerun successfully.
- `pnpm component:check` still reports 31 warning-level missing-story items from the component governance script. The command exits 0 and preserves the current starter contract: warnings are visible maintainer backlog, not release blockers.
- Build commands emitted the existing Next.js warning that the `middleware` file convention is deprecated in favor of `proxy`. This is a framework migration warning, not a failing verification.
