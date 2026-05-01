---
paths:
  - "src/**/*.{ts,tsx}"
  - "tests/**/*.{ts,tsx}"
  - "**/*.{test,spec}.{ts,tsx}"
  - "*config.{js,ts,mjs,mts}"
  - "eslint.config.mjs"
  - "stryker.config.json"
---

# Code Quality Constraints

## Complexity Limits

All limits are **function-level** (cyclomatic complexity measured per function).

| File Type | max-lines | max-lines-per-function | complexity | max-depth | max-params |
|-----------|-----------|------------------------|------------|-----------|------------|
| **Production** | 500 | 120 | 15 | 3 | 3 |
| **Config** | 800 | 250 | 18 | - | - |
| **Test** | 800 | 700 | 20 | - | 8 |

### How to interpret numeric limits

These limits are quality thresholds, not mechanical rewrite targets.

If a file or function crosses a threshold, first identify the real boundary:

- route orchestration
- data/model preparation
- presenter/formatting logic
- platform adapter
- security/input boundary
- reusable UI component

Do not split code only to make the numbers pass. Same-file helper piles, object-parameter bags, and generic numeric constants are not valid fixes.

Invalid fix examples:

- extracting local functions with comments like `keep Page under 120 lines`
- replacing 8 unrelated parameters with one `{ ...locals }` object bag
- replacing `0`, `1`, or `2` with generic `ZERO`, `ONE`, or `COUNT_TWO`

Valid fix examples:

- moving JSON-LD assembly into a page-owned structured-data module
- moving platform workarounds behind an adapter
- moving spec translation into a presenter module
- keeping a justified exception when splitting would harm readability

### Production structural exceptions

Production structural guardrails still fail by default. This includes:

- `max-lines`
- `max-lines-per-function`
- `complexity`
- `max-depth`
- `max-params`
- `max-statements`
- `max-nested-callbacks`

Use an exception only when a split would damage the real boundary, reading
order, test value, or business/security expression.

Required format:

```typescript
// eslint-disable-next-line max-statements -- guardrail-exception GSE-YYYYMMDD-short-slug: route/security/presenter boundary reason
```

Rules for exceptions:

- use the smallest possible disable scope
- name the exact ESLint rule
- include `guardrail-exception <ID>: <real boundary and why splitting harms it>`
- register the same ID in `docs/guides/GUARDRAIL-SIDE-EFFECTS.md`
- include verification evidence in the registry row

`pnpm eslint:disable:check`, `pnpm lint:check`, and `pnpm quality:gate` enforce
the registry requirement. Do not use broad file-level disables as a substitute
for a real boundary decision.

### Additional Limits

| Rule | Production | Test |
|------|------------|------|
| `max-nested-callbacks` | 2 | 6 |
| `max-statements` | 20 | 50 |

### Exemptions
- Config files: `*.config.{js,ts,mjs,mts}`
- Dev tools: `src/components/dev-tools/**`, `src/app/**/dev-tools/**`

## Magic Numbers

Named constants are required for business quantities and operational thresholds:

- HTTP status codes
- timeouts / retry delays
- cache TTLs
- rate limits
- byte sizes / upload limits
- security token lengths
- business limits and thresholds

Named constants are not required for low-level language/UI idioms where the literal is clearer:

- array indexes such as `[0]` or regex capture group `[1]`
- `slice(..., -1)`
- SVG attributes such as `strokeWidth={2}`
- alpha defaults such as `alpha: 1`
- grid counts and simple layout counts
- test fixture values

Do not introduce generic numeric aliases such as `ZERO`, `ONE`, or `COUNT_TWO` in new production code unless they carry real domain meaning. Prefer direct literals for simple language idioms and named constants for business meaning.

**ESLint allowlist**: `no-magic-numbers.ignore` in `eslint.config.mjs` (source of truth)

Constants by domain:
- `src/constants/performance-constants.ts` — Performance thresholds
- `src/constants/time.ts` — Time values

## Zero Tolerance

- TypeScript: Zero errors
- ESLint: Zero warnings
- Build: No errors

## Unused Code Scanning

Knip upgrades can change unused-file or unused-dependency detection. Keep Knip
upgrades in their own dependency lane, update `docs/technical/tech-stack.md`,
and prove the change with `pnpm unused:check` before merging.

## ESLint Disable Usage

```typescript
// ❌ Broad suppress without reason
// eslint-disable-next-line
const result = riskyCall();

// ✅ Specific rule + justification
// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- validated by Zod above
const email = parsed.data.email!;
```

Prefer line-level over block-level disables.

## Production Import Boundaries

- Production code must not import `src/test/**`, `src/testing/**`, or `src/constants/test-*`
  - Enforced by `dependency-cruiser`
