#!/bin/bash
set -euo pipefail

if [[ "${VALIDATE_CONFIG_SKIP_RUNTIME:-}" == "true" || "${VALIDATE_CONFIG_SKIP_RUNTIME:-}" == "1" ]]; then
  echo "release-proof must not run with VALIDATE_CONFIG_SKIP_RUNTIME enabled" >&2
  exit 1
fi

if [[ "${ALLOW_MEMORY_RATE_LIMIT:-}" == "true" || "${ALLOW_MEMORY_RATE_LIMIT:-}" == "1" ]]; then
  echo "release-proof must not run with ALLOW_MEMORY_RATE_LIMIT enabled" >&2
  exit 1
fi

if [[ "${ALLOW_MEMORY_IDEMPOTENCY:-}" == "true" || "${ALLOW_MEMORY_IDEMPOTENCY:-}" == "1" ]]; then
  echo "release-proof must not run with ALLOW_MEMORY_IDEMPOTENCY enabled" >&2
  exit 1
fi

echo "== Release verification flow =="
pnpm review:docs-truth
pnpm review:cf:official-compare:source
pnpm review:derivative-readiness
pnpm type-check
pnpm lint:check
pnpm review:tier-a
pnpm review:clusters
pnpm test:locale-runtime
pnpm test:lead-family
pnpm review:health
pnpm validate:translations
pnpm clean:next-artifacts
pnpm build
pnpm build:site:equipment
pnpm build:cf
pnpm deploy:cf:phase6:dry-run
pnpm review:cf:official-compare:generated
pnpm test:release-smoke

echo "Cloudflare proof split:"
echo "  - Local stock preview: pnpm smoke:cf:preview"
echo "  - Strict local stock preview (includes /api/health): pnpm smoke:cf:preview:strict"
echo "  - Stronger local split-worker proof: pnpm deploy:cf:phase6:dry-run"
echo "  - Real preview publish path: pnpm deploy:cf:phase6:preview"
echo "  - Deployed GET smoke: pnpm smoke:cf:deploy -- --base-url \"$DEPLOYED_BASE_URL\""
echo "  - Real deployed lead canary manual launch gate: POST_DEPLOY_TEST=1 PLAYWRIGHT_BASE_URL=\"$DEPLOYED_BASE_URL\" pnpm test:e2e:post-deploy"
echo "  - The lead canary requires deployed Airtable/Resend/Turnstile credentials and must be recorded before broad public launch."
echo "Release verification completed successfully."
