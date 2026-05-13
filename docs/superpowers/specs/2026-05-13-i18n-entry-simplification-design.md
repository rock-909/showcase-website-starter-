# i18n Entry Simplification Design

## Outcome

Make the i18n entrypoints easier to understand without changing supported
locales, translated content, locale routing, or public route behavior.

## Current model

The current i18n surface has five distinct jobs:

1. Tool config: `i18n.json` is for extraction/translation tooling. It is not a
   runtime locale truth source.
2. Locale facts: `src/config/paths/locales-config.ts` owns the locale list,
   default locale, locale prefix, display names, time zones, and currencies.
3. Runtime routing:
   - `src/i18n/routing-config.ts` is the edge-safe `defineRouting(...)` config.
   - `src/i18n/routing.ts` is the app/UI navigation helper facade for
     `Link`, `redirect`, `usePathname`, and `useRouter`.
   - `src/i18n/request.ts` is the `next-intl/server` request config.
4. Messages:
   - `messages/{locale}/critical.json`
   - `messages/{locale}/deferred.json`
   - `src/lib/i18n/load-messages.ts`
   - `src/lib/i18n/client-messages.ts`
5. Helper utilities:
   - `src/lib/i18n/read-message-path.ts`
   - `src/lib/i18n/route-parsing.ts`
   - `src/lib/i18n/site-message-values.ts`
   - `src/lib/i18n/spec-table-translator.ts`
   - `src/lib/i18n/static-split-messages.ts`
   - `src/lib/i18n/performance.ts`

The installed Next.js App Router i18n docs still model locale routing as a
request/proxy + `[lang]` segment concern, while this project layers next-intl on
top. The hard boundary is therefore project-owned: keep proxy/middleware on the
edge-safe routing config, and keep UI navigation on the app facade.

## Problems to fix

- `src/lib/i18n/load-messages.ts` imports `Locale` from `@/i18n/routing`, even
  though it only needs the edge-safe locale type.
- `src/lib/i18n/client-messages.ts` also imports `Locale` from the UI navigation
  facade even though it only loads messages.
- `src/i18n/routing.ts` re-exports `validatePathsConfig`, which is not a
  navigation API and has no production consumer through this file.
- `src/lib/i18n/performance.ts` exposes cache-hit/cache-miss metrics and score
  evaluation that no production code consumes. Runtime only records load time
  and errors.
- `docs/website/i18n设置.md` is mostly correct, but it does not say clearly
  enough that:
  - `i18n.json` is tool config;
  - ordinary UI copy lives in messages JSON;
  - brand/site facts are interpolated through `site-message-values`;
  - MDX page prose and page SEO are not translation JSON.
- `docs/guides/STRUCTURAL-CHANGE-CLUSTERS.md` lists
  `src/i18n/locale-presentation.ts`, which does not exist.
- The dependency-cruiser i18n warning is caused by the i18n message loader
  importing the cache-tag helper that exists only for i18n tags. This is an
  accepted local dependency, not useful warning noise.

## Chosen approach

Use a conservative cleanup, not a route/runtime rewrite.

- Move type-only i18n message-loader imports from `@/i18n/routing` to
  `@/i18n/routing-config`.
- Remove the unused `validatePathsConfig` re-export from `src/i18n/routing.ts`
  and update its test.
- Simplify `src/lib/i18n/performance.ts` to only the runtime-used monitor
  surface:
  - `recordLoadTime`
  - `recordError`
  - `getMetrics`
  - `reset`
- Delete `evaluatePerformance`, `recordCacheHit`, and `recordCacheMiss` tests
  because they prove dead instrumentation, not product behavior.
- Keep `src/lib/i18n/static-split-messages.ts` for the static contact page path
  in this PR. Removing it would require a broader static-page data change.
- Add architecture proof for:
  - `i18n.json` staying out of runtime imports;
  - edge-sensitive code not importing `@/i18n/routing`;
  - lib i18n message loaders not importing the UI navigation facade;
  - `src/i18n/routing.ts` staying focused on navigation APIs;
  - the non-existent `locale-presentation.ts` not being listed in the cluster
    doc.
- Update docs so future users know which file to edit for languages, brand
  facts, ordinary UI copy, MDX prose, and tooling config.

## Rejected approaches

### Merge `i18n.json` into runtime locale config

Rejected. It is tool config with buckets and LLM/extractor settings. It should
not become runtime truth.

### Collapse `routing-config.ts` and `routing.ts`

Rejected. The split is intentional: middleware/proxy and server runtime need an
edge-safe routing config, while UI components need next-intl navigation helpers.

### Remove `static-split-messages.ts`

Rejected for this PR. It is a real static contact-page dependency. It can be
revisited in a contact/static-page tranche, not in a narrow i18n entry cleanup.

### Remove all i18n performance monitoring

Rejected. Runtime still records load time and errors, and structured-data
fallback records translation errors. Only unused cache counters and scoring are
removed.

## Acceptance criteria

- `src/lib/i18n/load-messages.ts` and `src/lib/i18n/client-messages.ts` do not
  import from `@/i18n/routing`.
- `src/i18n/routing.ts` exports only routing plus next-intl navigation helpers.
- `src/lib/i18n/performance.ts` exposes only runtime-used metrics.
- `i18n.json` remains tool-only and is not imported by `src/**`.
- `docs/website/i18n设置.md` clearly tells users where to edit:
  - language list / default locale;
  - brand factual interpolation;
  - ordinary UI copy;
  - MDX page prose and page SEO;
  - translation tooling config.
- Dependency-cruiser no longer warns on the accepted i18n cache-tag dependency.
- Locale routing, message loading, and message parity tests still pass.

## Verification

Focused proof:

```bash
pnpm exec vitest run tests/architecture/i18n-entry-boundary.test.ts src/i18n/__tests__/routing.test.ts src/i18n/__tests__/request.test.ts src/lib/__tests__/load-messages.fallback.test.ts src/lib/__tests__/load-messages-runtime.test.ts src/lib/i18n/__tests__/client-messages.test.ts src/lib/__tests__/i18n-performance.test.ts tests/unit/i18n.test.ts tests/unit/i18n-message-contract.test.ts
node scripts/starter-checks.js translations
pnpm exec dependency-cruiser src --config .dependency-cruiser.js -T err
```

Branch proof:

```bash
pnpm type-check
pnpm lint:check
pnpm build
pnpm test
```
