# Content Family Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move content runtime, generated manifest artifacts, MDX loading, parser tooling, validation, and query helpers into `src/lib/content/` while preserving old import paths as compatibility facades.

**Architecture:** Treat `src/lib/content/` as the implementation home and keep top-level `src/lib/content-*`, `src/lib/mdx-loader.ts`, and `src/lib/content-query/queries.ts` as thin named-export facades. Update internal imports and generator output paths to the new content family modules, then verify the move with architecture and behavior tests.

**Tech Stack:** Next.js 16 App Router, React Server Components, TypeScript strict mode, Vitest, Node.js content generator scripts, pnpm.

---

## Scope and hard boundaries

- Do not change MDX rendering behavior.
- Do not hand-edit generated artifact contents.
- Do not use `export *` in compatibility facades.
- Do not remove compatibility facades in this PR.
- Do not run `pnpm build` and `pnpm website:build:cf` in parallel.
- Do not fold the email family cleanup into this branch.

## File structure map

### Create or move into `src/lib/content/`

- `src/lib/content/manifest.ts`
- `src/lib/content/manifest.generated.ts`
- `src/lib/content/mdx-importers.generated.ts`
- `src/lib/content/mdx-loader.ts`
- `src/lib/content/parser.ts`
- `src/lib/content/utils.ts`
- `src/lib/content/validation.ts`
- `src/lib/content/queries.ts`

### Keep as facades

- `src/lib/content-manifest.ts`
- `src/lib/content-manifest.generated.ts`
- `src/lib/mdx-importers.generated.ts`
- `src/lib/mdx-loader.ts`
- `src/lib/content-parser.ts`
- `src/lib/content-utils.ts`
- `src/lib/content-validation.ts`
- `src/lib/content-query/queries.ts`

### Tests and docs

- Add: `tests/architecture/content-family-boundary.test.ts`
- Move/update content tests under `src/lib/content/__tests__/`.
- Update: `tests/architecture/mdx-manifest-runtime-contract.test.ts`
- Update: `tests/architecture/cache-directive-policy.test.ts`
- Update: `tests/unit/scripts/mdx-slug-sync.test.ts`
- Update: `docs/website/内容设置.md`
- Update: `docs/website/AI工作流.md`
- Update: `docs/website/content-seo-contract.md`
- Update: `docs/guides/STRUCTURAL-CHANGE-CLUSTERS.md`

## Task 1: Add failing content family boundary tests

- [ ] Add `tests/architecture/content-family-boundary.test.ts`.
- [ ] Assert top-level content files do not contain implementation imports such as `node:fs`, `fs`, `node:path`, `path`, `gray-matter`, or `js-yaml`.
- [ ] Assert facade files use named exports and do not contain `export *`.
- [ ] Assert internal source files do not import old content paths:
  - `@/lib/content-manifest`
  - `@/lib/content-manifest.generated`
  - `@/lib/mdx-importers.generated`
  - `@/lib/mdx-loader`
  - `@/lib/content-parser`
  - `@/lib/content-utils`
  - `@/lib/content-validation`
  - `@/lib/content-query/queries`
- [ ] Run:

```bash
pnpm exec vitest run tests/architecture/content-family-boundary.test.ts
```

- [ ] Expected before implementation: FAIL because current implementation still lives in top-level content files.

## Task 2: Move content implementation files

- [ ] Create `src/lib/content/` target paths as needed.
- [ ] Move implementation files into the target paths.
- [ ] Update moved file imports to use `@/lib/content/*`.
- [ ] Replace old top-level files with named-export facades.
- [ ] Replace `src/lib/content-query/queries.ts` with a named-export facade to `@/lib/content/queries`.

## Task 3: Move generated artifact outputs

- [ ] Update `scripts/starter-checks.js` so `createContentManifestContext()` writes:
  - `src/lib/content/mdx-importers.generated.ts`
  - `src/lib/content/manifest.generated.ts`
- [ ] Keep old top-level generated files as compatibility facades.
- [ ] Run:

```bash
node scripts/starter-checks.js content-manifest
node scripts/starter-checks.js content-manifest --check
```

- [ ] Confirm generated artifacts are fresh and generated content was not hand-edited.

## Task 4: Update imports and tests

- [ ] Update internal production imports to new content family paths.
- [ ] Move tests from `src/lib/__tests__/content-*.test.ts` and `src/lib/__tests__/mdx-loader.test.ts` into `src/lib/content/__tests__/`.
- [ ] Update mocks to new paths.
- [ ] Update architecture expectations in `mdx-manifest-runtime-contract.test.ts` and `cache-directive-policy.test.ts`.
- [ ] Update script tests that reference generated artifact output names.

## Task 5: Update docs

- [ ] Update website docs to point to `src/lib/content/manifest.generated.ts` and `src/lib/content/mdx-importers.generated.ts`.
- [ ] Document that old top-level generated files are compatibility facades only.
- [ ] Update the structural cluster content/runtime references.

## Task 6: Verify and commit

- [ ] Run focused tests:

```bash
pnpm exec vitest run tests/architecture/content-family-boundary.test.ts tests/architecture/mdx-manifest-runtime-contract.test.ts tests/architecture/cache-directive-policy.test.ts src/lib/content/__tests__/content-parser.test.ts src/lib/content/__tests__/content-utils.test.ts src/lib/content/__tests__/content-validation.test.ts src/lib/content/__tests__/content-validation-basic.test.ts src/lib/content/__tests__/content-validation-advanced.test.ts src/lib/content/__tests__/mdx-loader.test.ts src/lib/content/__tests__/render-legal-content.test.tsx src/lib/content/__tests__/queries.test.ts tests/unit/scripts/mdx-slug-sync.test.ts
```

- [ ] Run:

```bash
pnpm type-check
pnpm lint:check
pnpm build
pnpm test
```

- [ ] Commit:

```bash
git add docs/superpowers/specs/2026-05-13-content-family-boundary-design.md docs/superpowers/plans/2026-05-13-content-family-boundary.md docs/website/内容设置.md docs/website/AI工作流.md docs/website/content-seo-contract.md docs/guides/STRUCTURAL-CHANGE-CLUSTERS.md scripts/starter-checks.js tests/architecture/content-family-boundary.test.ts tests/architecture/mdx-manifest-runtime-contract.test.ts tests/architecture/cache-directive-policy.test.ts tests/unit/scripts/mdx-slug-sync.test.ts src/lib/content src/lib/content-query/queries.ts src/lib/content-manifest.ts src/lib/content-manifest.generated.ts src/lib/mdx-importers.generated.ts src/lib/mdx-loader.ts src/lib/content-parser.ts src/lib/content-utils.ts src/lib/content-validation.ts src/app src/components src/test
git commit -m "refactor: group content runtime helpers"
```
