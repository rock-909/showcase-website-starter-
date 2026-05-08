# Public Demo Starter Site Implementation Plan

> Historical snapshot: this plan keeps the dependency versions and upgrade commands that were true when it was written. For current versions, use `docs/technical/tech-stack.md` and `package.json`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Phase 1 public demo starter site: Cloudflare-first positioning, owner-only real traffic dashboard, starter boundary notices, and launch-truth documentation.

**Architecture:** Keep public marketing pages mostly static and localized. Keep Cloudflare analytics server-only under `src/lib/cloudflare/`, protect `/ops/traffic` with a signed HTTP-only cookie, and leave Vercel as compatibility only. Implement the traffic dashboard without a CRM, account system, or custom event pipeline.

**Tech Stack:** Next.js 16.2.4 App Router, React 19.2.5, TypeScript 6.0.3, next-intl 4.11.0, Tailwind CSS 4.2.4, @opennextjs/cloudflare, Wrangler, Vitest, Playwright.

---

## Source documents and rules

Read these before touching code:

- `AGENTS.md`
- `.claude/rules/conventions.md`
- `.claude/rules/cloudflare.md`
- `.claude/rules/coding-standards.md`
- `.claude/rules/code-quality.md`
- `.claude/rules/i18n.md`
- `.claude/rules/security.md`
- `.claude/rules/testing.md`
- `docs/website/README.md`
- `docs/website/新项目替换清单.md`
- `docs/website/AI工作流.md`
- `docs/superpowers/specs/2026-05-04-public-demo-starter-site-design.md`
- `node_modules/next/dist/docs/01-app/01-getting-started/17-deploying.md`
- `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`
- `node_modules/next/dist/docs/01-app/02-guides/environment-variables.md`
- `node_modules/next/dist/docs/01-app/02-guides/analytics.md`

Do not run `pnpm build` and `pnpm build:cf` in parallel.

When using subagents, tell each worker they are not alone in the codebase. They must not revert edits made by others, and they must adapt around any existing changes they find.

## File structure map

### Public positioning and pages

- Modify `src/config/paths/types.ts`: add static page types for `capabilities` and `howItWorks`.
- Modify `src/config/paths/paths-config.ts`: add `/capabilities` and `/how-it-works`.
- Modify `src/config/single-site-links.ts`: add canonical route hrefs for the new pages.
- Modify `src/config/single-site-navigation.ts`: add public nav entries without adding an ops link.
- Modify `src/config/website/navigation.ts`: keep compatibility navigation aligned.
- Modify `src/config/single-site-page-expression.ts`: add a `starterBoundary` homepage section id and order.
- Modify `src/app/[locale]/page.tsx`: render the new starter boundary section.
- Create `src/app/[locale]/capabilities/page.tsx`: static localized capabilities page.
- Create `src/app/[locale]/capabilities/__tests__/page.test.tsx`: page rendering contract.
- Create `src/app/[locale]/how-it-works/page.tsx`: static localized setup-to-launch page.
- Create `src/app/[locale]/how-it-works/__tests__/page.test.tsx`: page rendering contract.
- Create `src/components/sections/starter-boundary-section.tsx`: server component that reads localized starter boundary copy.
- Create `src/components/sections/starter-boundary-section-view.tsx`: presentational view for the section.
- Create `src/components/sections/__tests__/starter-boundary-section.test.tsx`: section contract.
- Modify `messages/en/critical.json` and `messages/zh/critical.json`: update homepage copy and add new page/section copy.
- Modify `src/components/sections/__tests__/homepage-cluster-contract.test.tsx`: include starter boundary contract.
- Modify `src/app/[locale]/__tests__/page.test.tsx`: expect the new section.

### Cloudflare analytics and owner access

- Modify `src/lib/env-schemas.ts`: add server-only Cloudflare analytics and ops access env vars.
- Modify `src/lib/env-runtime.ts`: expose those env vars to the central env facade.
- Modify `src/lib/__tests__/env.test.ts`: assert the new server-only vars exist.
- Modify `tests/architecture/env-boundary.test.ts`: assert analytics secrets do not enter the browser env helper.
- Create `src/lib/cloudflare/analytics-config.ts`: read and normalize analytics configuration.
- Create `src/lib/cloudflare/analytics-types.ts`: data contracts for the dashboard.
- Create `src/lib/cloudflare/analytics-client.ts`: server-only GraphQL client.
- Create `src/lib/cloudflare/analytics-cache.ts`: five-minute in-memory dashboard cache.
- Create `src/lib/cloudflare/__tests__/analytics-config.test.ts`: config tests.
- Create `src/lib/cloudflare/__tests__/analytics-client.test.ts`: GraphQL client tests with mocked fetch.
- Create `src/lib/cloudflare/__tests__/analytics-cache.test.ts`: TTL behavior tests.
- Create `src/lib/ops/access-cookie.ts`: signed owner access cookie helpers.
- Create `src/lib/ops/__tests__/access-cookie.test.ts`: cookie signing and verification tests.
- Create `src/app/ops/traffic/access/route.ts`: form POST handler that sets or clears the access cookie.
- Create `src/app/ops/traffic/access/__tests__/route.test.ts`: access route tests.
- Create `src/app/ops/traffic/page.tsx`: protected owner dashboard page.
- Create `src/app/ops/traffic/__tests__/page.test.tsx`: configured, unconfigured, authorized, and unauthorized states.
- Modify `src/middleware.ts`: exclude `/ops/*` from locale middleware.
- Modify `tests/unit/middleware.test.ts`: prove `/ops/traffic` is not locale-redirected.

### Documentation and proof

- Modify `docs/website/部署设置.md`: make Cloudflare the official path and document analytics env vars.
- Modify `docs/website/quality-proof.md`: add traffic dashboard proof and Cloudflare dashboard boundary.
- Modify `docs/website/新项目替换清单.md`: add dashboard credentials and Cloudflare analytics setup to the replacement checklist.
- Modify `scripts/validate-production-config.ts`: add public launch warnings for analytics/dashboard readiness when strict launch validation is requested.
- Modify `tests/unit/scripts/validate-production-config.test.ts`: cover those warnings/errors.
- Modify `package.json` and `pnpm-lock.yaml`: align OpenNext/Cloudflare dependencies in the first implementation task.

---

## Task 1: Cloudflare dependency alignment

**Files:**

- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Record current versions**

Run:

```bash
pnpm outdated @opennextjs/cloudflare wrangler --format json
```

Expected: output shows `@opennextjs/cloudflare` at `1.19.4` with latest `1.19.6`, and `wrangler` at `4.86.0` with latest `4.87.0`.

- [ ] **Step 2: Upgrade OpenNext and Wrangler together**

Run:

```bash
pnpm add -D @opennextjs/cloudflare@1.19.6 wrangler@4.87.0
```

Expected: `package.json` records `@opennextjs/cloudflare` as `1.19.6` and `wrangler` as `4.87.0`; `pnpm-lock.yaml` is updated.

- [ ] **Step 3: Run dependency proof**

Run:

```bash
pnpm type-check
pnpm build
pnpm build:cf
pnpm review:cf:official-compare:source
```

Expected:

- `pnpm type-check` exits 0.
- `pnpm build` exits 0.
- `pnpm build:cf` exits 0.
- `pnpm review:cf:official-compare:source` exits 0.

If `wrangler@4.87.0` fails while `@opennextjs/cloudflare@1.19.6` works with `wrangler@4.86.0`, pin only Wrangler back:

```bash
pnpm add -D wrangler@4.86.0
```

