# Public Demo Starter Site Design

Date: 2026-05-04
Branch: docs/public-demo-starter-site-spec
Status: Design ready for owner review

## Outcome

Turn this repository from a reusable starter into a public demo starter site.

The public site should look like a polished finished website, but it must still be honest about being a starter. A visitor should understand the value immediately. A future project owner should also understand what must be replaced before using it for a real business.

Working positioning:

> From no website to a basic online lead system for a small B2B company.

This is not a pure website template and not a full CRM. It is a starter that demonstrates:

- a credible company website,
- a clear service/product story,
- a working inquiry path,
- Cloudflare-first deployment,
- a real owner traffic dashboard,
- and a strict replacement checklist before client launch.

## Confirmed decisions

- Public demo style: hybrid. The main pages feel like a finished website; the explanation layer says this is a starter demo.
- Target audience: small B2B company owner or operations lead.
- Core pain: they may not have a proper website at all.
- Core promise: help them move from no credible web presence to basic online lead capture.
- Product shape: website plus lead system starter.
- Official deployment path: Cloudflare.
- Vercel status: optional compatibility only, not the default promise.
- Traffic dashboard: real Cloudflare data, not a mock.

## Current project state

The current repository already has a strong starter foundation:

- localized App Router pages,
- inquiry and subscribe routes,
- Cloudflare/OpenNext build scripts,
- replacement docs under `docs/website/`,
- quality proof docs,
- component governance,
- brand/content checks,
- and release-facing validation commands.

The previous AI-smell remediation stage intentionally kept the repository as a reusable starter. This spec starts the next phase: make the starter publicly understandable as a demo website.

## Audience and story

The demo should speak to this buyer:

> A small B2B business owner or operations lead who knows they need a website, but does not yet have a clear online presence, stable contact entry point, or simple way to see whether anyone is visiting.

The homepage should not sound like developer tooling. It should tell a business story:

1. You do not have to start from a blank page.
2. You can launch with a credible site structure.
3. Visitors can understand what you offer and contact you.
4. The owner can see basic traffic after deployment.
5. The starter makes replacement work explicit before launch.

Avoid framing the demo as:

- a generic SaaS dashboard,
- a full CRM,
- a design portfolio,
- or a technical Cloudflare tutorial.

## Public information architecture

Phase 1 should keep the public site simple:

- Home: main business story and starter promise.
- Capabilities: what the starter includes.
- How it works: from setup to launch proof.
- Contact / get started: demo inquiry path.
- About / trust: starter identity, replacement warning, and project boundary.
- Legal pages: privacy and terms written as demo placeholders that must be replaced.
- Owner dashboard: `/ops/traffic`, protected and disabled unless configured.

The home page is the main sales page. The starter explanation should appear as a visible layer, not hidden in docs. Recommended pattern:

- a small top notice or section saying this is a demo starter,
- links to replacement checklist and quality proof docs,
- plain wording that sample company/product/contact details must be replaced before real launch.

## Content model

The public demo can use a fictional B2B service company, but it must not pretend to be a real operating company.

Content should be written in two layers:

1. Demo layer: polished website copy that shows what a launched site can look like.
2. Starter layer: clear notes that explain what future owners must replace.

Required replacement truths:

- brand identity,
- domain,
- contact email and phone,
- services/products,
- images,
- proof assets,
- legal body,
- form destination,
- analytics credentials,
- Cloudflare account and zone,
- and deployment environment values.

The existing `docs/website/新项目替换清单.md` remains the detailed replacement checklist. Phase 1 may update it, but the public pages should not rely on docs alone to explain the starter boundary.

## Cloudflare-first deployment strategy

Cloudflare is the official recommended deployment path for this starter.

The public story should say:

- recommended deployment: Cloudflare Workers via OpenNext,
- included proof path: build, Cloudflare build, preview smoke, deployed proof where credentials exist,
- analytics source: Cloudflare zone analytics,
- Vercel: optional compatibility, not the default promise.

The repository already contains Vercel traces. Phase 1 should not delete them unless a later implementation plan scopes CI/deployment simplification. The visible public story should still make Cloudflare the default route.

### Dependency alignment before implementation

Before changing runtime-facing Cloudflare features, run a small dependency alignment step:

- current local `@opennextjs/cloudflare`: `1.19.4`,
- current latest checked on 2026-05-04: `1.19.6`,
- current local `wrangler`: `4.86.0`,
- current latest checked on 2026-05-04: `4.87.0`.

Recommended implementation sequence:

1. Upgrade `@opennextjs/cloudflare` to `1.19.6`.
2. Evaluate whether `wrangler` should move to `4.87.0` in the same change.
3. Keep the existing Cloudflare topology rules unless fresh proof justifies changing them.
4. Verify with the Cloudflare validation chain described below.

This upgrade is not a product-planning blocker. It is a technical calibration step before implementation.

## Real traffic dashboard

Phase 1 should implement a real owner-only traffic dashboard using Cloudflare analytics.

Recommended architecture:

```text
Cloudflare traffic
  -> Cloudflare Analytics
  -> server-only analytics client
  -> protected /ops/traffic page
  -> owner-readable dashboard
```

Use Cloudflare GraphQL Analytics API for zone-level traffic data.

Optional addition:

