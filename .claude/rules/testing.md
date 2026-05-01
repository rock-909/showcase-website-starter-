---
paths:
  - "**/*.{test,spec}.{ts,tsx}"
  - "tests/**/*"
---

# Testing Standards

## Use This File When

- Adding, changing, or reviewing Vitest, Playwright, mocks, fixtures, coverage gates, or test utilities
- Changing behavior that needs regression coverage or contract proof
- Updating test commands, skipped tests, or source/test synchronization

## Do Not Use This File For

- General TypeScript style; use `coding-standards.md`
- API security controls; use `security.md`
- Next.js rendering/API rules; use `conventions.md` and `node_modules/next/dist/docs/`
- Content ownership or translation source decisions; use `content.md` or `i18n.md`

## Test Strategy Decision Table

| Change type | Preferred proof |
|-------------|-----------------|
| User-visible behavior | Behavioral contract + focused integration/E2E or component test |
| Pure utility logic | Unit test |
| Form submission path | Validation rejection + happy path + anti-abuse/idempotency coverage when applicable |
| Route/navigation/locale behavior | Playwright or route-level integration proof |
| Schema validation behavior | `vi.unmock("zod")` before assertions |
| Source component prop/DOM change | Update the paired test first, then run related tests |

## Framework

- **Unit/Integration**: Vitest + React Testing Library
- **E2E**: Playwright
- **Config**: `vitest.config.mts`

When upgrading Vitest, keep `vitest` and `@vitest/coverage-v8` on the same
patch version in the same branch. Prove the upgrade with `pnpm test`; run
`pnpm test:coverage` when the change touches coverage tooling, coverage gates,
or coverage report behavior.

When upgrading Playwright, keep `@playwright/test` and `playwright` on the same
version in the same branch. When upgrading axe tooling, treat
`@axe-core/playwright` and `axe-core` as one validation group. Prove the upgrade
with the smallest browser-facing check that exercises the lane, such as release
smoke, related E2E specs, or focused axe helper tests.

When upgrading Stryker, keep `@stryker-mutator/core` and
`@stryker-mutator/vitest-runner` on the same version in the same branch. Full
mutation testing is intentionally heavy; for dependency-only patch upgrades,
prove the tool loads with the current config plus targeted Vitest/mutation guard
checks, and reserve full mutation runs for explicit risk-driven lanes.

## Commands

```bash
pnpm test              # Run all unit tests
pnpm test:coverage     # With coverage report
pnpm test:e2e          # Playwright E2E tests
```

## CI Coverage Gate

CI enforces **70% incremental coverage** on changed files. This means: if you modify a source file, at least 70% of its executable statements must be covered by tests in the PR. The gate runs `pnpm quality:gate` in the architecture check job.

When planning work that modifies multiple source files, account for test coverage in the task breakdown. If a task changes a page or component file, it should include a step to verify incremental coverage or add tests to maintain the threshold. Run `pnpm test:coverage` locally to check before pushing.

## Behavior Contract Source

The repo-level user-facing behavior anchor is:

- `docs/specs/behavioral-contracts.md`

Use it as the plain-language contract layer above tests. Historical batch BDD files do not override it.

## Working From Behavioral Contracts

- If a change affects user-facing behavior, read `docs/specs/behavioral-contracts.md` before editing tests or claiming behavior is preserved.
- This especially applies to routing, navigation, locale switching, 404 handling, contact/inquiry/subscribe flows, product discovery, and critical CTA paths.
- If behavior changes, update the contract and the proving tests in the same branch. Do not leave behavior drift undocumented.
- If a contract remains `Partial` or `Untested` after behavior-changing work, document the current proof boundary explicitly instead of implying full coverage.

## Reliability Rules

- Do not use wall-clock thresholds (`Date.now()`, `performance.now()`, "< 1000ms", etc.) in normal unit/integration gate tests.
- If performance must be checked, use a dedicated benchmark/perf harness or an explicit opt-in test path.
- Stateful UI tests must explicitly create the state they assert against; do not rely on implicit cooldowns, shared state leakage, or timing side effects.
- If a change touches site identity wrappers or env-based site switching, tests must prove current-site behavior still matches the active site rather than only asserting object shape
- For any site-aware change, add proof for “no cross-site leakage” instead of only asserting the new site renders
- The repo already has a site-aware build lane (`build:site:equipment`), but it does **not** currently have a live `src/sites/**` tree. Do not write tests that assume `src/sites/**` exists unless that structure is added in the same branch.
- Preferred proof for site-aware changes: `pnpm build:site:equipment`; stronger platform proof: `pnpm build:cf:site:equipment`

## Test File Organization

- Unit tests: `src/[module]/__tests__/[file].test.tsx`
- E2E tests: `tests/e2e/`
- Integration: `tests/integration/`

## Playwright E2E Selectors

Use user-facing locators first. This follows Playwright + Testing Library guidance:

| Priority | Method | Use Case |
|----------|--------|----------|
| 1️⃣ | `getByRole()` | Semantic roles (button, link, heading) |
| 2️⃣ | `getByLabel()` | Form labels |
| 3️⃣ | `getByPlaceholder()` | Input placeholders |
| 4️⃣ | `getByText()` | Text content |
| 5️⃣ | `getByAltText()` / `getByTitle()` | Images or title-driven UI |
| 6️⃣ | `getByTestId()` | Last resort when user-facing locators are not practical |