Then rerun the same four proof commands and record the Wrangler hold reason in `docs/website/部署设置.md`.

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml docs/website/部署设置.md
git commit -m "chore: align cloudflare deployment dependencies"
```

---

## Task 2: Public routes and navigation

**Files:**

- Modify: `src/config/paths/types.ts`
- Modify: `src/config/paths/paths-config.ts`
- Modify: `src/config/single-site-links.ts`
- Modify: `src/config/single-site-navigation.ts`
- Modify: `src/config/website/navigation.ts`
- Test: `src/config/__tests__/paths.test.ts`
- Test: `src/config/__tests__/single-site-page-expression.test.ts`
- Test: `src/config/website/__tests__/website-config.test.ts`

- [ ] **Step 1: Write failing path tests**

Add assertions to `src/config/__tests__/paths.test.ts`:

```ts
it("exposes public demo starter pages", () => {
  expect(getLocalizedPath("capabilities", "en")).toBe("/capabilities");
  expect(getLocalizedPath("capabilities", "zh")).toBe("/capabilities");
  expect(getLocalizedPath("howItWorks", "en")).toBe("/how-it-works");
  expect(getLocalizedPath("howItWorks", "zh")).toBe("/how-it-works");
});
```

In `src/config/__tests__/single-site-page-expression.test.ts`, update the expected homepage section order to include the new starter boundary section:

```ts
expect(SINGLE_SITE_HOME_GRID_SECTION_ORDER).toEqual([
  "hero",
  "starterBoundary",
  "chain",
  "products",
  "resources",
  "sampleCta",
  "scenarios",
  "quality",
]);
```

In `src/config/website/__tests__/website-config.test.ts`, strengthen the navigation assertion:

```ts
expect(websiteNavigation.map((item) => item.href)).toEqual([
  "/",
  "/capabilities",
  "/how-it-works",
  "/products",
  "/about",
  "/contact",
]);
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm exec vitest run src/config/__tests__/paths.test.ts src/config/__tests__/single-site-page-expression.test.ts src/config/website/__tests__/website-config.test.ts
```

Expected: FAIL because `capabilities` and `howItWorks` are not defined.

- [ ] **Step 3: Add page types and paths**

Update `src/config/paths/types.ts` so `PageType` includes:

```ts
export type PageType =
  | "home"
  | "about"
  | "contact"
  | "products"
  | "privacy"
  | "terms"
  | "customProject"
  | "capabilities"
  | "howItWorks";
```

Update `src/config/paths/paths-config.ts`:

```ts
capabilities: Object.freeze({
  en: "/capabilities",
  zh: "/capabilities",
}),

howItWorks: Object.freeze({
  en: "/how-it-works",
  zh: "/how-it-works",
}),
```

Place the two entries with the other main public pages, before legal pages.

- [ ] **Step 4: Add route hrefs and navigation**

Update `src/config/single-site-links.ts`:

```ts
export const SINGLE_SITE_ROUTE_HREFS = {
  home: getCanonicalPath("home"),
  about: getCanonicalPath("about"),
  contact: getCanonicalPath("contact"),
  products: getCanonicalPath("products"),
  privacy: getCanonicalPath("privacy"),
  terms: getCanonicalPath("terms"),
  customProject: getCanonicalPath("customProject"),
  capabilities: getCanonicalPath("capabilities"),
  howItWorks: getCanonicalPath("howItWorks"),
} as const;
```

Update `src/config/single-site-navigation.ts`:

```ts
export const SINGLE_SITE_NAVIGATION: SiteNavigationItem[] = [
  {
    key: "home",
    href: SINGLE_SITE_ROUTE_HREFS.home,
    translationKey: "navigation.home",
  },
  {
    key: "capabilities",
    href: SINGLE_SITE_ROUTE_HREFS.capabilities,
    translationKey: "navigation.capabilities",
  },
  {
    key: "howItWorks",
    href: SINGLE_SITE_ROUTE_HREFS.howItWorks,
    translationKey: "navigation.howItWorks",
  },
  {
    key: "products",
    href: SINGLE_SITE_ROUTE_HREFS.products,
    translationKey: "navigation.products",
  },
  {
    key: "customProject",
    href: SINGLE_SITE_ROUTE_HREFS.customProject,
    translationKey: "navigation.customProject",
  },
  {
    key: "about",
    href: SINGLE_SITE_ROUTE_HREFS.about,
    translationKey: "navigation.about",
  },
  {
    key: "contact",
    href: SINGLE_SITE_ROUTE_HREFS.contact,
    translationKey: "navigation.contact",
  },
];
```

Update `src/config/website/navigation.ts`:

```ts
export const websiteNavigation: readonly WebsiteNavigationItem[] = [
  { labelKey: "navigation.home", href: "/" },
  { labelKey: "navigation.capabilities", href: "/capabilities" },
  { labelKey: "navigation.howItWorks", href: "/how-it-works" },
  { labelKey: "navigation.products", href: "/products" },
  { labelKey: "navigation.about", href: "/about" },
  { labelKey: "navigation.contact", href: "/contact" },
];
```

- [ ] **Step 5: Add navigation labels**

In `messages/en/critical.json`, add under `navigation`:

```json
"capabilities": "Capabilities",
"howItWorks": "How It Works"
```

In `messages/zh/critical.json`, add under `navigation`:

```json
"capabilities": "能力",
"howItWorks": "如何使用"
```

- [ ] **Step 6: Run tests to verify pass**

Run:

```bash
pnpm exec vitest run src/config/__tests__/paths.test.ts src/config/__tests__/single-site-page-expression.test.ts src/config/website/__tests__/website-config.test.ts
pnpm validate:translations
```

Expected: all commands exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/config/paths/types.ts src/config/paths/paths-config.ts src/config/single-site-links.ts src/config/single-site-navigation.ts src/config/website/navigation.ts src/config/__tests__/paths.test.ts src/config/__tests__/single-site-page-expression.test.ts src/config/website/__tests__/website-config.test.ts messages/en/critical.json messages/zh/critical.json
git commit -m "feat: add public demo starter routes"
```

---

## Task 3: Homepage public demo story

**Files:**

- Modify: `src/config/single-site-page-expression.ts`
- Modify: `src/app/[locale]/page.tsx`
- Create: `src/components/sections/starter-boundary-section.tsx`
- Create: `src/components/sections/starter-boundary-section-view.tsx`
- Test: `src/components/sections/__tests__/starter-boundary-section.test.tsx`
- Modify: `src/components/sections/__tests__/homepage-cluster-contract.test.tsx`
- Modify: `src/app/[locale]/__tests__/page.test.tsx`
- Modify: `messages/en/critical.json`
- Modify: `messages/zh/critical.json`

- [ ] **Step 1: Write failing section test**

Create `src/components/sections/__tests__/starter-boundary-section.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import enCriticalMessages from "../../../../messages/en/critical.json";
import { StarterBoundarySection } from "@/components/sections/starter-boundary-section";

async function renderAsyncComponent(
  asyncComponent: React.JSX.Element | Promise<React.JSX.Element>,
) {
  const resolvedElement = await Promise.resolve(asyncComponent);
  return render(resolvedElement);
}

describe("StarterBoundarySection", () => {
  it("explains that the polished site is still a replaceable starter", async () => {
    await renderAsyncComponent(StarterBoundarySection());

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "starterBoundary.title",
      }),
    ).toBeInTheDocument();

    const list = screen.getByRole("list", {
      name: "starterBoundary.listLabel",
    });
    expect(within(list).getAllByRole("listitem")).toHaveLength(4);
  });

  it("keeps starter boundary translation keys wired to real copy", () => {
    const copy = enCriticalMessages.home.starterBoundary;

    expect(copy.title.trim().length).toBeGreaterThan(0);
    expect(copy.description.trim().length).toBeGreaterThan(0);
    expect(copy.listLabel.trim().length).toBeGreaterThan(0);
    expect(copy.items).toHaveLength(4);
    for (const item of copy.items) {
      expect(item.title.trim().length).toBeGreaterThan(0);
      expect(item.description.trim().length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
pnpm exec vitest run src/components/sections/__tests__/starter-boundary-section.test.tsx
```

Expected: FAIL because `StarterBoundarySection` does not exist.

- [ ] **Step 3: Add section id and page rendering**

Update `src/config/single-site-page-expression.ts`:

```ts
export const SINGLE_SITE_HOME_GRID_SECTION_ORDER = [
  "hero",
  "starterBoundary",
  "chain",
  "products",
  "resources",
  "sampleCta",
  "scenarios",
  "quality",
] as const;
```

Update `src/app/[locale]/page.tsx` imports:

```ts
import { StarterBoundarySection } from "@/components/sections/starter-boundary-section";
```

Update `renderHomeGridSection`:

```tsx
case "starterBoundary":
  return <StarterBoundarySection key={sectionId} />;
```

- [ ] **Step 4: Implement presentational section view**

Create `src/components/sections/starter-boundary-section-view.tsx`:

