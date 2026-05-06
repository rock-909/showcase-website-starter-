# Lead Safety Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the public lead submission path against retry drift, timeout ambiguity, Turnstile action reuse, Airtable formula payloads, and Cloudflare client-IP fallback mistakes.

**Architecture:** Keep the current lead pipeline boundaries. Add focused behavior contracts at the lowest reliable layer first, then make narrow implementation changes. Timeout handling remains honest about unknown downstream state; idempotency stores replayable JSON responses; Turnstile action validation becomes endpoint-bound; Airtable neutralization stays sink-local; Cloudflare IP trust remains conservative unless a dependable runtime signal is proven.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Vitest, Cloudflare/OpenNext, Airtable SDK, Cloudflare Turnstile.

---

## File Structure

- `src/lib/lead-pipeline/with-timeout.ts` owns timeout racing and `OperationTimeoutError`.
- `src/lib/lead-pipeline/settle-service.ts` converts downstream operation promises into `ServiceResult`.
- `src/lib/lead-pipeline/__tests__/with-timeout.test.ts` owns timeout and settle-service contract tests.
- `src/lib/security/stores/idempotency-store.ts` owns persisted idempotency entry shape.
- `src/lib/idempotency-utils.ts` owns result normalization and replay waiting behavior.
- `src/lib/idempotency.ts` owns request-level idempotency state transitions.
- `src/lib/__tests__/idempotency.contracts.test.ts` owns request idempotency behavior tests.
- `src/lib/turnstile.ts` owns Cloudflare Turnstile verification and action validation.
- `src/lib/api/lead-route-response.ts` owns shared lead-route Turnstile response mapping.
- `src/app/api/inquiry/route.ts` binds inquiry to `product_inquiry`.
- `src/app/api/subscribe/route.ts` binds subscribe to `newsletter_subscribe`.
- `src/lib/contact-form-processing.ts` binds contact validation to `contact_form`.
- `src/app/api/inquiry/__tests__/route.test.ts`, `tests/integration/api/subscribe.test.ts`, `src/app/__tests__/actions.test.ts`, and `src/app/__tests__/contact-integration.test.ts` prove endpoint action binding.
- `src/lib/airtable/service-internal/field-sanitization.ts` owns Airtable sink-local text neutralization.
- `src/lib/airtable/service-internal/lead-records.ts` applies Airtable text neutralization.
- `src/lib/__tests__/airtable-create-operations.test.ts` proves Airtable lead field mapping and neutralization.
- `src/lib/security/client-ip.ts` owns client IP extraction and trust model.
- `src/lib/security/__tests__/client-ip.test.ts` proves Cloudflare fallback behavior and stop line.
- `docs/specs/behavioral-contracts.md` records the lead-safety behavior contract link if implementation changes user-facing lead behavior.

## Task 1: Timeout unknown-state contract

**Files:**
- Modify: `src/lib/lead-pipeline/with-timeout.ts`
- Modify: `src/lib/lead-pipeline/settle-service.ts`
- Test: `src/lib/lead-pipeline/__tests__/with-timeout.test.ts`

- [ ] **Step 1: Write failing test for timeout error type**

Add this import:

```ts
import {
  OperationTimeoutError,
  withTimeout,
} from "../with-timeout";
```

Replace the existing single import from `../with-timeout`.

Add this test inside `describe("withTimeout", () => { ... })`:

```ts
it("rejects with OperationTimeoutError so timeout unknown-state is distinguishable", async () => {
  const neverResolves = new Promise(() => {});

  const resultPromise = withTimeout(neverResolves, 500, "airtableSubmission");

  vi.advanceTimersByTime(500);

  await expect(resultPromise).rejects.toBeInstanceOf(OperationTimeoutError);
  await expect(resultPromise).rejects.toMatchObject({
    name: "OperationTimeoutError",
    operationName: "airtableSubmission",
    timeoutMs: 500,
  });
});
```

- [ ] **Step 2: Write failing test for timer cleanup after quick resolution**

Add this test:

