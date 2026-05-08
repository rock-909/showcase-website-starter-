# Derivative Project Replacement Checklist

## Replacement order (do not reorder)

### Step 1: Brand Identity — `single-site.ts`

Company name, address, contact, established year, employee count, certifications,
export countries, social media links, SEO defaults.

### Step 2: Product Catalog — `single-site-product-catalog.ts`

Markets, families, product structure.

### Step 3: Page Assembly — `src/config/single-site-page-expression.ts`

Page switches (show FAQ, show stats), CTA targets, section ordering.

### Step 4: Page Content — `content/pages/**`

All page narrative, FAQ Q&A, hero copy, legal text. One MDX file per page per locale.

### Step 5: Crawl Strategy — `src/config/single-site-seo.ts`

Sitemap priorities, change frequencies, robots rules.

### Step 6: Brand Assets — `public/images/**`

OG images, certificates, product photos, hero images.

### Step 7: Review UI Chrome — `messages/{locale}/`

Usually no change needed. Adjust only for UI voice/tone.

### Step 8: Run Verification Chain

```bash
pnpm brand:check
pnpm content:check
node scripts/starter-checks.js content-readiness
node scripts/starter-checks.js client-boundary
pnpm type-check
pnpm lint:check
pnpm test
pnpm build
pnpm website:build:cf
node scripts/starter-checks.js truth-docs
node scripts/starter-checks.js translations
```

Steps 1-6 are replacement. Step 7 is review. Step 8 is proof. Do not skip or reorder.

## Do not replace first

- Legal/About shell runtime mechanics
- i18n loader semantics
- Cloudflare proof model
- Security/abuse-protection chain
- Shared UI components

## Minimum proof after replacement

- `node scripts/starter-checks.js truth-docs`
- `node scripts/starter-checks.js translations`
- `pnpm type-check`
- `pnpm lint:check`
- `pnpm exec vitest run`
- `pnpm build`
- `pnpm website:build:cf`
