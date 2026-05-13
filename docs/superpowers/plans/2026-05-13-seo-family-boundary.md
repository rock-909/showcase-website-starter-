# SEO Family Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move SEO implementation into `src/lib/seo/` while keeping top-level compatibility facades and preserving metadata, sitemap, and JSON-LD behavior.

**Architecture:** `src/lib/seo/*` becomes the implementation home. Existing top-level `src/lib/seo-metadata.ts`, `src/lib/sitemap-utils.ts`, `src/lib/page-structured-data.ts`, and `src/lib/structured-data*` files become named-export facades. Internal production imports move to `@/lib/seo/*`; tests keep proving old facade compatibility.

**Tech Stack:** Next.js App Router Metadata API, TypeScript strict mode, Vitest, React Server Components, next-intl structured-data translations.

---

### Task 1: Add SEO boundary architecture test

**Files:**
- Create: `tests/architecture/seo-family-boundary.test.ts`

- [ ] **Step 1: Write the failing architecture test**

Create `tests/architecture/seo-family-boundary.test.ts`:

```ts
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
} from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = process.cwd();

const SEO_IMPLEMENTATION_FILES = [
  "src/lib/seo/metadata.ts",
  "src/lib/seo/sitemap-utils.ts",
  "src/lib/seo/page-structured-data.ts",
  "src/lib/seo/structured-data.ts",
  "src/lib/seo/structured-data-generators.ts",
  "src/lib/seo/structured-data-helpers.ts",
  "src/lib/seo/structured-data-types.ts",
] as const;

const SEO_FACADES = {
  "src/lib/seo-metadata.ts": [
    "@/lib/seo/metadata",
    "createPageSEOConfig",
    "generateLocalizedMetadata",
    "generateMetadataForPath",
  ],
  "src/lib/sitemap-utils.ts": [
    "@/lib/seo/sitemap-utils",
    "getContentLastModified",
    "getProductLastModified",
    "getStaticPageLastModified",
  ],
  "src/lib/page-structured-data.ts": [
    "@/lib/seo/page-structured-data",
    "generatePageStructuredData",
    "PageStructuredData",
  ],
  "src/lib/structured-data.ts": [
    "@/lib/seo/structured-data",
    "generateJSONLD",
    "generateStructuredData",
    "Locale",
  ],
  "src/lib/structured-data-generators.ts": [
    "@/lib/seo/structured-data-generators",
    "buildSchemaFallback",
    "generateOrganizationData",
    "generateWebSiteData",
  ],
  "src/lib/structured-data-helpers.ts": [
    "@/lib/seo/structured-data-helpers",
    "generateLocalizedStructuredData",
    "generateProductSchema",
  ],
  "src/lib/structured-data-types.ts": [
    "@/lib/seo/structured-data-types",
    "StructuredDataType",
    "Locale",
  ],
} as const;

const INTERNAL_SCAN_ROOTS = ["src/app", "src/components", "src/lib"] as const;
const FORBIDDEN_INTERNAL_IMPORTS = Object.keys(SEO_FACADES).map((file) => {
  const basename = file.replace("src/lib/", "").replace(/\.ts$/u, "");
  return `@/lib/${basename}`;
});

function readSource(relativePath: string): string {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- architecture test reads repo-local files from fixed allowlists
  return readFileSync(join(REPO_ROOT, relativePath), "utf8");
}

function collectSourceFiles(root: string): string[] {
  const absoluteRoot = join(REPO_ROOT, root);
  const result: string[] = [];
  const stack = [absoluteRoot];

  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined) continue;

    // eslint-disable-next-line security/detect-non-literal-fs-filename -- architecture test recursively scans fixed repo-local source roots only
    for (const entry of readdirSync(current)) {
      const absolutePath = join(current, entry);
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- architecture test checks fixed repo-local source paths only
      const stats = statSync(absolutePath);

      if (stats.isDirectory()) {
        if (entry === "__tests__" || entry === "stories") continue;
        stack.push(absolutePath);
        continue;
      }

      if (!/\.(ts|tsx)$/u.test(entry)) continue;
      if (entry.endsWith(".test.ts") || entry.endsWith(".test.tsx")) continue;
      if (entry.endsWith(".stories.tsx")) continue;

      result.push(relative(REPO_ROOT, absolutePath));
    }
  }

  return result.sort();
}
```