```typescript
// ✅ Recommended: semantic selectors
page.getByRole('button', { name: 'Submit' });
page.getByLabel('Email address');

// ✅ Acceptable: when role/text not applicable
page.getByTestId('login-form');

// ❌ Forbidden: CSS class selectors (fragile)
page.locator('button.btn-primary.submit-form');
```

## vi.hoisted Usage

**IMPORTANT**: `vi.hoisted` callback **cannot reference external imports**, only inline literals.

```typescript
// ❌ Error: referencing external import
import { someHelper } from './helpers';
const mockFn = vi.hoisted(() => {
  return someHelper(); // ESM initialization order error!
});

// ✅ Correct: use inline literals
const mockFn = vi.hoisted(() => vi.fn());
const mockData = vi.hoisted(() => ({
  id: 'test-id',
  name: 'Test Name'
}));

vi.mock('@/lib/api', () => ({
  fetchData: mockFn
}));
```

## Global Zod Mock — Unmock for Schema Tests

The test setup (`src/test/setup.zod.ts`) globally mocks `zod` so that `safeParse` always returns `{ success: true }`. This speeds up component tests that don't care about validation but **silently breaks any test that asserts schema rejection**.

```typescript
// ❌ Will "pass" even with invalid input — safeParse is mocked
const result = contactLeadSchema.safeParse({ email: "not-an-email" });
expect(result.success).toBe(false); // WRONG: mock returns true

// ✅ Unmock zod first in any test that validates schema behavior
vi.unmock("zod");
```

Rule: Any test file that tests Zod schema validation (`.safeParse`, `.parse`, rejection paths) **must** call `vi.unmock("zod")` at the top level before `describe()`, because `vi.unmock` is hoisted.

## Centralized Mock System

**Must use centralized mocks**, no duplicate creation:

| Resource | Path |
|----------|------|
| i18n mock messages | `src/test/constants/mock-messages.ts` |
| Test utilities | `@/test/utils` |
| Mock utilities | `src/test/mock-utils.ts` |

```typescript
// ✅ Correct
import { renderWithIntl } from '@/test/utils';
import { mockMessages } from '@/test/constants/mock-messages';

// ❌ Forbidden: duplicate creation
const mockMessages = { ... };
```

## Testing Async Server Components

Server Components cannot be rendered directly. Test their logic separately:

```typescript
import { getAllPosts } from '@/lib/content';

describe('getAllPosts', () => {
  it('should return blog post list', async () => {
    const posts = await getAllPosts('en');
    expect(posts).toBeDefined();
  });
});
```

## Component-Test Sync (Twin File Principle)

When modifying source files:

1. **Check**: Does `__tests__/` contain corresponding test file?
2. **Read**: Understand current assertions
3. **Sync**: Update for DOM/API/prop changes
4. **Verify**: Run related tests before committing

| Source Change | Test Update Required |
|---------------|---------------------|
| Element type (`<a>` → `<button>`) | Update `getByRole()` queries |
| New required props | Update mock data |
| Function signature | Update assertions |

## Type-Safe Mocking

```typescript
// ❌ Bad: Bypasses type checking
const mockConfig = { enabled: true } as any;

// ✅ Good: satisfies ensures completeness
const mockConfig = {
  enabled: true,
  requiredField: 'value',
} satisfies Config;

// ✅ Good: Factory function
const mockConfig = createMockConfig({ enabled: true });
```

Factory functions in `src/test/factories/` (create if needed) — when interface changes, factory fails first.

## Skipped Tests Policy

**Target: 0 permanently skipped tests**

Every skip must have:
1. Clear technical reason
2. Issue tracking link
3. Owner + TTL
4. Alternative coverage

```typescript
// ✅ Acceptable (temporary)
// SKIP REASON: React 19 SSR limitation
// ISSUE: https://github.com/org/repo/issues/456
// OWNER: @username | TTL: 2025-Q2
test.skip('requires server environment');

// ✅ Better: Use test.todo
test.todo('should support advanced caching');

// ❌ Forbidden: No documentation
it.skip('some test', () => { ... });
```

## AI-Smell Guardrails

- Critical smoke / E2E tests must fail on runtime errors. Do not convert broken contact, inquiry, subscribe, or deploy flows into `skip`.
- Tests named `integration`, `contract`, or `protection` must not mock away the core proof path and still present themselves as the main proof. If they are mostly mocked, document them as auxiliary.
- Critical page tests must not simultaneously mock `Suspense`, translations, loaders, schema, form components, and content sources, then claim page-level proof.
- Global or local `console.warn/error` suppression must include a narrow reason comment. Suppress known fixed noise, not broad classes of real failures.
- Production-path tests must not use production constants/config as the only source of truth for expected behavior. Keep an independent assertion angle.

## Testing SSR-Safe Hooks

For `'use client'` hooks with SSR safety:

```typescript
// ❌ Wrong: Delete window
delete global.window;  // Triggers React errors

// ✅ Correct: Mock unavailable API
const originalIO = global.IntersectionObserver;
(global as any).IntersectionObserver = undefined;

const { result } = renderHook(() => useIntersectionObserver());
expect(result.current.isVisible).toBe(true); // Fallback mode

global.IntersectionObserver = originalIO;
```

## Pre-commit Verification

```bash
pnpm vitest related src/path/to/file.tsx --run
```

CI enforcement: See `scripts/quality-gate.js`
