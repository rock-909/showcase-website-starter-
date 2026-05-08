---
paths:
  - "src/app/api/**/*"
  - "src/app/actions.ts"
  - "src/app/**/actions.ts"
  - "src/lib/security/**/*"
  - "src/lib/api/**"
  - "src/lib/actions/**"
  - "src/lib/lead-pipeline/lead-schema.ts"
  - "src/lib/security-validation.ts"
  - "src/config/security.ts"
  - "next.config.ts"
---

# Security Rules

Use this file when changing API routes, public write endpoints, Server Actions,
validation, rate limits, CSP, sensitive server code, or env exposure.

For Cloudflare build/runtime topology, use `cloudflare.md`.

## Public write endpoints

Browser-exposed write endpoints need:

- body size gate;
- Zod validation;
- Turnstile or equivalent browser anti-abuse check;
- small route-local or shared rate limit when currently wired;
- stable machine-readable error codes.

Do not add body hashing, distributed rate limiting, or duplicate-submission
replay as starter defaults. Add them later only when a real incident justifies
the extra complexity.

## Lead-family behavior

Target behavior for contact, inquiry, and subscribe:

```text
browser form -> route handler -> Zod -> Turnstile -> process lead -> Airtable first -> optional email
```

- Airtable record creation is the business success condition.
- Email failure after record creation returns user success and logs internally.
- Airtable failure returns failure and must not send email.
- User-facing `partialSuccess` is not part of the target contract.

Until Phase 2/3 finishes, existing routes may still carry old wrappers. Do not
copy those wrappers into new code.

## Server-only code

- Add `import "server-only"` to sensitive server modules.
- Route handlers and Server Actions must validate and authorize internally.
- Middleware/proxy filtering is optional front-line protection, not the only
  authorization layer.

## Endpoint notes

| Endpoint | Expected protection |
| --- | --- |
| `/api/inquiry` | Turnstile + validation + body size gate + rate limit while wired |
| `/api/subscribe` | Turnstile + validation + body size gate + rate limit while wired |
| `/api/contact` | same public route model as inquiry/subscribe |
| `/api/csp-report` | body size gate + rate limit; never trust payload content |
| `/api/verify-turnstile` | body size gate; no secrets in response |
| `/api/health` | public health only; no credentials, config dumps, or env details |

## CSP and headers

- Security header behavior lives in `src/config/security.ts` and Next.js
  native `headers()` in `next.config.ts`.
- Middleware owns locale redirects, locale cookies, and leaked middleware
  cookie cleanup. It does not own CSP or generic security headers.
- CSP is static by starter default. Do not add dynamic nonce handling unless a
  dedicated dynamic-rendering proof plan justifies the trade-off.
- CSP reports go to `/api/csp-report`.
- Do not use unfiltered `dangerouslySetInnerHTML`.
- URL values must allow only `https://`, `http://`, or site-relative `/`.

## Env boundaries

- App/runtime code reads server values through `@/lib/env`.
- Browser code reads only `NEXT_PUBLIC_*` helpers exported from `@/lib/env`.
- Do not expose server secrets through `NEXT_PUBLIC_*`.
- Sensitive keys include `AIRTABLE_API_KEY`, `RESEND_API_KEY`,
  `TURNSTILE_SECRET_KEY`, `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`,
  Cloudflare API tokens, and owner dashboard access keys.

For future auth/session cookies, default to `httpOnly`, `secure`, and
`sameSite: "strict"` unless a specific flow proves otherwise.