Add the assertions:

```ts
describe("SEO family boundary", () => {
  it("keeps SEO implementation files under src/lib/seo", () => {
    for (const file of SEO_IMPLEMENTATION_FILES) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- architecture test checks fixed repo-local implementation paths
      expect(existsSync(join(REPO_ROOT, file)), file).toBe(true);
    }
  });

  it("keeps old top-level SEO files as named-export facades", () => {
    for (const [facade, [target, ...expectedNames]] of Object.entries(
      SEO_FACADES,
    )) {
      const source = readSource(facade).trim();

      expect(source).toContain(`from "${target}"`);
      expect(source).not.toContain("export *");

      for (const expectedName of expectedNames) {
        expect(source).toContain(expectedName);
      }
    }
  });

  it("keeps internal production imports on src/lib/seo paths", () => {
    const offenders: string[] = [];

    for (const root of INTERNAL_SCAN_ROOTS) {
      for (const file of collectSourceFiles(root)) {
        if (Object.keys(SEO_FACADES).includes(file)) continue;

        const source = readSource(file);

        for (const forbidden of FORBIDDEN_INTERNAL_IMPORTS) {
          if (
            source.includes(`from "${forbidden}"`) ||
            source.includes(`from '${forbidden}'`) ||
            source.includes(`require("${forbidden}")`) ||
            source.includes(`require('${forbidden}')`)
          ) {
            offenders.push(`${file} imports ${forbidden}`);
          }
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm exec vitest run tests/architecture/seo-family-boundary.test.ts
```

Expected: FAIL because `src/lib/seo/metadata.ts` and the other moved implementation files do not exist yet.

- [ ] **Step 3: Fix test helper import block if needed**

If TypeScript complains about duplicate `node:fs` imports, keep one import line:

```ts
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
} from "node:fs";
```

Expected: the test still fails for the intended missing-file/facade reason, not because the test itself is malformed.

### Task 2: Move SEO implementation files into src/lib/seo

**Files:**
- Move: `src/lib/seo-metadata.ts` -> `src/lib/seo/metadata.ts`
- Move: `src/lib/sitemap-utils.ts` -> `src/lib/seo/sitemap-utils.ts`
- Move: `src/lib/page-structured-data.ts` -> `src/lib/seo/page-structured-data.ts`
- Move: `src/lib/structured-data.ts` -> `src/lib/seo/structured-data.ts`
- Move: `src/lib/structured-data-generators.ts` -> `src/lib/seo/structured-data-generators.ts`
- Move: `src/lib/structured-data-helpers.ts` -> `src/lib/seo/structured-data-helpers.ts`
- Move: `src/lib/structured-data-types.ts` -> `src/lib/seo/structured-data-types.ts`
- Modify imports inside moved files.

- [ ] **Step 1: Move files**

Use `git mv`:

```bash
git mv src/lib/seo-metadata.ts src/lib/seo/metadata.ts
git mv src/lib/sitemap-utils.ts src/lib/seo/sitemap-utils.ts
git mv src/lib/page-structured-data.ts src/lib/seo/page-structured-data.ts
git mv src/lib/structured-data.ts src/lib/seo/structured-data.ts
git mv src/lib/structured-data-generators.ts src/lib/seo/structured-data-generators.ts
git mv src/lib/structured-data-helpers.ts src/lib/seo/structured-data-helpers.ts
git mv src/lib/structured-data-types.ts src/lib/seo/structured-data-types.ts
```

- [ ] **Step 2: Update imports inside moved SEO files**

