# React Doctor Exceptions

This file records accepted React Doctor warning exceptions. Each exception needs an exact file, rule, reason, and recheck trigger.

## Accepted exceptions

### JSON-LD script injection

- File: `src/components/seo/json-ld-script.tsx`
- Rule: `no-danger`
- Bucket: `project-exception`
- Reason: JSON-LD needs a script tag with inline JSON. `generateJSONLD` escapes `<` before injection.
- Recheck when: `generateJSONLD` changes or JSON-LD data starts accepting raw HTML.

### Local SVG logo image

- File: `src/components/layout/logo.tsx`
- Rule: `nextjs-no-img-element`
- Bucket: `project-exception`
- Reason: The logo uses a local SVG and intentionally avoids pulling `next/image` runtime into the shared layout chunk.
- Recheck when: logo delivery moves to raster images, remote assets, or a CMS.

### Development-only helper scripts

- File: `src/app/[locale]/layout.tsx`
- Rule: `nextjs-no-native-script`
- Bucket: `project-exception`
- Reason: The native scripts are gated behind `NODE_ENV === "development"` and are not loaded in production.
- Recheck when: any helper script becomes production-facing.

### Catch-all localized 404 route

- File: `src/app/[locale]/[...rest]/page.tsx`
- Rule: `nextjs-missing-metadata`
- Bucket: `project-exception`
- Reason: The route only calls `notFound()` to force the localized 404 experience.
- Recheck when: the catch-all route starts rendering buyer-visible content.

### Analytics search params island

- File: `src/components/monitoring/enterprise-analytics-island.tsx`
- Rule: `nextjs-no-use-search-params-without-suspense`
- Bucket: `project-exception`
- Reason: The analytics island calls `useSearchParams()`, but it is lazy-rendered under `<Suspense fallback={null}>` in `src/components/cookie/cookie-consent-island.tsx`. React Doctor flags the component file without seeing this parent boundary.
- Proof:
  - `src/components/monitoring/enterprise-analytics-island.tsx` calls `useSearchParams()`.
  - `src/components/cookie/cookie-consent-island.tsx` wraps `<EnterpriseAnalyticsIsland />` in `<Suspense fallback={null}>`.
- Recheck when: `EnterpriseAnalyticsIsland` is rendered from another parent, the lazy import moves, or the Suspense boundary is removed.

### Blog not-found catch boundary

- File: `src/app/[locale]/blog/[slug]/page.tsx`
- Rule: `nextjs-no-redirect-in-try-catch`
- Bucket: `needs-manual-proof`
- Reason: `notFound()` currently lives only in the `catch` branch of `loadArticle()`, after `getStarterBlogArticle()` throws for missing starter articles. This is not accepted as a project exception yet because Next.js controlled errors in broader try/catch blocks can require `unstable_rethrow()`.
- Recheck when: `loadArticle()` starts catching framework-controlled errors, the article loader becomes async, or `notFound()` moves inside a broader `try` block.

### Stream reader loop

- File: `src/lib/api/safe-parse-json.ts`
- Rule: `async-await-in-loop`
- Bucket: `project-exception`
- Reason: Request body streams are read sequentially through `reader.read()`. The loop cannot be parallelized.
- Recheck when: body parsing changes away from a stream reader.

### Radix and shadcn compatibility wrappers

- Files:
  - `src/components/ui/accordion.tsx`
  - `src/components/ui/textarea.tsx`
  - `src/components/ui/separator.tsx`
  - `src/components/ui/badge.tsx`
- Rule: `no-react19-deprecated-apis`
- Bucket: `project-exception`
- Reason: These wrappers follow Radix/shadcn compatibility patterns. React 19 ref-as-prop migration should be handled as a dedicated compatibility wave, not score-chasing.
- Recheck when: Radix/shadcn guidance for React 19 changes or the project performs a UI primitive migration.

### Turnstile external widget availability callbacks

- File: `src/components/security/turnstile.tsx`
- Rules:
  - `no-prop-callback-in-effect`
  - `no-event-handler`
- Bucket: `project-exception`
- Reason: The effects only bridge external Turnstile availability states back to the parent: development bypass emits the known bypass token once, and missing site key emits an unavailable error once. This is an adapter boundary for a third-party widget, not local state that should be lifted into a shared Provider.
- Recheck when: Turnstile verification moves into app-owned shared state, bypass/test mode changes, or the widget adapter stops owning missing-site-key behavior.
