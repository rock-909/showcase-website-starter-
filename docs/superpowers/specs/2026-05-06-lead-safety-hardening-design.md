# Lead Safety Hardening Design

## Goal

Make the public lead submission path safer and more predictable under retry, timeout, Turnstile, Airtable export, and Cloudflare client-IP edge cases.

This covers:

1. Lead pipeline timeout unknown-state handling.
2. Idempotency replay for JSON `NextResponse` results.
3. Endpoint-bound Turnstile action validation.
4. Airtable formula neutralization for lead fields.
5. Cloudflare client-IP fallback proof and narrowly scoped runtime trust.

It does not cover UI/accessibility/i18n cleanup, queue-based ingestion, Durable Objects, or a new CRM architecture.

## Current Evidence

Focused verification passed before this design was written:

```bash
pnpm exec vitest run \
  src/lib/security/__tests__/client-ip.test.ts \
  src/lib/__tests__/idempotency.contracts.test.ts \
  src/lib/lead-pipeline/__tests__/with-timeout.test.ts \
  src/lib/__tests__/airtable-create-operations.test.ts \
  tests/integration/api/subscribe.test.ts \
  src/app/api/inquiry/__tests__/route.test.ts
```

Result: `6 passed / 132 tests passed`.

The passing tests are not enough to close the risks. Some tests currently encode the risky behavior:

- `withTimeout()` uses `Promise.race`, so timeout does not cancel the underlying Airtable or Resend promise.
- `withIdempotency()` deletes the claimed key when the handler returns a direct `NextResponse`, so those responses are not replayed.
- Turnstile verification accepts any action in the global allowlist instead of binding the action to the current endpoint.
- Airtable lead writes sanitize plain text but do not neutralize spreadsheet formula prefixes.
- Cloudflare client-IP extraction falls back to `0.0.0.0` when the platform cannot prove a trusted Cloudflare source.

## Behavioral Contracts

### BC-LSH-001: Timed-out lead side effects are unknown, not proven failed

**Given** a lead pipeline downstream operation exceeds its configured timeout,  
**When** the pipeline records the service result,  
**Then** the timeout must be represented by a dedicated timeout error type or metadata that downstream logging and tests can distinguish from a normal rejection.

The implementation must not claim that the downstream request was canceled unless the downstream API receives and honors an abort signal.

### BC-LSH-002: JSON `NextResponse` results are replayable with idempotency

**Given** a request has an `Idempotency-Key` and the handler returns a JSON `NextResponse`,  
**When** the same key and fingerprint are submitted again,  
**Then** the second request must replay the first response body and HTTP status without re-running the handler.

This includes validation, Turnstile, partial-success, and processing-error responses that are JSON responses.

Non-JSON `NextResponse` values are out of scope and may keep the current pass-through behavior.

### BC-LSH-003: Turnstile action must match the endpoint

**Given** `/api/subscribe` receives a Turnstile token whose verification response has action `product_inquiry`,  
**When** the token is verified,  
**Then** the request must be rejected even if `product_inquiry` is globally allowed.

Endpoint bindings:

| Surface | Expected action |
| --- | --- |
| Contact Server Action / contact form processing | `contact_form` |
| `/api/inquiry` | `product_inquiry` |
| `/api/subscribe` | `newsletter_subscribe` |
| `/api/verify-turnstile` | explicit caller action when available, otherwise existing global allowlist behavior |

### BC-LSH-004: Airtable lead text is formula-neutralized at the sink

**Given** a lead field starts with `=`, `+`, `-`, or `@` after trimming leading whitespace,  
**When** the field is written to Airtable,  
**Then** the Airtable field value must be neutralized so spreadsheet export/import cannot treat it as a formula.

This is sink-specific. Do not change the global `sanitizePlainText()` behavior and do not change Resend email rendering unless a separate email-specific requirement is approved.

### BC-LSH-005: Cloudflare client-IP fallback remains narrow

