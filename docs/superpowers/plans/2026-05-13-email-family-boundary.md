# Email Family Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Resend email integration helpers under `src/lib/email/` without changing lead route behavior.

**Architecture:** `src/lib/email/` owns email integration runtime and schemas. `src/emails/**` continues to own React email templates. Old `src/lib/resend-*` entrypoints remain as thin named-export compatibility facades.

**Tech Stack:** Next.js 16 App Router, React Email, Resend, TypeScript strict, Vitest.

---

### Task 1: Add boundary proof

**Files:**
- Create: `tests/architecture/email-family-boundary.test.ts`

- [ ] **Step 1: Write the failing architecture test**

Create `tests/architecture/email-family-boundary.test.ts` with checks that:

- `src/lib/email/resend-core.tsx`, `src/lib/email/resend-instance.ts`,
  `src/lib/email/resend-utils.ts`, and `src/lib/email/email-data-schema.ts`
  exist.
- `src/lib/resend-core.tsx`, `src/lib/resend-instance.ts`, and
  `src/lib/resend-utils.ts` are named-export facades only.
- source and test files do not import old `@/lib/resend-*` paths.
- React email templates remain under `src/emails/**`.

- [ ] **Step 2: Run the new test and confirm RED**

```bash
pnpm exec vitest run tests/architecture/email-family-boundary.test.ts
```

Expected: fail because the new `src/lib/email/resend-*` files do not exist yet.

### Task 2: Move Resend implementation under email

**Files:**
- Move: `src/lib/resend-core.tsx` to `src/lib/email/resend-core.tsx`
- Move: `src/lib/resend-instance.ts` to `src/lib/email/resend-instance.ts`
- Move: `src/lib/resend-utils.ts` to `src/lib/email/resend-utils.ts`
- Create facade: `src/lib/resend-core.tsx`
- Create facade: `src/lib/resend-instance.ts`
- Create facade: `src/lib/resend-utils.ts`

- [ ] **Step 1: Move implementation files**

Move each implementation file into `src/lib/email/`.

- [ ] **Step 2: Update internal imports**

Use these concrete imports:

```ts
import { EMAIL_CONFIG, ResendUtils } from "@/lib/email/resend-utils";
import { ResendService } from "@/lib/email/resend-core";
```

- [ ] **Step 3: Replace old entrypoints with facades**

Use named exports only:

```ts
export { ResendService } from "@/lib/email/resend-core";
```

```ts
export { resendService } from "@/lib/email/resend-instance";
```

```ts
export { EMAIL_CONFIG, ResendUtils } from "@/lib/email/resend-utils";
```

### Task 3: Update consumers and remove dead methods

**Files:**
- Modify: `src/lib/email/resend-core.tsx`
- Modify: `src/lib/lead-pipeline/process-lead.ts`
- Modify: `src/lib/lead-pipeline/__tests__/process-lead.test.ts`
- Modify: `src/lib/lead-pipeline/__tests__/process-lead-observability.test.ts`
- Modify: `src/emails/ConfirmationEmail.tsx`
- Modify: `src/emails/ContactFormEmail.tsx`
- Modify: `src/lib/__tests__/resend.test.ts`

- [ ] **Step 1: Update production imports**

Change old paths to:

```ts
import { resendService } from "@/lib/email/resend-instance";
import { ResendUtils } from "@/lib/email/resend-utils";
```

- [ ] **Step 2: Update mocks and test imports**

Use:

```ts
vi.mock("@/lib/email/resend-instance", () => ({
  resendService: mockResendService,
}));
```

and import `ResendService` from `../email/resend-core` in the Resend unit test.

- [ ] **Step 3: Remove dead service methods and dead tests**

Delete these `ResendService` methods from `src/lib/email/resend-core.tsx`:

```ts
getEmailStats()
getEmailConfig()
checkConnection()
```

Remove the matching test blocks from `src/lib/__tests__/resend.test.ts`.

### Task 4: Verify behavior

**Files:**
- No source changes unless verification exposes a real issue.

- [ ] **Step 1: Run focused proof**

```bash
pnpm exec vitest run tests/architecture/email-family-boundary.test.ts src/lib/__tests__/resend.test.ts src/emails/__tests__ tests/integration/api/lead-family-contract.test.ts tests/integration/api/lead-family-protection.test.ts src/lib/lead-pipeline/__tests__/process-lead.test.ts src/lib/lead-pipeline/__tests__/process-lead-observability.test.ts
```

Expected: all selected tests pass.

- [ ] **Step 2: Run branch proof**

```bash
pnpm type-check
pnpm lint:check
pnpm build
pnpm test
```

Expected: all commands pass. Known build warnings are acceptable only if they
match existing project warnings and the command exits zero.

### Task 5: Commit and PR

**Files:**
- Commit all modified files in this branch.

- [ ] **Step 1: Review diff**

```bash
git diff --stat
git diff --check
git status --short
```

Expected: no whitespace errors and only email-family files plus plan/spec/test
changes.

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "refactor: group email integration helpers"
```

- [ ] **Step 3: Push and create PR**

```bash
git push -u origin Alx-707/email-family-followup
gh pr create --base main --head Alx-707/email-family-followup --title "Refactor email integration helper boundaries" --body "<summary and tests>"
```
