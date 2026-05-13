# SEO Family Boundary Design

## Goal

Move SEO runtime implementation out of scattered `src/lib/*` top-level files and into a clear `src/lib/seo/` family without changing metadata, sitemap, or JSON-LD behavior.

This is item 3.1 from the legacy cleanup list. It intentionally excludes the later content family and email family work.

## Current shape

SEO-related implementation currently lives in two places:

- `src/lib/seo/url-generator.ts`
- Top-level `src/lib/*` files:
  - `src/lib/seo-metadata.ts`
  - `src/lib/sitemap-utils.ts`
  - `src/lib/page-structured-data.ts`
  - `src/lib/structured-data.ts`
  - `src/lib/structured-data-generators.ts`
  - `src/lib/structured-data-helpers.ts`
  - `src/lib/structured-data-types.ts`

Runtime consumers are pages, sitemap/robots metadata routes, JSON-LD components, and content/product shells.

## Target shape

`src/lib/seo/` becomes the implementation home:

- `src/lib/seo/url-generator.ts`
- `src/lib/seo/metadata.ts`
- `src/lib/seo/sitemap-utils.ts`
- `src/lib/seo/page-structured-data.ts`
- `src/lib/seo/structured-data.ts`
- `src/lib/seo/structured-data-generators.ts`
- `src/lib/seo/structured-data-helpers.ts`
- `src/lib/seo/structured-data-types.ts`

The old top-level files remain as thin compatibility facades for downstream/custom starter users:

- `src/lib/seo-metadata.ts`
- `src/lib/sitemap-utils.ts`
- `src/lib/page-structured-data.ts`
- `src/lib/structured-data.ts`
- `src/lib/structured-data-generators.ts`
- `src/lib/structured-data-helpers.ts`
- `src/lib/structured-data-types.ts`

Those facades should use named re-exports from `src/lib/seo/*`; they should not keep implementation logic or use broad `export *` barrels.

## Runtime behavior contract

No output should change:

- Page `generateMetadata()` still returns the same canonical, hreflang, robots, Open Graph, Twitter, and verification fields.
- `src/app/sitemap.ts` still returns the same localized static and product-market entries.
- JSON-LD still renders through `src/components/seo/json-ld-script.tsx` and still uses the same XSS escaping path.
- Page-level schema builders still produce the same Organization, WebSite, FAQPage, ProductGroup, BreadcrumbList, AboutPage, and legal page schemas.

## Import policy

New production code should import SEO implementation from `@/lib/seo/*`.

Compatibility imports from top-level `@/lib/seo-metadata`, `@/lib/sitemap-utils`, and `@/lib/structured-data*` are allowed for external/downstream compatibility, but internal production code should stop depending on those top-level paths.

Tests may still exercise top-level facades when proving backwards compatibility.

## Tests and proof

Add an architecture test that proves:

- all target `src/lib/seo/*` files exist;
- old top-level files are named-export compatibility facades only;
- production code under `src/app`, `src/components`, and `src/lib` does not import the old top-level SEO paths, except for the facade files themselves.

Existing behavior tests remain the main proof:

- `src/lib/__tests__/seo-metadata.test.ts`
- `src/lib/__tests__/sitemap-utils.test.ts`
- `src/lib/__tests__/structured-data.test.ts`
- `src/lib/seo/__tests__/url-generator.test.ts`
- `src/app/__tests__/sitemap.test.ts`
- `src/app/[locale]/__tests__/layout-structured-data.test.ts`
- `src/components/seo/__tests__/json-ld-script.test.ts`

## Out of scope

- Do not move content parser/validation/manifest files; that is item 3.2.
- Do not move Resend/email helper files; that is item 3.3.
- Do not change sitemap policy, indexing policy, metadata content, schema content, or route behavior.
- Do not migrate `middleware.ts` to `proxy.ts`.

## Risk

Risk is medium because this touches many import paths. The mitigation is to keep top-level compatibility facades, add a boundary test, and run focused SEO tests plus type-check/build before committing.