**Given** the runtime is configured as Cloudflare and `NextRequest.ip` is unavailable,  
**When** a request includes `cf-connecting-ip`,  
**Then** the code may use that header only if there is runtime evidence that the request came through the Cloudflare/OpenNext boundary.

If that evidence is missing, the request must continue to fall back to `0.0.0.0` rather than trusting raw proxy headers.

## Design

### 1. Timeout unknown-state

Files:

- `src/lib/lead-pipeline/with-timeout.ts`
- `src/lib/lead-pipeline/settle-service.ts`
- `src/lib/lead-pipeline/service-result.ts` if metadata is needed
- `src/lib/lead-pipeline/__tests__/with-timeout.test.ts`
- focused processor or observability tests only if metadata must flow further

Implementation:

- Add a dedicated `OperationTimeoutError` exported from `with-timeout.ts`.
- `withTimeout()` rejects with `OperationTimeoutError`.
- Clear the timer in a `finally`/settlement path so completed promises do not leave stale timers.
- Keep the function honest: it races timeout vs promise; it does not cancel underlying side effects.
- `settleService()` keeps returning `ServiceResult`, but timeout errors remain identifiable through `error instanceof OperationTimeoutError` or a stable error property.

Acceptance tests:

- A timed-out promise rejects with `OperationTimeoutError`.
- A promise that resolves before timeout clears the timeout timer.
- `settleService()` returns failure with a timeout error that can be distinguished from a normal service rejection.

### 2. Idempotency replay for JSON `NextResponse`

Files:

- `src/lib/idempotency.ts`
- `src/lib/idempotency-utils.ts`
- `src/lib/security/stores/idempotency-store.ts`
- `src/lib/__tests__/idempotency.contracts.test.ts`
- route tests for inquiry/subscribe if needed to prove endpoint behavior

Implementation:

- Extend `IdempotencyEntry` with optional `statusCode?: number`.
- When replaying a stored success, return `NextResponse.json(entry.response, { status: entry.statusCode ?? 200 })`.
- When a claimed handler returns a direct `NextResponse`, inspect only JSON responses:
  - clone the response
  - parse JSON body
  - persist `{ status: "success", response: parsedBody, statusCode: result.status, fingerprint, createdAt, expiresAt }`
  - return the original `NextResponse`
- If JSON parsing fails or content type is not JSON, preserve existing pass-through and delete behavior.
- Keep fingerprint mismatch handling unchanged.

Acceptance tests:

- Direct JSON `NextResponse` with status 400 is persisted and replayed with status 400.
- Direct JSON partial-success response with status 200 is persisted and replayed without handler re-run.
- Non-JSON direct response keeps old pass-through behavior.
- Existing plain object handler behavior still passes.

### 3. Endpoint-bound Turnstile action

Files:

- `src/lib/turnstile.ts`
- `src/lib/api/lead-route-response.ts`
- `src/app/api/inquiry/route.ts`
- `src/app/api/subscribe/route.ts`
- contact Server Action / contact processing file that calls `verifyTurnstileDetailed`
- `tests/integration/api/subscribe.test.ts`
- `src/app/api/inquiry/__tests__/route.test.ts`
- contact action tests if the contact path receives the expected action

Implementation:

- Add an options parameter to `verifyTurnstileDetailed()`:

```ts
interface VerifyTurnstileOptions {
  expectedAction?: string;
}
```

- Validation logic:
  - if `expectedAction` is provided, `result.action` must exactly equal it after trim
  - if `expectedAction` is not provided, keep current global allowlist behavior
- Add `expectedAction` to `validateLeadTurnstileToken()`.
- Bind:
  - inquiry -> `product_inquiry`
  - subscribe -> `newsletter_subscribe`
  - contact -> `contact_form`
- Keep hostname validation unchanged.

Acceptance tests:

- Subscribe rejects `product_inquiry`.
- Inquiry rejects `newsletter_subscribe`.
- Contact passes `contact_form` and rejects a mismatched action where testable.
- Existing network failure and not-configured behavior still map to service unavailable.

### 4. Airtable formula neutralization

Files:

- `src/lib/airtable/service-internal/lead-records.ts`
- create `src/lib/airtable/service-internal/field-sanitization.ts` if keeping helpers separate is cleaner
- `src/lib/__tests__/airtable-create-operations.test.ts`

Implementation:

- Add a sink-local helper:

```ts
export function sanitizeAirtableTextField(value: string): string {
  const plain = sanitizePlainText(value);
  const trimmedStart = plain.trimStart();
  if (/^[=+\-@]/.test(trimmedStart)) {
    return `'${plain}`;
  }
  return plain;
}
```

- Use it for text fields written to Airtable lead records:
  - first name
  - last name
  - company
  - subject
  - message
  - product name
  - product slug if treated as text
  - quantity when stored as a string
  - requirements
  - newsletter static message can stay unchanged
- Keep email normalization as lower-case/trim unless a separate email-specific formula risk is demonstrated.

Acceptance tests:

- Contact lead fields starting with `=`, `+`, `-`, and `@` are prefixed before Airtable create.
- Product fields including product name, slug, quantity string, and requirements are neutralized.
- Normal text and non-ASCII names keep their current visible value.

### 5. Cloudflare client-IP fallback proof

Files:

- `src/lib/security/client-ip.ts`
- `src/lib/security/__tests__/client-ip.test.ts`
- possibly `src/middleware.ts` if the trusted internal header flow needs proof

Implementation:

- Preserve the current secure default: raw proxy headers are not trusted just because they exist.
- Add tests for the current failure mode:
  - Cloudflare platform, `NextRequest.ip` missing, only `cf-connecting-ip` present -> current fallback is `0.0.0.0`.
- Add a narrow runtime evidence path only if the repo already exposes a dependable Cloudflare/OpenNext signal in the request.
  - Acceptable examples are platform-set Cloudflare headers that cannot be supplied by browser JS in same-origin fetches and are present at the worker boundary.
  - Do not treat arbitrary `cf-connecting-ip` alone as sufficient evidence.
- If no dependable runtime evidence exists locally, stop at proof and leave the production behavior unchanged rather than weakening the trust model.

Acceptance tests:

- Trusted Cloudflare edge IP still allows `cf-connecting-ip`.
- Missing source IP plus insufficient runtime evidence still falls back to `0.0.0.0`.
- Missing source IP plus accepted Cloudflare runtime evidence allows `cf-connecting-ip`, if such evidence is implemented.
- Development and Vercel behavior remain unchanged.

## Testing Plan

Minimum focused verification:

```bash
pnpm exec vitest run \
  src/lib/lead-pipeline/__tests__/with-timeout.test.ts \
  src/lib/__tests__/idempotency.contracts.test.ts \
  src/lib/__tests__/airtable-create-operations.test.ts \
  src/lib/security/__tests__/client-ip.test.ts \
  tests/integration/api/subscribe.test.ts \
  src/app/api/inquiry/__tests__/route.test.ts \
  src/app/__tests__/actions.test.ts
```

Then run:

```bash
pnpm type-check
```

If Cloudflare runtime behavior is changed, also run:

```bash
pnpm build
pnpm build:cf
```

Do not run `pnpm build` and `pnpm build:cf` in parallel because both write `.next`.

## Rollout Notes

- Keep every change test-first.
- Do not introduce queues, Durable Objects, or broader Cloudflare topology changes.
- Do not weaken client-IP trust to make tests convenient.
- Do not treat a timeout as a confirmed downstream failure.
- Do not broaden Airtable formula handling into unrelated global sanitizers.

## Self-Review

- Placeholder scan: no `TBD`, `TODO`, or deferred requirements remain.
- Scope check: the spec is one lead-safety hardening lane; UI and large architecture changes are out of scope.
- Ambiguity check: Cloudflare IP behavior has an explicit stop line if trustworthy runtime evidence is not available.
- Type consistency: new names used in the design are stable: `OperationTimeoutError`, `VerifyTurnstileOptions`, `expectedAction`, `sanitizeAirtableTextField`, `statusCode`.