Edit the moved files so all internal structured-data imports point to `@/lib/seo/*`:

```ts
// src/lib/seo/metadata.ts
import {
  generateCanonicalURL,
  generateLanguageAlternates,
} from "@/lib/seo/url-generator";
```

```ts
// src/lib/seo/page-structured-data.ts
import {
  generateOrganizationData,
  generateWebSiteData,
} from "@/lib/seo/structured-data-generators";
import type { Locale } from "@/lib/seo/structured-data";
```

```ts
// src/lib/seo/structured-data.ts
import {
  generateOrganizationData,
  generateWebSiteData,
} from "@/lib/seo/structured-data-generators";
import {
  generateLocalizedStructuredData,
  generateProductSchema,
} from "@/lib/seo/structured-data-helpers";
import type { Locale } from "@/lib/seo/structured-data-types";

export type { Locale } from "@/lib/seo/structured-data-types";

export {
  createArticleStructuredData,
  createBreadcrumbStructuredData,
  generateLocalBusinessSchema,
  generateProductSchema,
} from "@/lib/seo/structured-data-helpers";
```

```ts
// src/lib/seo/structured-data-helpers.ts
import {
  buildLocalBusinessSchema,
  buildSchemaFallback,
  generateArticleData,
  generateBreadcrumbData,
  generateOrganizationData,
  generateProductData,
  generateWebSiteData,
} from "@/lib/seo/structured-data-generators";
import type {
  ArticleData,
  BreadcrumbData,
  Locale,
  OrganizationData,
  ProductData,
  WebSiteData,
} from "@/lib/seo/structured-data-types";
```

```ts
// src/lib/seo/structured-data-generators.ts
import type {
  ArticleData,
  BreadcrumbData,
  Locale,
  OrganizationData,
  ProductData,
  WebSiteData,
} from "@/lib/seo/structured-data-types";
```

- [ ] **Step 3: Run focused type/test check**

Run:

```bash
pnpm exec vitest run tests/architecture/seo-family-boundary.test.ts
```

Expected: still FAIL because old top-level facade files do not exist yet.

### Task 3: Add compatibility facades and move tests to SEO family

**Files:**
- Create facades:
  - `src/lib/seo-metadata.ts`
  - `src/lib/sitemap-utils.ts`
  - `src/lib/page-structured-data.ts`
  - `src/lib/structured-data.ts`
  - `src/lib/structured-data-generators.ts`
  - `src/lib/structured-data-helpers.ts`
  - `src/lib/structured-data-types.ts`
- Move tests:
  - `src/lib/__tests__/seo-metadata.test.ts` -> `src/lib/seo/__tests__/metadata.test.ts`
  - `src/lib/__tests__/sitemap-utils.test.ts` -> `src/lib/seo/__tests__/sitemap-utils.test.ts`
  - `src/lib/__tests__/structured-data.test.ts` -> `src/lib/seo/__tests__/structured-data.test.ts`

- [ ] **Step 1: Create thin named-export facade files**

Use `apply_patch` to create these exact file contents:

```ts
// src/lib/seo-metadata.ts
export {
  createPageSEOConfig,
  generateLocalizedMetadata,
  generateMetadataForPath,
} from "@/lib/seo/metadata";
export type { Locale, PageType } from "@/lib/seo/metadata";
```

```ts
// src/lib/sitemap-utils.ts
export {
  getContentLastModified,
  getProductLastModified,
  getStaticPageLastModified,
} from "@/lib/seo/sitemap-utils";
export type {
  ContentTimestamps,
  StaticPageLastModConfig,
} from "@/lib/seo/sitemap-utils";
```

```ts
// src/lib/page-structured-data.ts
export { generatePageStructuredData } from "@/lib/seo/page-structured-data";
export type { PageStructuredData } from "@/lib/seo/page-structured-data";
```

