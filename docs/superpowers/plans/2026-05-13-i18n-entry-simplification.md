# i18n Entry Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify i18n entrypoints and documentation without changing locale behavior or message content.

**Architecture:** Keep the current split: `i18n.json` is tool config, `locales-config.ts` is locale fact truth, `routing-config.ts` is edge-safe runtime routing, `routing.ts` is UI navigation, and `src/lib/i18n/*` owns message/helper utilities.

**Tech Stack:** Next.js 16 App Router, next-intl 4.11.2, TypeScript strict, Vitest, dependency-cruiser.

---

### Task 1: Add boundary proof

**Files:**
- Create: `tests/architecture/i18n-entry-boundary.test.ts`

- [ ] **Step 1: Write failing architecture tests**

Create `tests/architecture/i18n-entry-boundary.test.ts` with checks that:

- no `src/**` file imports `i18n.json`;
- edge-sensitive files do not import `@/i18n/routing`;
- `src/lib/i18n/load-messages.ts` and `src/lib/i18n/client-messages.ts` do
  not import `@/i18n/routing`;
- `src/i18n/routing.ts` does not re-export `validatePathsConfig`;
- `docs/guides/STRUCTURAL-CHANGE-CLUSTERS.md` does not mention the missing
  `src/i18n/locale-presentation.ts`;
- `src/lib/i18n/performance.ts` does not expose cache-hit/cache-miss APIs or
  scoring APIs.

- [ ] **Step 2: Run the test and confirm RED**

```bash
pnpm exec vitest run tests/architecture/i18n-entry-boundary.test.ts
```

Expected: fail because current source still imports `@/i18n/routing` from
message helper files, routing re-exports `validatePathsConfig`, docs mention a
missing file, and performance exports unused instrumentation.

### Task 2: Tighten i18n code entrypoints

**Files:**
- Modify: `src/lib/i18n/load-messages.ts`
- Modify: `src/lib/i18n/client-messages.ts`
- Modify: `src/i18n/routing.ts`
- Modify: `src/i18n/__tests__/routing.test.ts`

- [ ] **Step 1: Update type-only locale imports**

Change:

```ts
import { type Locale } from "@/i18n/routing";
```

to:

```ts
import type { Locale } from "@/i18n/routing-config";
```

in `load-messages.ts` and `client-messages.ts`.

- [ ] **Step 2: Remove unrelated routing facade export**

Delete this export from `src/i18n/routing.ts`:

```ts
export { validatePathsConfig } from "@/config/paths/utils";
```

- [ ] **Step 3: Update the routing test**

Remove the test block that asserts `validatePathsConfig` is exported through
`src/i18n/routing.ts`. `validatePathsConfig` remains available from
`@/config/paths`.

### Task 3: Simplify i18n performance instrumentation

**Files:**
- Modify: `src/lib/i18n/performance.ts`
- Modify: `src/lib/__tests__/i18n-performance.test.ts`

- [ ] **Step 1: Keep only runtime-used monitor APIs**

Keep:

```ts
recordLoadTime(time: number): void
recordError(): void
getMetrics(): { averageLoadTime: number; totalErrors: number }
reset(): void
```

Remove:

```ts
recordCacheHit()
recordCacheMiss()
evaluatePerformance()
```

- [ ] **Step 2: Update tests**

Keep tests for:

- recording average load time;
- tracking errors;
- reset.

Delete tests that only prove cache-hit/cache-miss scoring or grade evaluation.

### Task 4: Update docs and dependency boundary

**Files:**
- Modify: `docs/website/i18n设置.md`
- Modify: `docs/guides/STRUCTURAL-CHANGE-CLUSTERS.md`
- Modify: `docs/technical/next16-cache-notes.md`
- Modify: `.dependency-cruiser.js`

- [ ] **Step 1: Clarify i18n edit map**

Update `docs/website/i18n设置.md` to explicitly state:

- change language list/default locale in `src/config/paths/locales-config.ts`;
- change brand facts in `src/config/single-site.ts`;
- change ordinary UI copy in split `messages/{locale}` files;
- change page prose and page SEO in `content/pages/{locale}/*.mdx`;
- change translation tool behavior in `i18n.json`;
- do not merge `i18n.json` into runtime config.

- [ ] **Step 2: Remove stale cluster file**

Remove `src/i18n/locale-presentation.ts` from
`docs/guides/STRUCTURAL-CHANGE-CLUSTERS.md`.

- [ ] **Step 3: Update cache notes**

Change `src/lib/i18n/performance.ts` wording in
`docs/technical/next16-cache-notes.md` to request-level i18n metrics.

- [ ] **Step 4: Suppress accepted dependency-cruiser warning**

Allow `src/lib/i18n/load-messages.ts` to import `src/lib/cache/cache-tags.ts`
because that helper exists for i18n cache tags.

### Task 5: Verify and PR

**Files:**
- No source changes unless verification exposes a real issue.

- [ ] **Step 1: Run focused proof**

```bash
pnpm exec vitest run tests/architecture/i18n-entry-boundary.test.ts src/i18n/__tests__/routing.test.ts src/i18n/__tests__/request.test.ts src/lib/__tests__/load-messages.fallback.test.ts src/lib/__tests__/load-messages-runtime.test.ts src/lib/i18n/__tests__/client-messages.test.ts src/lib/__tests__/i18n-performance.test.ts tests/unit/i18n.test.ts tests/unit/i18n-message-contract.test.ts
node scripts/starter-checks.js translations
pnpm exec dependency-cruiser src --config .dependency-cruiser.js -T err
```

Expected: focused Vitest and translations pass. Dependency-cruiser has no
i18n-domain-boundaries warning.

- [ ] **Step 2: Run branch proof**

```bash
pnpm type-check
pnpm lint:check
pnpm build
pnpm test
```

Expected: all commands pass. Existing build warnings are acceptable only if the
command exits zero and the warning class is pre-existing.

- [ ] **Step 3: Commit and PR**

```bash
git add -A
git commit -m "refactor: simplify i18n entry boundaries"
git push -u origin Alx-707/i18n-entry-followup
gh pr create --base main --head Alx-707/i18n-entry-followup --title "Simplify i18n entry boundaries" --body "<summary and tests>"
```
