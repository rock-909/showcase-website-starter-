# Security and Architecture Rule Slimming Design

## Goal

Keep only high-value Semgrep and dependency-cruiser rules, remove stale
project-history guardrails, and make pre-push output clean instead of carrying
ignored warnings.

## Current evidence

Baseline checks on `origin/main`:

```bash
pnpm exec dependency-cruiser src --config .dependency-cruiser.js -T err
```

Output:

```text
warn i18n-domain-boundaries: src/lib/i18n/load-messages.ts -> src/lib/cache/cache-tags.ts
x 1 dependency violations (0 errors, 1 warnings). 346 modules, 874 dependencies cruised.
```

`semgrep.yml` currently has 24 rules and 608 lines. The useful blocking
surface is the CI command:

```bash
semgrep scan --error --severity ERROR --config semgrep.yml src
```

Local Semgrep may be unavailable in this workspace; CI owns the canonical scan.

## Dependency-cruiser target

Keep core rules:

- layer boundaries: `lib -> app/components`, `components -> app`, `config -> components`
- route/API boundaries: no cross-route imports, no non-test imports of API route implementations
- dependency hygiene: no cycles, no production imports of test files/support, no dev dependencies in production
- import hygiene: no relative cross-layer imports
- component governance: Radix imports only through `src/components/ui`
- i18n/cache exception: allow `src/lib/i18n/load-messages.ts` to import `src/lib/cache/cache-tags.ts` because cache tags are intentionally shared cache infrastructure for i18n message loading

Remove stale or low-signal rules:

- `no-orphans`: currently almost entirely disabled through broad allowlists and is not a reliable proof lane
- `feature-isolation`: there is no current `src/features` surface
- `no-external-to-internal`: there is no current `src/lib/internal` surface
- `web-vitals` domain rules: no current `src/lib/web-vitals` surface
- shipped blog/product rollback rules for retired client islands
- broad warning-only i18n/domain/barrel rules that make pre-push look unhealthy without being actionable

## Semgrep target

Keep blocking security rules and starter-specific route contract rules:

- XSS/code injection: unsafe `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `Function`, weak crypto, SQL string query patterns
- secrets: hardcoded API keys and process.env logging
- untrusted key writes: `object-injection-untrusted-key-write`
- public API contracts: `no-raw-request-json-in-api`, raw proxy header reads, free-text API responses, lead routes requiring `safeParseJson`

Remove noisy heuristic object-injection sink rules:

- dynamic property access
- spread operator
- computed property
- for-in loop
- Object.keys/Object.entries write
- destructuring dynamic key
- Reflect API
- unsafe property access regex

These rules mostly produced exception lists and `nosemgrep` comments. The
remaining `object-injection-untrusted-key-write` rule covers the high-value
sink: request/query/body controlled keys used as object write keys.

Also remove stale excludes for deleted paths such as WhatsApp, web-vitals,
performance-monitoring, theme-analytics, locale-storage type factories, and
old product inquiry client islands.

## Documentation

Update `docs/guides/POLICY-SOURCE-OF-TRUTH.md` with the intended rule boundary:

- dependency-cruiser is a blocking architecture boundary tool, not a broad dead-code scanner
- Semgrep ERROR rules are CI blockers; warning/info heuristics are review signals only when intentionally retained

## Acceptance criteria

- `.dependency-cruiser.js` has no warning-severity forbidden rules.
- dependency-cruiser exits cleanly with no warnings.
- Semgrep config is shorter and has no stale path mentions for retired code surfaces.
- Semgrep keeps the high-value ERROR security rules and starter API contract rules.
- CI Semgrep wiring stays unchanged.
- Local validation passes:
  - `pnpm exec dependency-cruiser src --config .dependency-cruiser.js -T err`
  - `pnpm lint:check`
  - `pnpm test`