```ts
// src/lib/structured-data.ts
export {
  createArticleStructuredData,
  createBreadcrumbStructuredData,
  generateJSONLD,
  generateLocalBusinessSchema,
  generateLocalizedStructuredData,
  generateProductSchema,
  generateStructuredData,
} from "@/lib/seo/structured-data";
export type { Locale } from "@/lib/seo/structured-data";
```

```ts
// src/lib/structured-data-generators.ts
export {
  buildAboutPageSchema,
  buildBreadcrumbListSchema,
  buildCustomProjectPageSchema,
  buildLegalPageSchema,
  buildLocalBusinessSchema,
  buildSchemaFallback,
  generateArticleData,
  generateBreadcrumbData,
  generateOrganizationData,
  generateProductData,
  generateProductGroupData,
  generateWebSiteData,
} from "@/lib/seo/structured-data-generators";
```

```ts
// src/lib/structured-data-helpers.ts
export {
  createArticleStructuredData,
  createBreadcrumbStructuredData,
  generateLocalBusinessSchema,
  generateLocalizedStructuredData,
  generateProductSchema,
} from "@/lib/seo/structured-data-helpers";
```

```ts
// src/lib/structured-data-types.ts
export type {
  ArticleData,
  BreadcrumbData,
  Locale,
  OrganizationData,
  ProductData,
  StructuredDataType,
  WebSiteData,
} from "@/lib/seo/structured-data-types";
```

- [ ] **Step 2: Move SEO unit tests**

Use `git mv`:

```bash
git mv src/lib/__tests__/seo-metadata.test.ts src/lib/seo/__tests__/metadata.test.ts
git mv src/lib/__tests__/sitemap-utils.test.ts src/lib/seo/__tests__/sitemap-utils.test.ts
git mv src/lib/__tests__/structured-data.test.ts src/lib/seo/__tests__/structured-data.test.ts
```

- [ ] **Step 3: Update relative imports in moved tests**

In `src/lib/seo/__tests__/metadata.test.ts`, replace:

```ts
} from "../seo-metadata";
```

with:

```ts
} from "../metadata";
```

In `src/lib/seo/__tests__/sitemap-utils.test.ts`, keep:

```ts
} from "../sitemap-utils";
```

In `src/lib/seo/__tests__/structured-data.test.ts`, keep:

```ts
} from "../structured-data";
import * as structuredDataPublicApi from "../structured-data";
```

- [ ] **Step 4: Run architecture test**

Run:

```bash
pnpm exec vitest run tests/architecture/seo-family-boundary.test.ts
```

Expected: FAIL until internal production imports are migrated from top-level paths to `@/lib/seo/*`.

### Task 4: Migrate internal production imports

**Files:**
- Modify imports in `src/app/**`, `src/components/**`, and moved `src/lib/seo/**`.

- [ ] **Step 1: Replace metadata imports**

Replace production imports:

```ts
from "@/lib/seo-metadata"
```

with:

```ts
from "@/lib/seo/metadata"
```

Expected touched files include:

- `src/app/[locale]/page.tsx`
- `src/app/[locale]/about/page.tsx`
- `src/app/[locale]/blog/page.tsx`
- `src/app/[locale]/blog/[slug]/page.tsx`
- `src/app/[locale]/capabilities/page.tsx`
- `src/app/[locale]/contact/page.tsx`
- `src/app/[locale]/custom-project-support/page.tsx`
- `src/app/[locale]/how-it-works/page.tsx`
- `src/app/[locale]/privacy/page.tsx`
- `src/app/[locale]/products/page.tsx`
- `src/app/[locale]/products/[market]/page.tsx`
- `src/app/[locale]/terms/page.tsx`

- [ ] **Step 2: Replace sitemap utility imports**

Replace production imports:

```ts
from "@/lib/sitemap-utils"
```

with:

```ts
from "@/lib/seo/sitemap-utils"
```

Expected touched file:

- `src/app/sitemap.ts`

- [ ] **Step 3: Replace structured-data imports**

