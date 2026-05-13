# Email Family Boundary Design

## Outcome

Group the Resend integration runtime under `src/lib/email/` while keeping React
email templates in `src/emails/`. The lead pipeline behavior stays unchanged:
create the Airtable record first, then send optional owner or confirmation
emails.

## Current problem

Email code is split across two places:

- `src/lib/resend-core.tsx`, `src/lib/resend-instance.ts`, and
  `src/lib/resend-utils.ts` contain the Resend integration.
- `src/lib/email/email-data-schema.ts` already owns email data schemas.
- `src/emails/**` owns React email templates.

This makes the boundary look accidental: schemas are in `src/lib/email/`, but
the integration helpers still live at `src/lib` root.

## Chosen approach

Use a compatibility-facade migration.

- Move implementation files to:
  - `src/lib/email/resend-core.tsx`
  - `src/lib/email/resend-instance.ts`
  - `src/lib/email/resend-utils.ts`
- Keep old paths as thin named-export facades:
  - `src/lib/resend-core.tsx`
  - `src/lib/resend-instance.ts`
  - `src/lib/resend-utils.ts`
- Update production imports to the new `@/lib/email/*` paths.
- Keep templates in `src/emails/**`; do not move template components into
  `src/lib/email/`.
- Remove dead `ResendService` utility methods that have no production
  consumers:
  - `getEmailStats()`
  - `getEmailConfig()`
  - `checkConnection()`

## Rejected approaches

### Move everything, no facade

This is cleaner in one step, but it makes old import paths break immediately.
For a starter with existing tests and likely downstream reuse, that is too much
blast radius for a boundary-only cleanup.

### Move templates into `src/lib/email/`

This mixes integration/runtime code with presentational React email templates.
The backlog explicitly says templates stay in `src/emails/**`, so this approach
is out of scope.

### Keep dead methods for compatibility

The dead methods either return static zero data or mirror `isReady()` without
doing real API connectivity. There are no production consumers. Keeping them
would preserve misleading API surface.

## Behavior contract

The public route behavior must not change:

- `/api/contact` validates input, creates the Airtable lead, then sends owner
  email and schedules confirmation email if enabled.
- `/api/inquiry` validates input, creates the Airtable lead, then sends product
  inquiry owner email.
- `/api/subscribe` behavior remains unrelated to Resend helper relocation.
- Email failure after Airtable success remains non-blocking.
- Airtable failure still prevents email sending.

## Acceptance criteria

- Email integration helpers live under `src/lib/email/`.
- Old `src/lib/resend-*` files are thin named-export facades only.
- Production code imports the concrete `@/lib/email/*` helpers instead of the
  old `@/lib/resend-*` paths.
- React email templates remain under `src/emails/**`.
- Dead `ResendService` utility methods are removed together with their tests.
- Lead pipeline sending order remains covered by existing contract tests.

## Verification

Run focused proof first:

```bash
pnpm exec vitest run tests/architecture/email-family-boundary.test.ts src/lib/__tests__/resend.test.ts src/emails/__tests__ tests/integration/api/lead-family-contract.test.ts tests/integration/api/lead-family-protection.test.ts src/lib/lead-pipeline/__tests__/process-lead.test.ts src/lib/lead-pipeline/__tests__/process-lead-observability.test.ts
```

Then run branch proof:

```bash
pnpm type-check
pnpm lint:check
pnpm build
pnpm test
```
