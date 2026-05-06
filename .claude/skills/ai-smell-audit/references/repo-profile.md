# Repo Profile — Showcase Website Starter

Use this file as the repo-specific execution profile for `ai-smell-audit`.

It does **not** narrow audit scope. It only helps the orchestrator order work, classify noise, and identify the most important truth sources first.

## 1. Critical surfaces (check first)

These surfaces deserve first-pass attention because they are closest to business risk:

1. **Lead / inquiry / contact path**
   - `src/app/[locale]/contact/**`
   - `src/app/api/contact/**`
   - `src/lib/actions/contact.ts`
   - `src/app/api/verify-turnstile/**`
   - `src/components/forms/**`
   - `src/components/products/product-inquiry-form*`

2. **Idempotency / anti-abuse / trust boundary**
   - `src/lib/idempotency/**`
   - `src/lib/security/**`
   - `src/lib/turnstile.ts`
   - `src/lib/lead-pipeline/**`

3. **Locale / message / metadata truth**
   - `src/middleware.ts`
   - `src/i18n/**`
   - `src/lib/load-messages*`
   - `messages/**`
   - `src/app/[locale]/layout*`
   - `src/lib/structured-data.ts`

4. **Cloudflare proof boundary**
   - `open-next.config.ts`
   - `wrangler.jsonc`
   - `scripts/cloudflare/**`
   - `scripts/deploy/**`
   - `scripts/release-proof.sh`

## 2. Known noise (classify before judging repo health)

The following are common false-noise sources and should be classified before they contaminate repo verdicts:

- local orchestration scratch:
  - `.codex/.tmp`
  - `.omx/**`
- stale generated artifacts:
  - `.next/**`
  - `.open-next/**`
  - `.wrangler/**`
- generated type leftovers:
  - `.next/types/**`
- repo-external benchmark / temporary material that is not production truth

If these surfaces cause lint/type/build noise, record them as tooling or workspace drift first. Do not promote them to product-code findings without stronger proof.

## 3. Canonical truth sources (read early, cite explicitly)

Prefer these truth sources before trusting comments, wrappers, or older docs:

### Product / site identity
- `src/config/single-site.ts`
- `src/config/site-types.ts`
- `src/config/single-site-product-catalog.ts`

### Runtime / locale / request truth
- `src/middleware.ts`
- `src/i18n/**`
- `src/lib/load-messages*`
- `messages/{locale}/{critical,deferred}.json`

### Review / rule / quality truth
- `AGENTS.md`
- `CLAUDE.md`
- `.claude/rules/**`
- `.dependency-cruiser.js`
- `semgrep.yml`
- `package.json`

### Behavioral contract truth
- `docs/specs/behavioral-contracts.md`
- critical tests under:
  - `tests/integration/**`
  - `tests/e2e/**`
  - `src/**/__tests__/**` (only when they prove runtime, not shape-only)

## 4. Proof boundary map

This repo has multiple proof layers. Keep them separate:

### Build truth
- `pnpm build`
- `pnpm build:cf`

### Local preview truth
- `pnpm preview:cf`
- `pnpm smoke:cf:preview`
- `pnpm smoke:cf:preview:strict`

### Deployed truth
- `pnpm smoke:cf:deploy -- --base-url <url>`
- `pnpm proof:cf:preview-deployed`

### Review truth
- `pnpm truth:check`
- targeted `vitest` suites
- behavior-contract review

Do not let one proof layer pretend to certify another. In this repo, preview truth and deployed truth must be kept distinct.

## 5. Lane weighting for this repo

When a full deep audit runs on this repo, prioritize interpretation like this:

1. **Lane B / proof integrity on critical paths**
2. **Lane C / truth-source drift on canonical business surfaces**
3. **Lane A1 / correctness + architecture + assumption smells**
4. **Lane A2 / structural and consistency debt**

This is ordering guidance only. It is not permission to skip A2 or de-prioritize whole-repo completion.