```ts
it("clears the timeout timer when the wrapped promise settles first", async () => {
  const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");

  const result = await withTimeout(
    Promise.resolve("done"),
    1000,
    "quickOperation",
  );

  expect(result).toBe("done");
  expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 3: Write failing test for `settleService()` preserving timeout identity**

Add this import:

```ts
import { settleService } from "../settle-service";
```

Add this test:

```ts
it("settleService preserves OperationTimeoutError on timed-out operations", async () => {
  const neverResolves = new Promise(() => {});

  const resultPromise = settleService(neverResolves, {
    operationName: "CRM record",
    timeoutMs: 500,
  });

  vi.advanceTimersByTime(500);
  const result = await resultPromise;

  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.error).toBeInstanceOf(OperationTimeoutError);
    expect(result.error.message).toBe("CRM record timed out after 500ms");
  }
});
```

- [ ] **Step 4: Run timeout tests and verify RED**

Run:

```bash
pnpm exec vitest run src/lib/lead-pipeline/__tests__/with-timeout.test.ts
```

Expected: fail because `OperationTimeoutError` is not exported and `clearTimeout` is not called.

- [ ] **Step 5: Implement `OperationTimeoutError` and timer cleanup**

Update `src/lib/lead-pipeline/with-timeout.ts`:

```ts
export const OPERATION_TIMEOUT_MS = 10000; // 10 seconds

export class OperationTimeoutError extends Error {
  readonly operationName: string;
  readonly timeoutMs: number;

  constructor(operationName: string, timeoutMs: number) {
    super(`${operationName} timed out after ${timeoutMs}ms`);
    this.name = "OperationTimeoutError";
    this.operationName = operationName;
    this.timeoutMs = timeoutMs;
  }
}

