# Pre-commit Slimming Design

## Goal

Make ordinary commits faster while keeping the same release confidence through
CI, pre-push, and explicit release proof commands.

## Current behavior

The current `lefthook.yml` pre-commit hook runs eight lanes:

- `format-check`
- `type-check`
- `quality-check`
- `architecture-guard`
- `config-check`
- `i18n-sync`
- `structural-clusters-review`
- `test-related`

Fresh evidence from the i18n follow-up commit showed pre-commit taking about
16 seconds, with `test-related` as the slowest lane. The hook also runs
`type-check` and `config-check`, which overlap with CI and build/type gates.

## Target behavior

Pre-commit should be a fast local mistake catcher, not a release proof.

Keep in pre-commit:

- `format-check`: staged file formatting only.
- `quality-check`: full ESLint and eslint-disable hygiene.
- `architecture-guard`: cheap staged diff guard against new bad import/export patterns.
- `i18n-sync`: already conditional; only runs for messages/content/i18n changes.

Move out of pre-commit:

- `type-check`: CI already runs `pnpm type-check`; local release/full proof still runs it through `pnpm website:check`.
- `config-check`: duplicates TypeScript-level consistency proof and is covered by CI type-check.
- `structural-clusters-review`: covered by `pnpm test` in CI and by focused suites in release proof.
- `test-related`: covered by CI `pnpm test`; developers can still run focused tests manually.

Pre-push stays heavy enough for local branch protection:

- existing build, translation, dependency-cruiser, and audit lanes remain.
- `RUN_FAST_PUSH=1` remains an emergency bypass for heavy pre-push lanes.

## CI and proof boundary

The checks removed from pre-commit are not deleted from project proof:

- `.github/workflows/ci.yml` runs `pnpm type-check`.
- `.github/workflows/ci.yml` runs `pnpm test`.
- `.github/workflows/ci.yml` runs `pnpm build` in browser smoke and Cloudflare build jobs.
- `pnpm website:check` still runs `type-check`, `lint:check`, `test`, and `build`.
- `pnpm release:verify` remains the release-facing proof path.

## Documentation updates

Update `docs/website/quality-proof.md` so derived projects understand:

- pre-commit is fast local feedback only;
- CI and local release proof own the heavier checks;
- a green commit hook is not a launch or release proof.

## Acceptance criteria

- `lefthook.yml` pre-commit no longer contains `type-check`, `config-check`,
  `structural-clusters-review`, or `test-related`.
- `lefthook.yml` pre-commit still contains `format-check`, `quality-check`,
  `architecture-guard`, and conditional `i18n-sync`.
- CI still contains `pnpm type-check`, `pnpm test`, and build jobs.
- `RUN_FAST_PUSH=1` remains documented in pre-push hook output.
- Quality docs explain hook vs CI vs release proof responsibilities.