- Cloudflare Web Analytics beacon can be added for browser-side real-user metrics if it does not weaken the no-secrets-in-browser rule.

Future-only:

- Workers Analytics Engine for custom business events such as inquiry funnel events.

Do not build a full CRM or BI product in Phase 1.

### Dashboard access and secrets

The dashboard must be protected.

Recommended access model:

- outer layer: Cloudflare Access protecting `/ops/*`,
- inner layer: app-level access key or equivalent server-side gate,
- default state: dashboard disabled when required credentials are missing.

Required environment variables:

- `CLOUDFLARE_ZONE_ID`
- `CLOUDFLARE_ANALYTICS_API_TOKEN`
- `CLOUDFLARE_ANALYTICS_HOSTNAME`
- `OPS_DASHBOARD_ACCESS_KEY`

Optional environment variables:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_WEB_ANALYTICS_SITE_TOKEN`

Rules:

- The Cloudflare API token must never be exposed through `NEXT_PUBLIC_*`.
- The token must not appear in client JavaScript, rendered HTML, logs, screenshots, or docs.
- Missing credentials should show a safe configured/unconfigured state, not a crash.
- Dashboard data should be cached for about five minutes to avoid unnecessary API usage.

### Dashboard first-version metrics

The first useful dashboard should show:

- visits,
- requests,
- bandwidth,
- error rate,
- 24-hour and 7-day trend,
- top pages,
- top countries or regions,
- status code distribution,
- last updated time,
- hostname,
- and a note that the source is Cloudflare analytics.

The dashboard should be written for a business owner, not a developer. Example tone:

- "Visitors in the last 7 days"
- "Most viewed pages"
- "Errors that need attention"
- "Last updated"

## Security and privacy boundaries

The starter must keep a strict line between demo content and real customer data.

Security requirements:

- analytics API calls run server-side only,
- owner dashboard is not indexed,
- owner dashboard is protected before showing data,
- secrets stay outside public env vars,
- no sample secret values in committed files,
- public demo contact forms must be clearly configured before real launch,
- logs must avoid personal data and secret values.

Privacy requirements:

- public pages must not claim real analytics, real customers, or real case studies unless they are actually replaced,
- legal pages remain demo placeholders until a real business owner replaces them,
- Cloudflare Web Analytics use must be documented if enabled.

## Behavior acceptance criteria

Phase 1 implementation should satisfy these plain-language behaviors:

### Public demo identity

Given a visitor opens the site,
When they read the home page,
Then they understand this is a polished demo of a starter for small B2B businesses that do not yet have a credible website.

Given a future project owner reviews the public demo,
When they see sample brand, service, contact, legal, or proof content,
Then the site makes clear those details must be replaced before a real launch.

### Cloudflare-first deployment

Given someone follows the deployment story,
When they look for the recommended route,
Then Cloudflare is presented as the official path.

Given someone looks for Vercel,
When they find Vercel support,
Then it is framed as optional compatibility, not equal default support.

### Traffic dashboard

Given Cloudflare analytics credentials are not configured,
When an owner opens `/ops/traffic`,
Then the page shows a safe "not configured" state and no secret details.

Given valid credentials and access are configured,
When an authorized owner opens `/ops/traffic`,
Then the page shows real Cloudflare traffic data for the configured hostname.

Given an unauthorized visitor tries to open `/ops/traffic`,
When they do not pass the access gate,
Then no traffic data is shown.

### Launch truth

Given all local tests pass,
When the site has not yet had deployed proof and owner content signoff,
Then docs and UI must not call it fully launch-ready.

## Implementation units

The later implementation plan should split the work into independent units:

1. Cloudflare dependency alignment and proof.
2. Public positioning copy and information architecture.
3. Starter/demo boundary notices and replacement checklist updates.
4. Cloudflare analytics client and safe server contract.
5. Owner-only `/ops/traffic` page.
6. Tests and proof updates.
7. Documentation updates for deployment, analytics setup, and launch truth.

## Validation strategy

Use the smallest proof that matches the change, but public-demo work is release-facing and should end with a broad check.

Required checks for Phase 1 completion:

- brand/content checks for public copy changes,
- i18n checks for user-facing text,
- type check,
- lint check,
- unit/integration tests for analytics client and access behavior,
- Next build,
- Cloudflare build,
- Cloudflare official-compare guardrail if OpenNext or Wrangler topology is touched,
- local or deployed Cloudflare smoke where credentials and environment allow it.

The project rule still applies: `pnpm build` and `pnpm build:cf` must not run in parallel because both write to `.next`.

## Out of scope for Phase 1

Phase 1 does not include:

- a full CRM,
- login/account system beyond the protected owner page,
- custom business-event analytics,
- multi-tenant dashboard,
- billing,
- real customer case studies,
- real legal advice,
- deleting Vercel workflow/config traces,
- reintroducing runtime cache invalidation,
- or changing Cloudflare split-worker topology without separate proof.

## Open decisions for later

These are intentionally deferred until after this design is accepted:

- final demo brand name,
- exact homepage section order,
- exact dashboard visual layout,
- whether Cloudflare Web Analytics beacon is enabled in Phase 1 or documented as optional,
- whether Wrangler moves together with OpenNext in the first dependency alignment change.

These are implementation-plan decisions, not blockers for this spec.