export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName: string,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new OperationTimeoutError(operationName, timeoutMs)),
      timeoutMs,
    );
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}
```

- [ ] **Step 6: Run timeout tests and verify GREEN**

Run:

```bash
pnpm exec vitest run src/lib/lead-pipeline/__tests__/with-timeout.test.ts
```

Expected: all tests in the file pass.

## Task 2: Idempotency replay for direct JSON `NextResponse`

**Files:**
- Modify: `src/lib/security/stores/idempotency-store.ts`
- Modify: `src/lib/idempotency-utils.ts`
- Modify: `src/lib/idempotency.ts`
- Test: `src/lib/__tests__/idempotency.contracts.test.ts`

- [ ] **Step 1: Write failing test for stored success status replay**

In `src/lib/__tests__/idempotency.contracts.test.ts`, add this test near the existing stored success replay test:

```ts
it("replays stored success responses with their original HTTP status", async () => {
  mocks.mockStore.get.mockResolvedValue({
    createdAt: 1,
    expiresAt: 2,
    fingerprint: "POST:/api/inquiry",
    response: {
      errorCode: API_ERROR_CODES.INQUIRY_SECURITY_REQUIRED,
      success: false,
    },
    status: "success",
    statusCode: HTTP_BAD_REQUEST,
  });

  const response = await withIdempotency(
    createRequest("POST", "/api/inquiry", "cached-error-key"),
    async () => ({ shouldNotRun: true }),
    { fingerprint: "POST:/api/inquiry" },
  );

  expect(response.status).toBe(HTTP_BAD_REQUEST);
  expect(await response.json()).toEqual({
    errorCode: API_ERROR_CODES.INQUIRY_SECURITY_REQUIRED,
    success: false,
  });
});
```

- [ ] **Step 2: Replace current direct `NextResponse` cleanup test with JSON caching expectations**

Find the test named:

```ts
it("passes through direct NextResponse results and warns if cleanup fails", async () => {
```

Replace it with:

```ts
it("persists direct JSON NextResponse results for idempotent replay", async () => {
  vi.spyOn(Date, "now").mockReturnValue(3_000);
  const directResponse = NextResponse.json(
    {
      errorCode: API_ERROR_CODES.INQUIRY_SECURITY_REQUIRED,
      success: false,
    },
    { status: HTTP_BAD_REQUEST },
  );

  const response = await withIdempotency(
    createRequest("POST", "/api/inquiry", "direct-json-key"),
    async () => directResponse,
    {
      fingerprint: "POST:/api/inquiry",
      ttl: 1_234,
    },
  );

  expect(response).toBe(directResponse);
  expect(mocks.mockStore.set).toHaveBeenCalledWith(
    "direct-json-key",
    {
      createdAt: 3_000,
      expiresAt: 4_234,
      fingerprint: "POST:/api/inquiry",
      response: {
        errorCode: API_ERROR_CODES.INQUIRY_SECURITY_REQUIRED,
        success: false,
      },
      status: "success",
      statusCode: HTTP_BAD_REQUEST,
    },
    1_234,
  );
  expect(mocks.mockStore.delete).not.toHaveBeenCalled();
});
```

- [ ] **Step 3: Add failing test for non-JSON direct `NextResponse` pass-through**

Add this test after the JSON caching test:

```ts
it("keeps non-JSON direct NextResponse results as pass-through and deletes the pending key", async () => {
  const directResponse = new NextResponse("plain text", {
    headers: { "Content-Type": "text/plain" },
    status: 202,
  });

  const response = await withIdempotency(
    createRequest("POST", "/api/inquiry", "direct-non-json-key"),
    async () => directResponse,
    { fingerprint: "POST:/api/inquiry" },
  );

  expect(response).toBe(directResponse);
  expect(mocks.mockStore.set).not.toHaveBeenCalled();
  expect(mocks.mockStore.delete).toHaveBeenCalledWith("direct-non-json-key");
});
```

- [ ] **Step 4: Run idempotency tests and verify RED**

Run:

```bash
pnpm exec vitest run src/lib/__tests__/idempotency.contracts.test.ts
```

Expected: fail because stored entries ignore `statusCode` and direct JSON `NextResponse` is not cached.

- [ ] **Step 5: Extend idempotency entry shape**

Update `src/lib/security/stores/idempotency-store.ts`:

```ts
export interface IdempotencyEntry {
  status: "pending" | "success" | "error";
  fingerprint?: string;
  response?: unknown;
  statusCode?: number;
  error?: string;
  createdAt: number;
  expiresAt: number;
}
```

- [ ] **Step 6: Replay stored success with original status**

Update `waitForCompletion()` in `src/lib/idempotency-utils.ts`:

```ts
if (entry.status === "success") {
  return NextResponse.json(entry.response, {
    status: entry.statusCode ?? HTTP_OK,
  });
}
```

Update `handleExistingEntry()` in `src/lib/idempotency.ts`:

```ts
if (existing.status === "success") {
  return NextResponse.json(existing.response, {
    status: existing.statusCode ?? 200,
  });
}
```

- [ ] **Step 7: Add helper for cacheable direct JSON response**

In `src/lib/idempotency.ts`, add helper functions above `handleWithIdempotencyKey()`:

```ts
function isJsonResponse(response: NextResponse): boolean {
  const contentType = response.headers.get("content-type") ?? "";
  return contentType.toLowerCase().includes("application/json");
}

async function persistDirectJsonResponse(
  params: {
    response: NextResponse;
    store: IdempotencyStore;
    idempotencyKey: string;
    fingerprint: string;
    createdAt: number;
    ttlMs: number;
  },
): Promise<boolean> {
  const { response, store, idempotencyKey, fingerprint, createdAt, ttlMs } =
    params;

  if (!isJsonResponse(response)) {
    return false;
  }

  const body = await response.clone().json();
  await store.set(
    idempotencyKey,
    {
      createdAt,
      expiresAt: createdAt + ttlMs,
      fingerprint,
      response: body,
      status: "success",
      statusCode: response.status,
    },
    ttlMs,
  );
  return true;
}
```

- [ ] **Step 8: Cache direct JSON `NextResponse`, preserve old fallback for non-JSON**

Replace the `if (result instanceof NextResponse) { ... }` block in `handleWithIdempotencyKey()` with:

```ts
if (result instanceof NextResponse) {
  try {
    const persisted = await persistDirectJsonResponse({
      response: result,
      store,
      idempotencyKey,
      fingerprint,
      createdAt: now,
      ttlMs,
    });
    if (persisted) return result;
  } catch (persistError) {
    logger.error(
      "Failed to persist direct JSON idempotency result — key remains PENDING until TTL expires",
      { persistError, idempotencyKey },
    );
    return result;
  }

  try {
    await store.delete(idempotencyKey);
  } catch (deleteError) {
    logger.warn("Failed to delete non-cached idempotency key", {
      deleteError,
      idempotencyKey,
    });
  }
  return result;
}
```

- [ ] **Step 9: Run idempotency tests and verify GREEN**

Run:

```bash
pnpm exec vitest run src/lib/__tests__/idempotency.contracts.test.ts
```

Expected: all idempotency contract tests pass.

## Task 3: Endpoint-bound Turnstile action validation

**Files:**
- Modify: `src/lib/turnstile.ts`
- Modify: `src/lib/api/lead-route-response.ts`
- Modify: `src/app/api/inquiry/route.ts`
- Modify: `src/app/api/subscribe/route.ts`
- Modify: `src/lib/contact-form-processing.ts`
- Test: `tests/integration/api/subscribe.test.ts`
- Test: `src/app/api/inquiry/__tests__/route.test.ts`
- Test: `src/app/__tests__/actions.test.ts`
- Test: `src/app/__tests__/contact-integration.test.ts`

- [ ] **Step 1: Write failing subscribe expected-action test**

In `tests/integration/api/subscribe.test.ts`, add after the successful submit test:

```ts
it("binds Turnstile verification to the newsletter_subscribe action", async () => {
  const utils = await import("@/lib/turnstile");

  await route.POST(
    makeReq({ email: "ok@example.com", turnstileToken: "valid-token" }),
  );

  expect(utils.verifyTurnstileDetailed).toHaveBeenCalledWith(
    "valid-token",
    expect.any(String),
    { expectedAction: "newsletter_subscribe" },
  );
});
```

- [ ] **Step 2: Write failing inquiry expected-action test**

In `src/app/api/inquiry/__tests__/route.test.ts`, add after the successful submit test:

```ts
it("binds Turnstile verification to the product_inquiry action", async () => {
  const request = createInquiryRequest(JSON.stringify(validInquiryData));

  await POST(request);

  expect(verifyTurnstileDetailed).toHaveBeenCalledWith(
    "valid-token",
    expect.any(String),
    { expectedAction: "product_inquiry" },
  );
});
```

- [ ] **Step 3: Update contact action expectation tests to include action**

In `src/app/__tests__/actions.test.ts`, update existing expectations like:

```ts
expect(verifyTurnstileDetailed).toHaveBeenCalledWith(
  "valid-token",
  expect.any(String),
);
```

to:

```ts
expect(verifyTurnstileDetailed).toHaveBeenCalledWith(
  "valid-token",
  expect.any(String),
  { expectedAction: "contact_form" },
);
```

Do the same in `src/app/__tests__/contact-integration.test.ts` for contact validation expectations.

- [ ] **Step 4: Run action-binding tests and verify RED**

Run:

```bash
pnpm exec vitest run tests/integration/api/subscribe.test.ts src/app/api/inquiry/__tests__/route.test.ts src/app/__tests__/actions.test.ts src/app/__tests__/contact-integration.test.ts
```

Expected: fail because `verifyTurnstileDetailed()` is currently called with two arguments.

- [ ] **Step 5: Add Turnstile action options**

Update `src/lib/turnstile.ts`:

```ts
interface VerifyTurnstileOptions {
  expectedAction?: string;
}
```

Change `verifyTurnstileDetailed()` signature:

```ts
export async function verifyTurnstileDetailed(
  token: string,
  ip: string,
  options: VerifyTurnstileOptions = {},
): Promise<{ success: boolean; errorCodes?: string[] }> {
```

Change `validateTurnstileActionResponse()` signature:

```ts
function validateTurnstileActionResponse(
  result: TurnstileVerificationResult,
  ip: string,
  expectedAction?: string,
): boolean {
  if (expectedAction) {
    const actualAction = result.action?.trim();
    if (actualAction === expectedAction) {
      return true;
    }
    logger.warn("Turnstile verification rejected due to mismatched action", {
      action: result.action,
      expectedAction,
      ip: sanitizeIP(ip),
    });
    return false;
  }

  if (isAllowedTurnstileAction(result.action)) {
    return true;
  }

  const configuredExpectedAction = getExpectedTurnstileAction();
  logger.warn("Turnstile verification rejected due to mismatched action", {
    action: result.action,
    expectedAction: configuredExpectedAction,
    ip: sanitizeIP(ip),
  });
  return false;
}
```

Update the call:

```ts
if (!validateTurnstileActionResponse(result, ip, options.expectedAction)) {
```

- [ ] **Step 6: Thread expected action through lead route response helper**

Update `TurnstileValidationOptions` in `src/lib/api/lead-route-response.ts`:

```ts
expectedAction: string;
```

Destructure it:

```ts
expectedAction,
```

Update verification call:

```ts
const verificationResult = await verifyTurnstileDetailed(token, clientIP, {
  expectedAction,
});
```

- [ ] **Step 7: Bind expected actions in API routes**

In `src/app/api/inquiry/route.ts`, add to `validateLeadTurnstileToken()` options:

```ts
expectedAction: "product_inquiry",
```

In `src/app/api/subscribe/route.ts`, add:

```ts
expectedAction: "newsletter_subscribe",
```

- [ ] **Step 8: Bind expected action in contact validation**

In `src/lib/contact-form-processing.ts`, update:

```ts
const verificationResult = await verifyTurnstileDetailed(
  formData.turnstileToken,
  clientIP,
  { expectedAction: "contact_form" },
);
```

- [ ] **Step 9: Run action-binding tests and verify GREEN**

Run:

```bash
pnpm exec vitest run tests/integration/api/subscribe.test.ts src/app/api/inquiry/__tests__/route.test.ts src/app/__tests__/actions.test.ts src/app/__tests__/contact-integration.test.ts
```

Expected: all selected action-binding tests pass.

## Task 4: Airtable formula neutralization

**Files:**
- Create: `src/lib/airtable/service-internal/field-sanitization.ts`
- Modify: `src/lib/airtable/service-internal/lead-records.ts`
- Test: `src/lib/__tests__/airtable-create-operations.test.ts`

- [ ] **Step 1: Write failing contact formula-neutralization test**

In `src/lib/__tests__/airtable-create-operations.test.ts`, add inside the create lead describe block:

```ts
it("neutralizes spreadsheet formula prefixes in contact lead text fields", async () => {
  const service = new AirtableServiceClass();
  setServiceReady(service);

  mockCreate.mockResolvedValue([
    createMockRecord({
      id: "recFormula",
      fields: {},
      createdTime: "2023-01-01T00:00:00Z",
    }),
  ]);

  await service.createLead("contact", {
    firstName: "=HYPERLINK(\"https://example.test\")",
    lastName: "+SUM(1,1)",
    email: "formula@example.com",
    company: "-Acme",
    subject: "@subject",
    message: " =cmd",
    referenceId: "CON-formula-123",
  });

  expect(mockCreate).toHaveBeenCalledWith([
    {
      fields: expect.objectContaining({
        "First Name": "'=HYPERLINK(\"https://example.test\")",
        "Last Name": "'+SUM(1,1)",
        Company: "'-Acme",
        Subject: "'@subject",
        Message: "' =cmd",
      }),
    },
  ]);
});
```

- [ ] **Step 2: Write failing product formula-neutralization test**

Add:

```ts
it("neutralizes spreadsheet formula prefixes in product lead text fields", async () => {
  const service = new AirtableServiceClass();
  setServiceReady(service);

  mockCreate.mockResolvedValue([
    createMockRecord({
      id: "recProductFormula",
      fields: {},
      createdTime: "2023-01-01T00:00:00Z",
    }),
  ]);

  await service.createLead("product", {
    firstName: "Buyer",
    lastName: "One",
    email: "buyer@example.com",
    company: "@Buyer Co",
    message: "=message",
    productName: "+Product",
    productSlug: "-product-slug",
    quantity: "@100",
    requirements: "=requirements",
    referenceId: "PROD-formula-123",
  });

  expect(mockCreate).toHaveBeenCalledWith([
    {
      fields: expect.objectContaining({
        Company: "'@Buyer Co",
        Message: "'=message",
        "Product Name": "'+Product",
        "Product Slug": "'-product-slug",
        Quantity: "'@100",
        Requirements: "'=requirements",
      }),
    },
  ]);
});
```

- [ ] **Step 3: Run Airtable tests and verify RED**

Run:

```bash
pnpm exec vitest run src/lib/__tests__/airtable-create-operations.test.ts
```

Expected: fail because formula prefixes are not neutralized.

- [ ] **Step 4: Create Airtable sink-local sanitizer**

Create `src/lib/airtable/service-internal/field-sanitization.ts`:

```ts
import { sanitizePlainText } from "@/lib/security-validation";

const FORMULA_PREFIX_PATTERN = /^[=+\-@]/;

export function sanitizeAirtableTextField(value: string): string {
  const plain = sanitizePlainText(value);
  const trimmedStart = plain.trimStart();
  if (FORMULA_PREFIX_PATTERN.test(trimmedStart)) {
    return `'${plain}`;
  }
  return plain;
}
```

- [ ] **Step 5: Apply sanitizer in lead-record fields**

In `src/lib/airtable/service-internal/lead-records.ts`, replace:

```ts
import { sanitizePlainText } from "@/lib/security-validation";
```

with:

```ts
import { sanitizeAirtableTextField } from "@/lib/airtable/service-internal/field-sanitization";
```

Update contact fields:

```ts
fields["First Name"] = sanitizeAirtableTextField(data.firstName);
fields["Last Name"] = sanitizeAirtableTextField(data.lastName);
fields["Company"] = data.company ? sanitizeAirtableTextField(data.company) : "";
fields["Subject"] = data.subject
  ? sanitizeAirtableTextField(data.subject)
  : "";
fields["Message"] = sanitizeAirtableTextField(data.message);
```

Update product fields:

```ts
fields["First Name"] = sanitizeAirtableTextField(data.firstName);
fields["Last Name"] = sanitizeAirtableTextField(data.lastName);
fields["Company"] = data.company ? sanitizeAirtableTextField(data.company) : "";
fields["Message"] = sanitizeAirtableTextField(data.message);
fields["Product Name"] = sanitizeAirtableTextField(data.productName);
fields["Product Slug"] = sanitizeAirtableTextField(data.productSlug);
fields["Quantity"] =
  typeof data.quantity === "number"
    ? data.quantity.toString()
    : sanitizeAirtableTextField(data.quantity);
if (data.requirements) {
  fields["Requirements"] = sanitizeAirtableTextField(data.requirements);
}
```

- [ ] **Step 6: Run Airtable tests and verify GREEN**

Run:

```bash
pnpm exec vitest run src/lib/__tests__/airtable-create-operations.test.ts
```

Expected: all Airtable create operation tests pass.

## Task 5: Cloudflare client-IP proof and stop line

**Files:**
- Modify: `src/lib/security/__tests__/client-ip.test.ts`
- Modify: `src/lib/security/client-ip.ts` only if a dependable runtime signal is proven from current request headers or repo runtime behavior.

- [ ] **Step 1: Add explicit current fallback proof test**

In `src/lib/security/__tests__/client-ip.test.ts`, add a test under the Cloudflare-related `getClientIP` describe block:

```ts
it("falls back when Cloudflare platform has cf-connecting-ip but no trusted source proof", () => {
  vi.stubEnv("DEPLOYMENT_PLATFORM", "cloudflare");
  const request = new NextRequest("https://example.test/api/inquiry", {
    headers: {
      "cf-connecting-ip": "198.51.100.77",
    },
  });

  expect(getClientIP(request)).toBe("0.0.0.0");
});
```

- [ ] **Step 2: Run client-IP tests and verify current proof**

Run:

```bash
pnpm exec vitest run src/lib/security/__tests__/client-ip.test.ts
```

Expected: pass. This documents the current secure fallback behavior.

- [ ] **Step 3: Check for dependable Cloudflare runtime signal**

Search served/runtime code and tests:

```bash
rg -n "cf-ray|cf-visitor|cf-ipcountry|cdn-loop|cf-ew-via|cf-worker" src tests
```

Expected: if no dependable runtime signal is already represented in repo behavior, do not change `client-ip.ts` in this task.

- [ ] **Step 4: If no dependable signal exists, record stop-line comment in test**

Add this comment above the fallback proof test:

```ts
// Stop line: cf-connecting-ip alone is not trusted when request.ip is missing.
// A future Cloudflare/OpenNext runtime proof may add a narrower trusted signal.
```

- [ ] **Step 5: If a dependable signal exists, write RED test before implementation**

Only if Step 3 finds a trustworthy existing signal, add a test like:

```ts
it("uses cf-connecting-ip when Cloudflare runtime evidence is present without request.ip", () => {
  vi.stubEnv("DEPLOYMENT_PLATFORM", "cloudflare");
  const request = new NextRequest("https://example.test/api/inquiry", {
    headers: {
      "cf-connecting-ip": "198.51.100.77",
      "cf-ray": "abc123-LAX",
      "cf-visitor": "{\"scheme\":\"https\"}",
    },
  });

  expect(getClientIP(request)).toBe("198.51.100.77");
});
```

Run:

```bash
pnpm exec vitest run src/lib/security/__tests__/client-ip.test.ts
```

Expected: fail before code change.

- [ ] **Step 6: If Step 5 was added, implement narrow runtime evidence**

Only if Step 5 exists, update `src/lib/security/client-ip.ts` with a helper that checks the exact proven signal. Do not trust `cf-connecting-ip` alone.

Implementation must preserve these existing behaviors:

- trusted Cloudflare edge source IP still allows `cf-connecting-ip`
- Vercel behavior unchanged
- development behavior unchanged
- missing signal still returns `0.0.0.0`

- [ ] **Step 7: Run client-IP tests and verify GREEN**

Run:

```bash
pnpm exec vitest run src/lib/security/__tests__/client-ip.test.ts
```

Expected: all client-IP tests pass.

## Task 6: Behavioral contract doc update

**Files:**
- Modify: `docs/specs/behavioral-contracts.md`

- [ ] **Step 1: Add lead-safety note under Inquiry & Conversion**

Add a new contract after BC-012:

```md
#### BC-012A: Lead submission retries and anti-abuse checks remain stable

Lead submission surfaces must preserve stable behavior for duplicate submissions, Turnstile action checks, downstream timeout ambiguity, and Airtable sink handling.

| Field | Value |
|-------|-------|
| Priority | High |
| Test Type | Unit + Integration |
| Test File | `src/lib/__tests__/idempotency.contracts.test.ts`, `src/lib/lead-pipeline/__tests__/with-timeout.test.ts`, `src/lib/__tests__/airtable-create-operations.test.ts`, `src/lib/security/__tests__/client-ip.test.ts`, `tests/integration/api/subscribe.test.ts`, `src/app/api/inquiry/__tests__/route.test.ts`, `src/app/__tests__/actions.test.ts`, `src/app/__tests__/contact-integration.test.ts` |
| Status | Covered |

Notes: Timeout tests prove timeout is distinguishable from normal service rejection; they do not claim downstream Airtable or Resend requests are canceled. Cloudflare client-IP tests preserve the stop line that raw `cf-connecting-ip` alone is not enough when the trusted source cannot be proven.
```

- [ ] **Step 2: Run markdown formatting check through normal formatter**

Run:

```bash
pnpm exec prettier --check docs/specs/behavioral-contracts.md
```

Expected: pass, or run the repo formatter for that file if needed.

## Task 7: Focused verification

**Files:**
- Existing tests only.

- [ ] **Step 1: Run focused test suite**

Run:

```bash
pnpm exec vitest run \
  src/lib/lead-pipeline/__tests__/with-timeout.test.ts \
  src/lib/__tests__/idempotency.contracts.test.ts \
  src/lib/__tests__/airtable-create-operations.test.ts \
  src/lib/security/__tests__/client-ip.test.ts \
  tests/integration/api/subscribe.test.ts \
  src/app/api/inquiry/__tests__/route.test.ts \
  src/app/__tests__/actions.test.ts \
  src/app/__tests__/contact-integration.test.ts
```

Expected: all selected tests pass.

- [ ] **Step 2: Run type check**

Run:

```bash
pnpm type-check
```

Expected: exit 0.

- [ ] **Step 3: Run lint check**

Run:

```bash
pnpm lint:check
```

Expected: exit 0.

- [ ] **Step 4: Run Cloudflare build checks only if client-IP implementation changed beyond tests**

If `src/lib/security/client-ip.ts` changed, run:

```bash
pnpm build
pnpm build:cf
```

Expected: both exit 0. Run sequentially only; do not run them in parallel.

- [ ] **Step 5: Inspect final diff**

Run:

```bash
git diff --stat
git diff --check
```

Expected: no whitespace errors; changed files match this plan.