Replace production imports:

```ts
from "@/lib/page-structured-data"
from "@/lib/structured-data"
from "@/lib/structured-data-generators"
```

with:

```ts
from "@/lib/seo/page-structured-data"
from "@/lib/seo/structured-data"
from "@/lib/seo/structured-data-generators"
```

Expected touched files include:

- `src/components/seo/json-ld-script.tsx`
- `src/components/content/about-page-shell.tsx`
- `src/components/content/legal-page-shell.tsx`
- `src/components/products/catalog-breadcrumb.tsx`
- `src/app/[locale]/custom-project-support/page.tsx`
- `src/app/[locale]/products/[market]/market-jsonld.ts`

- [ ] **Step 4: Run boundary test**

Run:

```bash
pnpm exec vitest run tests/architecture/seo-family-boundary.test.ts
```

Expected: PASS.

### Task 5: Update docs and structural references

**Files:**
- Modify: `docs/website/content-seo-contract.md`
- Modify: `docs/guides/STRUCTURAL-CHANGE-CLUSTERS.md`

- [ ] **Step 1: Update content SEO contract references**

In `docs/website/content-seo-contract.md`, replace the page JSON-LD row so it names the new implementation home:

```md
| Page JSON-LD | 页面级 SEO component 和 structured-data helper，例如 `src/components/seo/**`、`src/lib/seo/page-structured-data.ts`、`src/lib/seo/structured-data-generators.ts`。 |
```

- [ ] **Step 2: Update structural cluster reference**

In `docs/guides/STRUCTURAL-CHANGE-CLUSTERS.md`, replace:

```md
- `src/lib/seo-metadata.ts`
```

with:

```md
- `src/lib/seo/metadata.ts`
```

- [ ] **Step 3: Check for stale docs references**

Run:

```bash
rg -n "src/lib/(seo-metadata|sitemap-utils|page-structured-data|structured-data|structured-data-generators|structured-data-helpers|structured-data-types)" docs/website docs/guides tests/architecture
```

Expected: no references except intentional historical docs under `docs/superpowers/**`, which are outside this command.

### Task 6: Verify behavior and commit

**Files:**
- All moved implementation files, facades, tests, and docs from earlier tasks.

- [ ] **Step 1: Run focused SEO tests**

Run:

```bash
pnpm exec vitest run tests/architecture/seo-family-boundary.test.ts src/lib/seo/__tests__/metadata.test.ts src/lib/seo/__tests__/sitemap-utils.test.ts src/lib/seo/__tests__/structured-data.test.ts src/lib/seo/__tests__/url-generator.test.ts src/app/__tests__/sitemap.test.ts 'src/app/[locale]/__tests__/layout-structured-data.test.ts' src/components/seo/__tests__/json-ld-script.test.ts
```

Expected: all tests pass.

- [ ] **Step 2: Run type-check**

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

- [ ] **Step 4: Run build**

Run:

```bash
pnpm build
```

Expected: exit 0. Existing non-blocking warnings may still appear: deprecated `middleware` convention, missing local Resend API key, and `DYNAMIC_SERVER_USAGE` digest during static generation.

- [ ] **Step 5: Inspect diff**

Run:

```bash
git diff --check
git status --short --branch
git diff --stat
```

Expected: only SEO family files, architecture test, and docs touched.

- [ ] **Step 6: Commit**

Run:

```bash
git add src/lib/seo src/lib/seo-metadata.ts src/lib/sitemap-utils.ts src/lib/page-structured-data.ts src/lib/structured-data.ts src/lib/structured-data-generators.ts src/lib/structured-data-helpers.ts src/lib/structured-data-types.ts src/app src/components tests/architecture/seo-family-boundary.test.ts docs/website/content-seo-contract.md docs/guides/STRUCTURAL-CHANGE-CLUSTERS.md
git commit -m "refactor: group seo runtime helpers"
```

Expected: commit succeeds with hook checks passing.