```tsx
import { Link } from "@/i18n/routing";
import { HomepageSectionShell } from "@/components/sections/homepage-section-shell";
import type { LinkHref } from "@/lib/i18n/route-parsing";

export interface StarterBoundaryItem {
  title: string;
  description: string;
}

export interface StarterBoundaryLink {
  label: string;
  href: LinkHref;
}

export interface StarterBoundaryContent {
  title: string;
  description: string;
  listLabel: string;
  items: StarterBoundaryItem[];
  primary: StarterBoundaryLink;
  secondary: StarterBoundaryLink;
}

interface StarterBoundarySectionViewProps {
  content: StarterBoundaryContent;
}

export function StarterBoundarySectionView({
  content,
}: StarterBoundarySectionViewProps) {
  return (
    <HomepageSectionShell
      sectionClassName="section-divider bg-muted/40 py-14 md:py-[72px]"
      title={content.title}
      subtitle={content.description}
    >
      <ul
        aria-label={content.listLabel}
        className="grid grid-cols-1 gap-4 md:grid-cols-2"
      >
        {content.items.map((item) => (
          <li key={item.title} className="rounded-xl border bg-background p-5">
            <h3 className="text-base font-semibold">{item.title}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {item.description}
            </p>
          </li>
        ))}
      </ul>
      <div className="mt-6 flex flex-wrap gap-3 text-sm font-medium">
        <Link href={content.primary.href}>{content.primary.label}</Link>
        <Link href={content.secondary.href}>{content.secondary.label}</Link>
      </div>
    </HomepageSectionShell>
  );
}
```

- [ ] **Step 5: Implement server section**

Create `src/components/sections/starter-boundary-section.tsx`:

```tsx
import { getTranslations } from "next-intl/server";

import {
  StarterBoundarySectionView,
  type StarterBoundaryContent,
} from "@/components/sections/starter-boundary-section-view";
import { SINGLE_SITE_ROUTE_HREFS } from "@/config/single-site-links";

const STARTER_BOUNDARY_ITEM_COUNT = 4;

export async function StarterBoundarySection() {
  const t = await getTranslations("home.starterBoundary");

  const content = {
    title: t("title"),
    description: t("description"),
    listLabel: t("listLabel"),
    items: Array.from({ length: STARTER_BOUNDARY_ITEM_COUNT }, (_, index) => {
      const key = `items.${index}`;
      return {
        title: t(`${key}.title`),
        description: t(`${key}.description`),
      };
    }),
    primary: {
      label: t("primary"),
      href: SINGLE_SITE_ROUTE_HREFS.howItWorks,
    },
    secondary: {
      label: t("secondary"),
      href: SINGLE_SITE_ROUTE_HREFS.contact,
    },
  } satisfies StarterBoundaryContent;

  return <StarterBoundarySectionView content={content} />;
}
```

- [ ] **Step 6: Add localized copy**

Add under `home` in `messages/en/critical.json`:

```json
"starterBoundary": {
  "title": "This looks finished because the starter should prove the launch path.",
  "description": "The public demo shows a complete website shape while keeping the replacement work visible before a real business uses it.",
  "listLabel": "Starter replacement requirements",
  "items": [
    {
      "title": "Replace the business identity",
      "description": "Company name, domain, contact details, legal body, logo, and social links must become owner-confirmed facts."
    },
    {
      "title": "Replace the offer story",
      "description": "Products, services, proof, images, and response promises must match the real business."
    },
    {
      "title": "Connect the lead path",
      "description": "Inquiry forms, email, Airtable or CRM destinations, Turnstile, and canary checks must use the real environment."
    },
    {
      "title": "Prove the deployment",
      "description": "Cloudflare build, preview smoke, dashboard credentials, and owner signoff stay separate from local test results."
    }
  ],
  "primary": "See how it works",
  "secondary": "Review contact flow"
}
```

Add under `home` in `messages/zh/critical.json`:

```json
"starterBoundary": {
  "title": "它看起来像成品，是为了证明上线路径能跑通。",
  "description": "公开 demo 展示一套完整网站形态，同时把真实项目上线前必须替换的内容摆在明面上。",
  "listLabel": "Starter 替换要求",
  "items": [
    {
      "title": "替换业务身份",
      "description": "公司名、域名、联系方式、法务主体、logo 和社交链接都要变成 owner 确认过的事实。"
    },
    {
      "title": "替换业务内容",
      "description": "产品、服务、证据、图片和响应承诺都要匹配真实业务。"
    },
    {
      "title": "接通线索路径",
      "description": "询盘表单、邮件、Airtable 或 CRM、Turnstile 和 canary 检查都要使用真实环境。"
    },
    {
      "title": "证明部署结果",
      "description": "Cloudflare 构建、预览检查、流量面板凭证和 owner 确认要和本地测试分开看。"
    }
  ],
  "primary": "查看使用流程",
  "secondary": "查看联系流程"
}
```

- [ ] **Step 7: Update homepage tests**

In `src/app/[locale]/__tests__/page.test.tsx`, add the mock:

```tsx
vi.mock("@/components/sections/starter-boundary-section", () => ({
  StarterBoundarySection: () => (
    <div data-testid="starter-boundary-section">Starter Boundary</div>
  ),
}));
```

Add assertion in the all-sections test:

```ts
expect(getByTestId("starter-boundary-section")).toBeInTheDocument();
```

In `src/components/sections/__tests__/homepage-cluster-contract.test.tsx`, import and render `StarterBoundarySection` in the cluster responsibility test:

```ts
import { StarterBoundarySection } from "@/components/sections/starter-boundary-section";
```

```ts
await renderAsyncComponent(StarterBoundarySection());
expect(
  screen.getByRole("heading", {
    level: 2,
    name: "starterBoundary.title",
  }),
).toBeInTheDocument();
```

- [ ] **Step 8: Run tests to verify pass**

Run:

```bash
pnpm exec vitest run src/components/sections/__tests__/starter-boundary-section.test.tsx src/components/sections/__tests__/homepage-cluster-contract.test.tsx 'src/app/[locale]/__tests__/page.test.tsx'
pnpm validate:translations
```

Expected: all commands exit 0.

- [ ] **Step 9: Commit**

```bash
git add src/config/single-site-page-expression.ts 'src/app/[locale]/page.tsx' 'src/app/[locale]/__tests__/page.test.tsx' src/components/sections/starter-boundary-section.tsx src/components/sections/starter-boundary-section-view.tsx src/components/sections/__tests__/starter-boundary-section.test.tsx src/components/sections/__tests__/homepage-cluster-contract.test.tsx messages/en/critical.json messages/zh/critical.json
git commit -m "feat: add public starter boundary section"
```

---

## Task 4: Capabilities and how-it-works pages

**Files:**

- Create: `src/app/[locale]/capabilities/page.tsx`
- Create: `src/app/[locale]/capabilities/__tests__/page.test.tsx`
- Create: `src/app/[locale]/how-it-works/page.tsx`
- Create: `src/app/[locale]/how-it-works/__tests__/page.test.tsx`
- Modify: `messages/en/critical.json`
- Modify: `messages/zh/critical.json`

- [ ] **Step 1: Write failing page tests**

Create `src/app/[locale]/capabilities/__tests__/page.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import CapabilitiesPage from "../page";

describe("CapabilitiesPage", () => {
  it("renders the public capabilities story", async () => {
    const page = await CapabilitiesPage({
      params: Promise.resolve({ locale: "en" }),
    });

    render(page);

    expect(
      screen.getByRole("heading", { level: 1, name: "capabilities.title" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(6);
  });
});
```

Create `src/app/[locale]/how-it-works/__tests__/page.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HowItWorksPage from "../page";

describe("HowItWorksPage", () => {
  it("renders the setup to launch flow", async () => {
    const page = await HowItWorksPage({
      params: Promise.resolve({ locale: "en" }),
    });

    render(page);

    expect(
      screen.getByRole("heading", { level: 1, name: "howItWorks.title" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm exec vitest run 'src/app/[locale]/capabilities/__tests__/page.test.tsx' 'src/app/[locale]/how-it-works/__tests__/page.test.tsx'
```

Expected: FAIL because the pages do not exist.

- [ ] **Step 3: Implement capabilities page**

Create `src/app/[locale]/capabilities/page.tsx`:

```tsx
import { setRequestLocale, getTranslations } from "next-intl/server";

import { generateLocaleStaticParams, type LocaleParam } from "@/app/[locale]/generate-static-params";

const CAPABILITY_COUNT = 6;

interface CapabilitiesPageProps {
  params: Promise<LocaleParam>;
}

export function generateStaticParams() {
  return generateLocaleStaticParams();
}

export default async function CapabilitiesPage({
  params,
}: CapabilitiesPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("capabilities");

  const items = Array.from({ length: CAPABILITY_COUNT }, (_, index) => ({
    title: t(`items.${index}.title`),
    description: t(`items.${index}.description`),
  }));

  return (
    <div className="mx-auto max-w-[1080px] px-6 py-16">
      <p className="text-sm font-semibold uppercase tracking-[0.04em] text-primary">
        {t("eyebrow")}
      </p>
      <h1 className="mt-3 text-4xl font-bold tracking-[-0.03em]">
        {t("title")}
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
        {t("description")}
      </p>
      <ul className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
        {items.map((item) => (
          <li key={item.title} className="rounded-xl border p-5">
            <h2 className="text-lg font-semibold">{item.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {item.description}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Implement how-it-works page**

Create `src/app/[locale]/how-it-works/page.tsx`:

```tsx
import { setRequestLocale, getTranslations } from "next-intl/server";

