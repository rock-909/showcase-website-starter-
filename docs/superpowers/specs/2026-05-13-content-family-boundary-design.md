# Content Family Boundary Design

## Purpose

Put content runtime, MDX loading, parser tooling, validation, and query helpers under one clear owner: `src/lib/content/`.

The previous MDX manifest work already made runtime rendering manifest-only. This follow-up is a structural cleanup: it reduces the remaining `src/lib/content-*` top-level scatter without changing page rendering behavior.

## Current model mapped on 2026-05-13

Content code currently sits in two shapes:

- family directory:
  - `src/lib/content/page-dates.ts`
  - `src/lib/content/mdx-faq.ts`
  - `src/lib/content/legal-page.ts`
  - `src/lib/content/render-legal-content.tsx`
- scattered top-level/runtime files:
  - `src/lib/content-manifest.ts`
  - `src/lib/content-manifest.generated.ts`
  - `src/lib/mdx-importers.generated.ts`
  - `src/lib/mdx-loader.ts`
  - `src/lib/content-parser.ts`
  - `src/lib/content-utils.ts`
  - `src/lib/content-validation.ts`
  - `src/lib/content-query/queries.ts`

That split makes ownership harder to see. New contributors cannot quickly tell which files are runtime, tooling, generated, or public query surface.

## Decision

Use `src/lib/content/` as the content family home.

Move implementation files into focused modules:

- `src/lib/content/manifest.ts`
- `src/lib/content/manifest.generated.ts`
- `src/lib/content/mdx-importers.generated.ts`
- `src/lib/content/mdx-loader.ts`
- `src/lib/content/parser.ts`
- `src/lib/content/utils.ts`
- `src/lib/content/validation.ts`
- `src/lib/content/queries.ts`

Keep old import paths as compatibility facades where they are reasonable public entry points:

- `src/lib/content-manifest.ts`
- `src/lib/mdx-loader.ts`
- `src/lib/content-parser.ts`
- `src/lib/content-utils.ts`
- `src/lib/content-validation.ts`
- `src/lib/content-query/queries.ts`
- `src/lib/content-manifest.generated.ts`
- `src/lib/mdx-importers.generated.ts`

The facades must use named exports. Do not introduce `export *`.

## In scope

- Move implementation code into `src/lib/content/`.
- Update internal production imports to use `@/lib/content/*`.
- Update the manifest generator output paths to the new generated artifact locations.
- Refresh generated artifacts through `node scripts/starter-checks.js content-manifest`.
- Move content-focused tests into `src/lib/content/__tests__/` where practical.
- Add an architecture test that prevents the old top-level content modules from becoming implementation files again.
- Update website docs that mention generated artifact locations.

## Out of scope

- Do not change MDX rendering behavior.
- Do not change page copy, frontmatter values, localized route behavior, sitemap semantics, or JSON-LD behavior.
- Do not hand-edit generated artifact contents.
- Do not remove compatibility facades in this PR.
- Do not merge this with the email family cleanup.

## Runtime contract

Runtime content lookup remains manifest-only:

- `src/lib/content/manifest.ts` reads `src/lib/content/manifest.generated.ts`.
- `src/lib/content/mdx-loader.ts` reads `src/lib/content/mdx-importers.generated.ts`.
- Runtime files do not read `content/**` through `fs`, `path`, `gray-matter`, globbing, or parser utilities.

Parser and utility modules may keep filesystem access because they are tooling/runtime-support boundaries for local parsing tests and generator-adjacent behavior, not the MDX rendering path.

## Compatibility contract

Old modules stay as thin facades for downstream users and gradual migration:

- no filesystem or parser logic in facade files;
- no `export *`;
- internal production code should not import from old facades;
- tests should prefer new content family paths unless they intentionally test compatibility.

## Generated artifact contract

Generated files move under `src/lib/content/`, but the generator stays the only writer:

```bash
node scripts/starter-checks.js content-manifest
node scripts/starter-checks.js content-manifest --check
```

The old top-level generated paths may exist only as hand-written compatibility facades. They are not generated outputs after this change.

## Testing strategy

Focused tests should cover:

1. content family boundary:
   - old top-level content files are named-export facades;
   - internal code imports new `@/lib/content/*` paths;
   - generated artifacts are under `src/lib/content/`;
2. runtime behavior:
   - MDX loader still returns `null` for missing manifest/importer/import failures;
   - content query still returns the same page shape;
3. generator behavior:
   - `content-manifest` writes/checks the new generated artifact paths;
4. broad safety:
   - content parser/utils/validation tests still pass;
   - content page rendering tests still pass;
   - type-check, lint, full tests, and build pass.

## Acceptance criteria

- Content implementation is no longer scattered across top-level `src/lib/content-*` files.
- Old content import paths remain usable as compatibility facades.
- Internal production imports use `@/lib/content/*`.
- Generated manifest/importer artifacts live under `src/lib/content/` and are refreshed by the existing generator command.
- Existing MDX rendering behavior is unchanged.

## Risks

- Moving generated artifacts can break mocks, architecture tests, or scripts that hard-code old paths.
- Keeping old generated filenames as facades can confuse future agents unless docs clearly say they are compatibility files, not generated outputs.
- Broad import rewrites can accidentally touch behavior. Keep implementation moves mechanical and verify with focused tests before full gates.