import { generateLocaleStaticParams, type LocaleParam } from "@/app/[locale]/generate-static-params";

const STEP_COUNT = 5;

interface HowItWorksPageProps {
  params: Promise<LocaleParam>;
}

export function generateStaticParams() {
  return generateLocaleStaticParams();
}

export default async function HowItWorksPage({
  params,
}: HowItWorksPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("howItWorks");

  const steps = Array.from({ length: STEP_COUNT }, (_, index) => ({
    title: t(`steps.${index}.title`),
    description: t(`steps.${index}.description`),
  }));

  return (
    <div className="mx-auto max-w-[1080px] px-6 py-16">
      <p className="text-sm font-semibold uppercase tracking-[0.04em] text-primary">
        {t("eyebrow")}
      </p>
      <h1 className="mt-3 text-4xl font-bold tracking-[-0.03em]">
        {t("title")}
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
        {t("description")}
      </p>
      <ol className="mt-10 grid grid-cols-1 gap-4">
        {steps.map((step, index) => (
          <li key={step.title} className="rounded-xl border p-5">
            <p className="text-sm font-semibold text-primary">
              {t("stepLabel", { count: index + 1 })}
            </p>
            <h2 className="mt-2 text-lg font-semibold">{step.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {step.description}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
```

- [ ] **Step 5: Add localized page copy**

Add top-level `capabilities` and `howItWorks` objects to both `messages/en/critical.json` and `messages/zh/critical.json`.

English:

```json
"capabilities": {
  "eyebrow": "Starter capabilities",
  "title": "A website and lead foundation for a small B2B company.",
  "description": "The demo shows the pieces a company needs before a public launch: pages, offer story, inquiry path, deployment proof, and owner traffic visibility.",
  "items": [
    { "title": "Credible public pages", "description": "Home, capabilities, process, about, contact, privacy, and terms pages start from a working structure." },
    { "title": "Clear offer story", "description": "Product, service, resource, and custom-project examples show how real offers can be explained." },
    { "title": "Lead capture path", "description": "Contact and inquiry flows stay visible, testable, and ready for real destinations." },
    { "title": "Cloudflare-first deploy", "description": "The recommended route is Cloudflare Workers through OpenNext, with Vercel kept as compatibility." },
    { "title": "Owner traffic dashboard", "description": "The protected ops page can show real Cloudflare traffic once credentials are configured." },
    { "title": "Replacement guardrails", "description": "Docs and checks keep sample identity, proof, legal copy, and deployment values from being treated as real launch truth." }
  ]
},
"howItWorks": {
  "eyebrow": "Setup to launch",
  "title": "Move from no website to a launchable foundation.",
  "description": "Use the starter as a complete demo, replace the business facts, connect the lead path, deploy on Cloudflare, and prove the result before calling it launch-ready.",
  "stepLabel": "Step {count}",
  "steps": [
    { "title": "Replace the business facts", "description": "Update brand, domain, contact details, offer content, images, legal body, and proof assets." },
    { "title": "Review the public story", "description": "Make sure the homepage and support pages explain the real business clearly." },
    { "title": "Connect the lead path", "description": "Configure form security, email, Airtable or CRM storage, and a safe test submission flow." },
    { "title": "Deploy on Cloudflare", "description": "Run the Cloudflare build and preview proof before a public route is treated as ready." },
    { "title": "Check traffic and sign off", "description": "Configure the owner dashboard, review real traffic visibility, and confirm launch truth with the owner." }
  ]
}
```

Chinese:

```json
"capabilities": {
  "eyebrow": "Starter 能力",
  "title": "给小型 B2B 公司用的网站和线索基础设施。",
  "description": "这个 demo 展示公开上线前需要的基础部分：页面、业务表达、询盘路径、部署证明和 owner 可见的流量信息。",
  "items": [
    { "title": "可信的公开页面", "description": "首页、能力、流程、关于、联系、隐私和条款页面都从可运行结构开始。" },
    { "title": "清楚的业务表达", "description": "产品、服务、资源和定制项目示例说明真实业务应该如何被讲清楚。" },
    { "title": "线索收集路径", "description": "联系和询盘流程保持可见、可测，并能接入真实目的地。" },
    { "title": "Cloudflare 优先部署", "description": "推荐路径是通过 OpenNext 部署到 Cloudflare Workers，Vercel 只保留兼容支持。" },
    { "title": "Owner 流量面板", "description": "配置凭证后，受保护的 ops 页面可以显示真实 Cloudflare 流量。" },
    { "title": "替换防线", "description": "文档和检查会阻止示例身份、证据、法务文案和部署配置被当成真实上线事实。" }
  ]
},
"howItWorks": {
  "eyebrow": "从设置到上线",
  "title": "从没有网站，到一套可上线的基础设施。",
  "description": "以这个完整 demo 为起点，替换业务事实，接通线索路径，部署到 Cloudflare，并在证明完成后再说可以上线。",
  "stepLabel": "第 {count} 步",
  "steps": [
    { "title": "替换业务事实", "description": "更新品牌、域名、联系方式、业务内容、图片、法务主体和证据材料。" },
    { "title": "检查公开表达", "description": "确认首页和支持页面能把真实业务讲清楚。" },
    { "title": "接通线索路径", "description": "配置表单安全、邮件、Airtable 或 CRM 存储，以及安全的测试提交流程。" },
    { "title": "部署到 Cloudflare", "description": "完成 Cloudflare 构建和预览证明后，才能把公开路由当成可用结果。" },
    { "title": "查看流量并确认", "description": "配置 owner 面板，确认真实流量可见，再由 owner 做上线确认。" }
  ]
}
```

- [ ] **Step 6: Run tests to verify pass**

Run:

```bash
pnpm exec vitest run 'src/app/[locale]/capabilities/__tests__/page.test.tsx' 'src/app/[locale]/how-it-works/__tests__/page.test.tsx'
pnpm validate:translations
pnpm content:slug-check
```

Expected: all commands exit 0.

- [ ] **Step 7: Commit**

```bash
git add 'src/app/[locale]/capabilities/page.tsx' 'src/app/[locale]/capabilities/__tests__/page.test.tsx' 'src/app/[locale]/how-it-works/page.tsx' 'src/app/[locale]/how-it-works/__tests__/page.test.tsx' messages/en/critical.json messages/zh/critical.json
git commit -m "feat: add public demo starter pages"
```

---

## Task 5: Cloudflare analytics env contract

**Files:**

- Modify: `src/lib/env-schemas.ts`
- Modify: `src/lib/env-runtime.ts`
- Modify: `src/lib/__tests__/env.test.ts`
- Modify: `tests/architecture/env-boundary.test.ts`

- [ ] **Step 1: Write failing env tests**

Add to `src/lib/__tests__/env.test.ts`:

```ts
it("exposes Cloudflare analytics and ops dashboard vars through the central env object", () => {
  expect("CLOUDFLARE_ZONE_ID" in env).toBe(true);
  expect("CLOUDFLARE_ANALYTICS_API_TOKEN" in env).toBe(true);
  expect("CLOUDFLARE_ANALYTICS_HOSTNAME" in env).toBe(true);
  expect("OPS_DASHBOARD_ACCESS_KEY" in env).toBe(true);
  expect("CLOUDFLARE_ACCOUNT_ID" in env).toBe(true);
});
```

Add to `tests/architecture/env-boundary.test.ts` in the browser env helper test:

```ts
expect(source).not.toContain("CLOUDFLARE_ANALYTICS_API_TOKEN");
expect(source).not.toContain("OPS_DASHBOARD_ACCESS_KEY");
expect(source).not.toContain("CLOUDFLARE_ZONE_ID");
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm exec vitest run src/lib/__tests__/env.test.ts tests/architecture/env-boundary.test.ts
```

Expected: FAIL because the server env keys are missing.

- [ ] **Step 3: Add server schema keys**

Add to `serverEnvSchema` in `src/lib/env-schemas.ts`:

```ts
  // Cloudflare analytics and owner dashboard
  CLOUDFLARE_ZONE_ID: z.string().min(1).optional(),
  CLOUDFLARE_ACCOUNT_ID: z.string().min(1).optional(),
  CLOUDFLARE_ANALYTICS_API_TOKEN: z.string().min(1).optional(),
  CLOUDFLARE_ANALYTICS_HOSTNAME: z.string().min(1).optional(),
  OPS_DASHBOARD_ACCESS_KEY: z.string().min(16).optional(),
```

Do not add these keys to `clientEnvSchema`.

- [ ] **Step 4: Add runtime env mappings**

Add to `runtimeEnv` in `src/lib/env-runtime.ts`:

```ts
  CLOUDFLARE_ZONE_ID: process.env.CLOUDFLARE_ZONE_ID,
  CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID,
  CLOUDFLARE_ANALYTICS_API_TOKEN:
    process.env.CLOUDFLARE_ANALYTICS_API_TOKEN,
  CLOUDFLARE_ANALYTICS_HOSTNAME:
    process.env.CLOUDFLARE_ANALYTICS_HOSTNAME,
  OPS_DASHBOARD_ACCESS_KEY: process.env.OPS_DASHBOARD_ACCESS_KEY,
```

- [ ] **Step 5: Run tests to verify pass**

Run:

```bash
pnpm exec vitest run src/lib/__tests__/env.test.ts tests/architecture/env-boundary.test.ts
pnpm type-check
```

Expected: both commands exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/env-schemas.ts src/lib/env-runtime.ts src/lib/__tests__/env.test.ts tests/architecture/env-boundary.test.ts
git commit -m "feat: add cloudflare analytics env contract"
```

---

## Task 6: Cloudflare analytics client and cache

**Files:**

- Create: `src/lib/cloudflare/analytics-types.ts`
- Create: `src/lib/cloudflare/analytics-config.ts`
- Create: `src/lib/cloudflare/analytics-client.ts`
- Create: `src/lib/cloudflare/analytics-cache.ts`
- Test: `src/lib/cloudflare/__tests__/analytics-config.test.ts`
- Test: `src/lib/cloudflare/__tests__/analytics-client.test.ts`
- Test: `src/lib/cloudflare/__tests__/analytics-cache.test.ts`

- [ ] **Step 1: Write failing config test**

Create `src/lib/cloudflare/__tests__/analytics-config.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

import {
  getCloudflareAnalyticsConfig,
  isCloudflareAnalyticsConfigured,
} from "../analytics-config";

describe("cloudflare analytics config", () => {
  it("reports unconfigured when required vars are missing", () => {
    vi.stubEnv("CLOUDFLARE_ZONE_ID", "");
    vi.stubEnv("CLOUDFLARE_ANALYTICS_API_TOKEN", "");
    vi.stubEnv("CLOUDFLARE_ANALYTICS_HOSTNAME", "");

    expect(isCloudflareAnalyticsConfigured()).toBe(false);
    expect(getCloudflareAnalyticsConfig()).toEqual({
      configured: false,
      reason: "missing-credentials",
    });
  });

  it("returns a configured server-only contract", () => {
    vi.stubEnv("CLOUDFLARE_ZONE_ID", "zone-123");
    vi.stubEnv("CLOUDFLARE_ANALYTICS_API_TOKEN", "token-123");
    vi.stubEnv("CLOUDFLARE_ANALYTICS_HOSTNAME", "example.com");

    expect(getCloudflareAnalyticsConfig()).toEqual({
      configured: true,
      zoneId: "zone-123",
      apiToken: "token-123",
      hostname: "example.com",
    });
  });
});
```

- [ ] **Step 2: Write failing client and cache tests**

Create `src/lib/cloudflare/__tests__/analytics-client.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchCloudflareTrafficSummary } from "../analytics-client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchCloudflareTrafficSummary", () => {
  it("maps Cloudflare GraphQL response into owner dashboard data", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          viewer: {
            zones: [
              {
                totals: [
                  {
                    sum: { requests: 1200, bytes: 4096 },
                    uniq: { uniques: 320 },
                  },
                ],
                statusCodes: [
                  { dimensions: { edgeResponseStatus: 200 }, sum: { requests: 1100 } },
                  { dimensions: { edgeResponseStatus: 500 }, sum: { requests: 5 } },
                ],
                topPaths: [
                  { dimensions: { clientRequestPath: "/" }, sum: { requests: 700 } },
                ],
                topCountries: [
                  { dimensions: { clientCountryName: "United States" }, sum: { requests: 500 } },
                ],
                hourly: [
                  {
                    dimensions: { datetimeHour: "2026-05-04T10:00:00Z" },
                    sum: { requests: 100, bytes: 1024 },
                    uniq: { uniques: 50 },
                  },
                ],
              },
            ],
          },
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchCloudflareTrafficSummary({
      zoneId: "zone-123",
      apiToken: "token-123",
      hostname: "example.com",
      now: new Date("2026-05-04T12:00:00Z"),
    });

    expect(result.configured).toBe(true);
    if (!result.configured) throw new Error("Expected configured result");
    expect(result.summary.visits).toBe(320);
    expect(result.summary.requests).toBe(1200);
    expect(result.summary.bandwidthBytes).toBe(4096);
    expect(result.summary.errorRate).toBeCloseTo(5 / 1200);
    expect(result.topPages).toEqual([{ path: "/", requests: 700 }]);
    expect(result.topCountries).toEqual([{ country: "United States", requests: 500 }]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.cloudflare.com/client/v4/graphql",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer token-123",
        }),
      }),
    );
  });

  it("returns a safe error without exposing the token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: async () => "token-123 is forbidden",
      }),
    );

    const result = await fetchCloudflareTrafficSummary({
      zoneId: "zone-123",
      apiToken: "token-123",
      hostname: "example.com",
      now: new Date("2026-05-04T12:00:00Z"),
    });

    expect(result).toEqual({
      configured: false,
      reason: "request-failed",
    });
  });
});
```

Create `src/lib/cloudflare/__tests__/analytics-cache.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

import { getCachedCloudflareTrafficSummary } from "../analytics-cache";

describe("getCachedCloudflareTrafficSummary", () => {
  it("caches a configured result for five minutes", async () => {
    const loader = vi.fn().mockResolvedValue({
      configured: true,
      source: "cloudflare",
      hostname: "example.com",
      lastUpdated: "2026-05-04T12:00:00.000Z",
      summary: { visits: 1, requests: 2, bandwidthBytes: 3, errorRate: 0 },
      hourly: [],
      topPages: [],
      topCountries: [],
      statusCodes: [],
    });

    const first = await getCachedCloudflareTrafficSummary({
      cacheKey: "example.com",
      nowMs: 1000,
      loader,
    });
    const second = await getCachedCloudflareTrafficSummary({
      cacheKey: "example.com",
      nowMs: 1000 + 60_000,
      loader,
    });

    expect(first).toBe(second);
    expect(loader).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 3: Run tests to verify failure**

Run:

```bash
pnpm exec vitest run src/lib/cloudflare/__tests__/analytics-config.test.ts src/lib/cloudflare/__tests__/analytics-client.test.ts src/lib/cloudflare/__tests__/analytics-cache.test.ts
```

Expected: FAIL because modules do not exist.

- [ ] **Step 4: Implement analytics types**

Create `src/lib/cloudflare/analytics-types.ts`:

```ts
export interface CloudflareAnalyticsConfig {
  configured: true;
  zoneId: string;
  apiToken: string;
  hostname: string;
}

export interface CloudflareAnalyticsNotConfigured {
  configured: false;
  reason:
    | "missing-credentials"
    | "request-failed"
    | "graphql-error"
    | "empty-zone";
}

export type CloudflareAnalyticsConfigState =
  | CloudflareAnalyticsConfig
  | CloudflareAnalyticsNotConfigured;

export interface CloudflareTrafficSummary {
  visits: number;
  requests: number;
  bandwidthBytes: number;
  errorRate: number;
}

export interface CloudflareTrafficPoint {
  hour: string;
  visits: number;
  requests: number;
  bandwidthBytes: number;
}

export interface CloudflareTrafficDimension {
  label: string;
  requests: number;
}

export interface CloudflareTopPage {
  path: string;
  requests: number;
}

export interface CloudflareTrafficDashboardData {
  configured: true;
  source: "cloudflare";
  hostname: string;
  lastUpdated: string;
  summary: CloudflareTrafficSummary;
  hourly: CloudflareTrafficPoint[];
  topPages: CloudflareTopPage[];
  topCountries: CloudflareTrafficDimension[];
  statusCodes: CloudflareTrafficDimension[];
}

export type CloudflareTrafficDashboardState =
  | CloudflareTrafficDashboardData
  | CloudflareAnalyticsNotConfigured;
```

- [ ] **Step 5: Implement analytics config**

Create `src/lib/cloudflare/analytics-config.ts`:

```ts
import "server-only";

import { getRuntimeEnvString } from "@/lib/env";
import type { CloudflareAnalyticsConfigState } from "./analytics-types";

function readTrimmedEnv(key: Parameters<typeof getRuntimeEnvString>[0]) {
  return getRuntimeEnvString(key)?.trim();
}

export function getCloudflareAnalyticsConfig(): CloudflareAnalyticsConfigState {
  const zoneId = readTrimmedEnv("CLOUDFLARE_ZONE_ID");
  const apiToken = readTrimmedEnv("CLOUDFLARE_ANALYTICS_API_TOKEN");
  const hostname = readTrimmedEnv("CLOUDFLARE_ANALYTICS_HOSTNAME");

  if (!zoneId || !apiToken || !hostname) {
    return { configured: false, reason: "missing-credentials" };
  }

  return {
    configured: true,
    zoneId,
    apiToken,
    hostname,
  };
}

export function isCloudflareAnalyticsConfigured(): boolean {
  return getCloudflareAnalyticsConfig().configured;
}
```

- [ ] **Step 6: Implement analytics client**

Create `src/lib/cloudflare/analytics-client.ts` with `server-only`, the GraphQL endpoint, safe error returns, and mapping helpers. Use this query shape:

```ts
const CLOUDFLARE_GRAPHQL_ENDPOINT =
  "https://api.cloudflare.com/client/v4/graphql";

const TRAFFIC_QUERY = `
query TrafficDashboard($zoneTag: string!, $hostname: string!, $since: Time!, $until: Time!) {
  viewer {
    zones(filter: { zoneTag: $zoneTag }) {
      totals: httpRequestsAdaptiveGroups(
        limit: 1
        filter: { datetime_geq: $since, datetime_leq: $until, clientRequestHTTPHost: $hostname }
      ) {
        sum { requests bytes }
        uniq { uniques }
      }
      hourly: httpRequestsAdaptiveGroups(
        limit: 168
        filter: { datetime_geq: $since, datetime_leq: $until, clientRequestHTTPHost: $hostname }
        orderBy: [datetimeHour_ASC]
      ) {
        dimensions { datetimeHour }
        sum { requests bytes }
        uniq { uniques }
      }
      topPaths: httpRequestsAdaptiveGroups(
        limit: 10
        filter: { datetime_geq: $since, datetime_leq: $until, clientRequestHTTPHost: $hostname }
        orderBy: [sum_requests_DESC]
      ) {
        dimensions { clientRequestPath }
        sum { requests }
      }
      topCountries: httpRequestsAdaptiveGroups(
        limit: 10
        filter: { datetime_geq: $since, datetime_leq: $until, clientRequestHTTPHost: $hostname }
        orderBy: [sum_requests_DESC]
      ) {
        dimensions { clientCountryName }
        sum { requests }
      }
      statusCodes: httpRequestsAdaptiveGroups(
        limit: 20
        filter: { datetime_geq: $since, datetime_leq: $until, clientRequestHTTPHost: $hostname }
        orderBy: [sum_requests_DESC]
      ) {
        dimensions { edgeResponseStatus }
        sum { requests }
      }
    }
  }
}
`;
```

The exported function must have this signature:

```ts
export async function fetchCloudflareTrafficSummary(input: {
  zoneId: string;
  apiToken: string;
  hostname: string;
  now?: Date;
}): Promise<CloudflareTrafficDashboardState>
```

Use a seven-day window:

```ts
const until = input.now ?? new Date();
const since = new Date(until.getTime() - 7 * 24 * 60 * 60 * 1000);
```

Do not include response body text in returned errors.

- [ ] **Step 7: Implement cache**

Create `src/lib/cloudflare/analytics-cache.ts`:

```ts
import "server-only";

import type { CloudflareTrafficDashboardState } from "./analytics-types";

const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  expiresAt: number;
  value: CloudflareTrafficDashboardState;
}

const cache = new Map<string, CacheEntry>();

export async function getCachedCloudflareTrafficSummary(input: {
  cacheKey: string;
  nowMs?: number;
  loader: () => Promise<CloudflareTrafficDashboardState>;
}): Promise<CloudflareTrafficDashboardState> {
  const nowMs = input.nowMs ?? Date.now();
  const existing = cache.get(input.cacheKey);

  if (existing && existing.expiresAt > nowMs) {
    return existing.value;
  }

  const value = await input.loader();
  cache.set(input.cacheKey, {
    value,
    expiresAt: nowMs + CACHE_TTL_MS,
  });
  return value;
}

export function clearCloudflareAnalyticsCache(): void {
  cache.clear();
}
```

- [ ] **Step 8: Run tests to verify pass**

Run:

```bash
pnpm exec vitest run src/lib/cloudflare/__tests__/analytics-config.test.ts src/lib/cloudflare/__tests__/analytics-client.test.ts src/lib/cloudflare/__tests__/analytics-cache.test.ts
pnpm type-check
```

Expected: both commands exit 0.

- [ ] **Step 9: Commit**

```bash
git add src/lib/cloudflare/analytics-types.ts src/lib/cloudflare/analytics-config.ts src/lib/cloudflare/analytics-client.ts src/lib/cloudflare/analytics-cache.ts src/lib/cloudflare/__tests__/analytics-config.test.ts src/lib/cloudflare/__tests__/analytics-client.test.ts src/lib/cloudflare/__tests__/analytics-cache.test.ts
git commit -m "feat: add cloudflare analytics client"
```

---

## Task 7: Owner access gate for `/ops/traffic`

**Files:**

- Create: `src/lib/ops/access-cookie.ts`
- Test: `src/lib/ops/__tests__/access-cookie.test.ts`
- Create: `src/app/ops/traffic/access/route.ts`
- Test: `src/app/ops/traffic/access/__tests__/route.test.ts`

- [ ] **Step 1: Write failing cookie tests**

Create `src/lib/ops/__tests__/access-cookie.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  createOpsAccessCookieValue,
  verifyOpsAccessCookieValue,
} from "../access-cookie";

describe("ops access cookie", () => {
  it("verifies a fresh signed cookie", async () => {
    const value = await createOpsAccessCookieValue({
      secret: "x".repeat(32),
      nowMs: 1_000,
    });

    await expect(
      verifyOpsAccessCookieValue({
        cookieValue: value,
        secret: "x".repeat(32),
        nowMs: 1_000,
      }),
    ).resolves.toBe(true);
  });

  it("rejects tampered and expired cookies", async () => {
    const value = await createOpsAccessCookieValue({
      secret: "x".repeat(32),
      nowMs: 1_000,
    });

    await expect(
      verifyOpsAccessCookieValue({
        cookieValue: `${value}tampered`,
        secret: "x".repeat(32),
        nowMs: 1_000,
      }),
    ).resolves.toBe(false);

    await expect(
      verifyOpsAccessCookieValue({
        cookieValue: value,
        secret: "x".repeat(32),
        nowMs: 1_000 + 13 * 60 * 60 * 1000,
      }),
    ).resolves.toBe(false);
  });
});
```

- [ ] **Step 2: Write failing route tests**

Create `src/app/ops/traffic/access/__tests__/route.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

import { POST } from "../route";

describe("ops traffic access route", () => {
  it("sets a signed cookie for the correct access key", async () => {
    vi.stubEnv("OPS_DASHBOARD_ACCESS_KEY", "owner-access-key-123456");
    const form = new FormData();
    form.set("accessKey", "owner-access-key-123456");

    const response = await POST(new Request("http://localhost/ops/traffic/access", {
      method: "POST",
      body: form,
    }));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/ops/traffic");
    expect(response.headers.get("set-cookie")).toContain("ops_traffic_access=");
  });

  it("does not reveal data or set a success cookie for a wrong key", async () => {
    vi.stubEnv("OPS_DASHBOARD_ACCESS_KEY", "owner-access-key-123456");
    const form = new FormData();
    form.set("accessKey", "wrong");

    const response = await POST(new Request("http://localhost/ops/traffic/access", {
      method: "POST",
      body: form,
    }));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/ops/traffic?access=denied");
    expect(response.headers.get("set-cookie")).not.toContain("owner-access-key");
  });
});
```

- [ ] **Step 3: Run tests to verify failure**

Run:

```bash
pnpm exec vitest run src/lib/ops/__tests__/access-cookie.test.ts src/app/ops/traffic/access/__tests__/route.test.ts
```

Expected: FAIL because modules do not exist.

- [ ] **Step 4: Implement signed cookie helpers**

Create `src/lib/ops/access-cookie.ts`:

```ts
import "server-only";

const COOKIE_MAX_AGE_MS = 12 * 60 * 60 * 1000;

function toBase64Url(bytes: ArrayBuffer): string {
  return Buffer.from(bytes)
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

async function sign(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return toBase64Url(signature);
}

export async function createOpsAccessCookieValue(input: {
  secret: string;
  nowMs?: number;
}): Promise<string> {
  const issuedAt = String(input.nowMs ?? Date.now());
  const signature = await sign(input.secret, issuedAt);
  return `${issuedAt}.${signature}`;
}

export async function verifyOpsAccessCookieValue(input: {
  cookieValue: string | undefined;
  secret: string | undefined;
  nowMs?: number;
}): Promise<boolean> {
  if (!input.cookieValue || !input.secret) {
    return false;
  }

  const [issuedAt, signature] = input.cookieValue.split(".");
  if (!issuedAt || !signature) {
    return false;
  }

  const issuedAtMs = Number(issuedAt);
  if (!Number.isFinite(issuedAtMs)) {
    return false;
  }

  const nowMs = input.nowMs ?? Date.now();
  if (nowMs - issuedAtMs > COOKIE_MAX_AGE_MS) {
    return false;
  }

  const expected = await sign(input.secret, issuedAt);
  return expected === signature;
}
```

- [ ] **Step 5: Implement access route**

Create `src/app/ops/traffic/access/route.ts`:

```ts
import { NextResponse } from "next/server";

import { getRuntimeEnvString, isRuntimeProduction } from "@/lib/env";
import { createOpsAccessCookieValue } from "@/lib/ops/access-cookie";

const COOKIE_NAME = "ops_traffic_access";

function redirectTo(path: string) {
  return NextResponse.redirect(new URL(path, "http://localhost"), 303);
}

export async function POST(request: Request) {
  const secret = getRuntimeEnvString("OPS_DASHBOARD_ACCESS_KEY");
  const form = await request.formData();
  const accessKey = String(form.get("accessKey") ?? "");

  if (!secret || accessKey !== secret) {
    const response = redirectTo("/ops/traffic?access=denied");
    response.cookies.delete(COOKIE_NAME);
    return response;
  }

  const response = redirectTo("/ops/traffic");
  response.cookies.set({
    name: COOKIE_NAME,
    value: await createOpsAccessCookieValue({ secret }),
    httpOnly: true,
    sameSite: "strict",
    secure: isRuntimeProduction(),
    path: "/ops/traffic",
    maxAge: 12 * 60 * 60,
  });
  return response;
}
```

- [ ] **Step 6: Run tests to verify pass**

Run:

```bash
pnpm exec vitest run src/lib/ops/__tests__/access-cookie.test.ts src/app/ops/traffic/access/__tests__/route.test.ts
pnpm type-check
```

Expected: both commands exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/lib/ops/access-cookie.ts src/lib/ops/__tests__/access-cookie.test.ts src/app/ops/traffic/access/route.ts src/app/ops/traffic/access/__tests__/route.test.ts
git commit -m "feat: add ops dashboard access gate"
```

---

## Task 8: Owner traffic dashboard page

**Files:**

- Create: `src/app/ops/traffic/page.tsx`
- Test: `src/app/ops/traffic/__tests__/page.test.tsx`
- Modify: `src/middleware.ts`
- Modify: `tests/unit/middleware.test.ts`

- [ ] **Step 1: Write failing page tests**

Create `src/app/ops/traffic/__tests__/page.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import OpsTrafficPage from "../page";

vi.mock("@/lib/cloudflare/analytics-config", () => ({
  getCloudflareAnalyticsConfig: vi.fn(() => ({
    configured: false,
    reason: "missing-credentials",
  })),
}));

describe("OpsTrafficPage", () => {
  it("shows a safe unconfigured state without secrets", async () => {
    const page = await OpsTrafficPage();

    render(page);

    expect(screen.getByText("Traffic dashboard is not configured")).toBeInTheDocument();
    expect(screen.queryByText(/CLOUDFLARE_ANALYTICS_API_TOKEN/u)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Add middleware test for `/ops/traffic`**

In `tests/unit/middleware.test.ts`, add:

```ts
it("does not locale-redirect owner ops dashboard routes", () => {
  expect(config.matcher).toContain("/((?!api|_next|_vercel|admin|ops|.*\\..*).*)");
});
```

- [ ] **Step 3: Run tests to verify failure**

Run:

```bash
pnpm exec vitest run src/app/ops/traffic/__tests__/page.test.tsx tests/unit/middleware.test.ts
```

Expected: FAIL because the page does not exist and matcher still includes ops.

- [ ] **Step 4: Implement dashboard page**

Create `src/app/ops/traffic/page.tsx`:

```tsx
import { cookies } from "next/headers";

import { getCloudflareAnalyticsConfig } from "@/lib/cloudflare/analytics-config";
import { fetchCloudflareTrafficSummary } from "@/lib/cloudflare/analytics-client";
import { getCachedCloudflareTrafficSummary } from "@/lib/cloudflare/analytics-cache";
import type { CloudflareTrafficDashboardData } from "@/lib/cloudflare/analytics-types";
import { getRuntimeEnvString } from "@/lib/env";
import { verifyOpsAccessCookieValue } from "@/lib/ops/access-cookie";

const COOKIE_NAME = "ops_traffic_access";

function UnconfiguredState() {
  return (
    <main className="mx-auto max-w-[960px] px-6 py-16">
      <h1 className="text-3xl font-bold">Traffic dashboard</h1>
      <p className="mt-4 rounded-lg border p-4 text-sm text-muted-foreground">
        Traffic dashboard is not configured. Add Cloudflare analytics
        credentials on the server to enable real traffic data.
      </p>
    </main>
  );
}

function AccessForm({ denied }: { denied: boolean }) {
  return (
    <main className="mx-auto max-w-[480px] px-6 py-16">
      <h1 className="text-3xl font-bold">Owner traffic dashboard</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Enter the owner access key to view Cloudflare traffic data.
      </p>
      {denied ? (
        <p className="mt-4 rounded-lg border border-destructive p-3 text-sm">
          Access key was not accepted.
        </p>
      ) : null}
      <form className="mt-6 grid gap-3" method="post" action="/ops/traffic/access">
        <label className="text-sm font-medium" htmlFor="accessKey">
          Access key
        </label>
        <input
          id="accessKey"
          name="accessKey"
          type="password"
          className="rounded-md border px-3 py-2"
          autoComplete="current-password"
        />
        <button className="rounded-md bg-primary px-4 py-2 text-primary-foreground">
          View dashboard
        </button>
      </form>
    </main>
  );
}

function Dashboard({ data }: { data: CloudflareTrafficDashboardData }) {
  return (
    <main className="mx-auto max-w-[1080px] px-6 py-16">
      <p className="text-sm font-semibold uppercase tracking-[0.04em] text-primary">
        Cloudflare analytics
      </p>
      <h1 className="mt-3 text-3xl font-bold">Owner traffic dashboard</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Hostname: {data.hostname}. Last updated: {data.lastUpdated}.
      </p>
      <dl className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-xl border p-4">
          <dt className="text-sm text-muted-foreground">Visits in the last 7 days</dt>
          <dd className="mt-2 text-2xl font-bold">{data.summary.visits}</dd>
        </div>
        <div className="rounded-xl border p-4">
          <dt className="text-sm text-muted-foreground">Requests</dt>
          <dd className="mt-2 text-2xl font-bold">{data.summary.requests}</dd>
        </div>
        <div className="rounded-xl border p-4">
          <dt className="text-sm text-muted-foreground">Bandwidth</dt>
          <dd className="mt-2 text-2xl font-bold">{data.summary.bandwidthBytes}</dd>
        </div>
        <div className="rounded-xl border p-4">
          <dt className="text-sm text-muted-foreground">Error rate</dt>
          <dd className="mt-2 text-2xl font-bold">
            {(data.summary.errorRate * 100).toFixed(2)}%
          </dd>
        </div>
      </dl>
    </main>
  );
}

export default async function OpsTrafficPage({
  searchParams,
}: {
  searchParams?: Promise<{ access?: string }>;
} = {}) {
  const config = getCloudflareAnalyticsConfig();
  if (!config.configured) {
    return <UnconfiguredState />;
  }

  const cookieStore = await cookies();
  const accessCookie = cookieStore.get(COOKIE_NAME)?.value;
  const hasAccess = await verifyOpsAccessCookieValue({
    cookieValue: accessCookie,
    secret: getRuntimeEnvString("OPS_DASHBOARD_ACCESS_KEY"),
  });

  if (!hasAccess) {
    const params = searchParams ? await searchParams : {};
    return <AccessForm denied={params.access === "denied"} />;
  }

  const data = await getCachedCloudflareTrafficSummary({
    cacheKey: config.hostname,
    loader: () => fetchCloudflareTrafficSummary(config),
  });

  if (!data.configured) {
    return <UnconfiguredState />;
  }

  return <Dashboard data={data} />;
}
```

- [ ] **Step 5: Exclude ops from middleware matcher**

Update `src/middleware.ts`:

```ts
export const config = {
  matcher: ["/api/health", "/", "/((?!api|_next|_vercel|admin|ops|.*\\..*).*)"],
};
```

- [ ] **Step 6: Run focused tests**

Run:

```bash
pnpm exec vitest run src/app/ops/traffic/__tests__/page.test.tsx tests/unit/middleware.test.ts
pnpm type-check
```

Expected: both commands exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/app/ops/traffic/page.tsx src/app/ops/traffic/__tests__/page.test.tsx src/middleware.ts tests/unit/middleware.test.ts
git commit -m "feat: add owner cloudflare traffic dashboard"
```

---

## Task 9: Public launch truth and docs

**Files:**

- Modify: `docs/website/部署设置.md`
- Modify: `docs/website/quality-proof.md`
- Modify: `docs/website/新项目替换清单.md`
- Modify: `scripts/validate-production-config.ts`
- Modify: `tests/unit/scripts/validate-production-config.test.ts`

- [ ] **Step 1: Write failing launch guard test**

Add to `tests/unit/scripts/validate-production-config.test.ts`:

```ts
it("requires owner dashboard readiness in strict public launch mode", () => {
  const result = validateProductionConfig({
    APP_ENV: "preview",
    NODE_ENV: "production",
    PUBLIC_LAUNCH_STRICT: "true",
    PUBLIC_LAUNCH_LEGAL_CONTENT_REVIEWED: "true",
  });

  expect(result.errors).toEqual(
    expect.arrayContaining([
      expect.stringContaining("CLOUDFLARE_ANALYTICS_HOSTNAME"),
      expect.stringContaining("OPS_DASHBOARD_ACCESS_KEY"),
    ]),
  );
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
pnpm exec vitest run tests/unit/scripts/validate-production-config.test.ts
```

Expected: FAIL because analytics/dashboard launch checks are not implemented.

- [ ] **Step 3: Add validation checks**

In `scripts/validate-production-config.ts`, inside `validatePublicLaunchTrustContent`, add:

```ts
  validateRequiredEnv(
    target,
    env,
    "CLOUDFLARE_ANALYTICS_HOSTNAME",
    "the owner traffic dashboard must point at the public hostname before client launch",
  );
  validateRequiredEnv(
    target,
    env,
    "CLOUDFLARE_ZONE_ID",
    "the owner traffic dashboard needs the real Cloudflare zone before client launch",
  );
  validateRequiredEnv(
    target,
    env,
    "OPS_DASHBOARD_ACCESS_KEY",
    "the owner traffic dashboard must be protected before client launch",
  );
```

Do not require `CLOUDFLARE_ANALYTICS_API_TOKEN` in public launch content validation because strict launch checks may run in a CI context that does not expose production secrets. The runtime dashboard remains disabled without the token.

- [ ] **Step 4: Update deployment docs**

In `docs/website/部署设置.md`, add a Cloudflare analytics section with these exact env names:

```md
## Cloudflare analytics dashboard

The official demo path uses Cloudflare. The owner traffic dashboard reads real Cloudflare zone analytics server-side.

Required for `/ops/traffic`:

- `CLOUDFLARE_ZONE_ID`
- `CLOUDFLARE_ANALYTICS_API_TOKEN`
- `CLOUDFLARE_ANALYTICS_HOSTNAME`
- `OPS_DASHBOARD_ACCESS_KEY`

Recommended outer protection:

- Cloudflare Access on `/ops/*`

Do not put the API token in any `NEXT_PUBLIC_*` variable. If the required values are missing, the dashboard must show a safe unconfigured state.
```

- [ ] **Step 5: Update quality proof docs**

In `docs/website/quality-proof.md`, add a traffic dashboard proof subsection:

```md
### Owner traffic dashboard proof

`/ops/traffic` is an owner-only proof surface. It proves the deployed site can read real Cloudflare traffic data for the configured hostname.

Minimum proof:

- missing credentials show a safe unconfigured state;
- unauthorized visitors cannot see data;
- configured owner access shows Cloudflare analytics data;
- the API token is never rendered in HTML, browser JavaScript, logs, or `NEXT_PUBLIC_*`.

This proof does not prove sales quality, legal readiness, or form delivery.
```

- [ ] **Step 6: Update replacement checklist**

In `docs/website/新项目替换清单.md`, under deployment configuration, add:

```md
- Cloudflare analytics zone id, hostname, and server-only API token.
- Owner dashboard access key.
- Cloudflare Access policy for `/ops/*` when the site is deployed.
```

- [ ] **Step 7: Run tests and doc checks**

Run:

```bash
pnpm exec vitest run tests/unit/scripts/validate-production-config.test.ts
pnpm exec prettier --check docs/website/部署设置.md docs/website/quality-proof.md docs/website/新项目替换清单.md scripts/validate-production-config.ts tests/unit/scripts/validate-production-config.test.ts
```

Expected: both commands exit 0.

- [ ] **Step 8: Commit**

```bash
git add docs/website/部署设置.md docs/website/quality-proof.md docs/website/新项目替换清单.md scripts/validate-production-config.ts tests/unit/scripts/validate-production-config.test.ts
git commit -m "docs: add cloudflare traffic dashboard launch proof"
```

---

## Task 10: Final verification and PR readiness

**Files:**

- Review all changed files.
- No new files beyond the plan scope.

- [ ] **Step 1: Run focused test groups**

Run:

```bash
pnpm exec vitest run src/lib/cloudflare/__tests__/analytics-config.test.ts src/lib/cloudflare/__tests__/analytics-client.test.ts src/lib/cloudflare/__tests__/analytics-cache.test.ts src/lib/ops/__tests__/access-cookie.test.ts src/app/ops/traffic/access/__tests__/route.test.ts src/app/ops/traffic/__tests__/page.test.tsx src/components/sections/__tests__/starter-boundary-section.test.tsx src/components/sections/__tests__/homepage-cluster-contract.test.tsx 'src/app/[locale]/capabilities/__tests__/page.test.tsx' 'src/app/[locale]/how-it-works/__tests__/page.test.tsx' tests/unit/middleware.test.ts tests/architecture/env-boundary.test.ts tests/unit/scripts/validate-production-config.test.ts
```

Expected: all tests pass.

- [ ] **Step 2: Run public content and translation checks**

Run:

```bash
pnpm brand:check
pnpm content:check
pnpm validate:translations
pnpm website:content:readiness
pnpm website:review:client-boundary
```

Expected: all commands exit 0.

- [ ] **Step 3: Run broad local gates**

Run:

```bash
pnpm type-check
pnpm lint:check
pnpm test
pnpm build
pnpm build:cf
```

Expected: all commands exit 0. Run `pnpm build` and `pnpm build:cf` sequentially.

- [ ] **Step 4: Run Cloudflare topology guard when dependency alignment changed**

Run:

```bash
pnpm review:cf:official-compare:source
```

Expected: exits 0.

- [ ] **Step 5: Inspect final diff**

Run:

```bash
git status --short
git diff --stat main...HEAD
git diff --check
```

Expected:

- no untracked files outside the planned paths,
- `git diff --check` exits 0,
- no secrets or sample API tokens appear in the diff.

- [ ] **Step 6: Create PR**

Run:

```bash
git push -u origin docs/public-demo-starter-site-spec
gh pr create --base main --head docs/public-demo-starter-site-spec --title "Build public demo starter site foundation" --body "Implements the public demo starter site Phase 1 plan: Cloudflare-first positioning, starter boundary pages, owner-only Cloudflare traffic dashboard, and launch-truth documentation."
```

Expected: branch pushes and PR URL is returned.
