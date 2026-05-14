# Radix Stable Takeover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand Radix ownership to the safest high-value UI surfaces while keeping hero, product storytelling, proof sections, footer art direction, grid, and page layout under Tailwind plus project-owned tokens.

**Architecture:** Keep every Radix import behind `src/components/ui/*` wrappers. Use Radix Themes for form controls, status/callout, badge, and data-card wrappers only after governance explicitly approves each wrapper path; use Radix Primitives for interaction wrappers such as dropdown menu; keep risky static narrative surfaces local and document each exception.

**Tech Stack:** Next.js 16.2.6 App Router, React 19.2.6, TypeScript 6.0.3, Tailwind CSS 4.3.0, Radix Themes 3.3.0, Radix Primitives, next-intl 4.11.2, Vitest, Storybook, component governance, browser proof.

---

## Scope check

This plan implements `docs/superpowers/specs/2026-05-14-radix-stable-takeover-design.md`.

The work spans several UI families, so execute it as separate reviewable waves.
Each task below should end in a clean commit and a working repository. Do not
batch multiple tasks into one unreviewed UI rewrite.

## Files and responsibilities

### Governance and docs

- `scripts/starter-checks.js`
  - Owns direct Radix import restrictions and approved Radix Themes wrapper paths.
- `tests/unit/scripts/component-governance-check.test.ts`
  - Proves the governance scanner accepts only approved UI wrappers.
- `docs/decisions/ADR-ui-foundation.md`
  - Durable owner-level UI foundation decision.
- `docs/decisions/radix-contact-form-pilot-result.md`
  - Current pilot result plus stable takeover status.
- `src/components/component-governance.registry.json`
  - Inventory of `src/components/ui/*` primitives and story requirements.

### Radix wrapper foundation

- `src/components/ui/radix-theme.tsx`
  - Single local entry for Radix Themes `Theme`.
  - Must support named surfaces without exposing Radix to business code.
- `src/components/ui/input.tsx`
  - General form input wrapper.
  - Textual controls become Radix-backed; file input remains native.
- `src/components/ui/textarea.tsx`
  - General textarea wrapper backed by Radix Themes.
- `src/components/ui/status-callout.tsx`
  - Reusable status panel for info, success, warning, and error.
- `src/components/ui/badge.tsx`
  - Reusable badge wrapper backed by Radix Themes.
- `src/components/ui/data-card.tsx`
  - Data/control card wrapper backed by Radix Themes.
- `src/components/ui/dropdown-menu.tsx`
  - Dropdown primitive wrapper backed by `@radix-ui/react-dropdown-menu`.

### Business surfaces to migrate

- `src/components/forms/contact-form-feedback.tsx`
  - Replace hand-styled status and error panels with `StatusCallout`.
- `src/components/contact/contact-form-island.tsx`
  - Replace lazy-load failure panel with `StatusCallout`.
- `src/components/contact/product-family-context-notice.tsx`
  - Replace product context notice with `StatusCallout`.
- `src/components/products/product-specs.tsx`
  - Use `DataCard` for product specification and trade data panels.
- `src/components/products/spec-table.tsx`
  - Keep table HTML, optionally wrap each group in `DataCard`.
- `src/app/[locale]/contact/contact-form-static-fallback.tsx`
  - Use `DataCard` for static fallback shell.
- `src/components/content/about-page-shell.tsx`
  - Use `DataCard` only for reusable information cards, not narrative layout.
- `src/components/layout/header-language-menu.tsx`
  - Replace custom menu state with `DropdownMenu` wrapper if tests prove keyboard and path behavior stay intact.

### Intentional local exceptions

- Contact checkboxes stay native until a separate checkbox spike proves `FormData`, no-JS fallback, label-click behavior, and existing E2E locators.
- `src/components/sections/faq-accordion.tsx` stays native `<details>/<summary>` in this wave because current tests require it to avoid client JavaScript.
- `src/components/ui/card.tsx` stays local for narrative cards.
- `src/components/ui/separator.tsx` stays local unless a later task proves a Radix-backed separator does not add client cost.

---

## Task 1: Expand governance for stable Radix wrapper paths

**Files:**
- Modify: `tests/unit/scripts/component-governance-check.test.ts`
- Modify: `scripts/starter-checks.js`
- Modify: `docs/decisions/radix-contact-form-pilot-result.md`

- [ ] **Step 1: Write the failing governance test for newly approved Radix Themes UI wrappers**

In `tests/unit/scripts/component-governance-check.test.ts`, replace the existing
test named `allows Radix Themes imports inside approved UI wrappers` with this
complete test:

```ts
  it("allows Radix Themes imports inside approved stable UI wrappers", () => {
    const rootDir = createFixture({
      "src/components/component-governance.registry.json": registry({
        badge: { story: "required" },
        "data-card": { story: "required" },
        input: { story: "required" },
        "radix-theme": { story: "required" },
        "status-callout": { story: "required" },
        textarea: { story: "required" },
      }),
      "src/components/ui/radix-theme.tsx":
        'import { Theme } from "@radix-ui/themes";\nexport function RadixThemePilot({ children }: { children: React.ReactNode }) { return <Theme>{children}</Theme>; }',
      "src/components/ui/radix-theme.stories.tsx":
        "export default { title: 'UI/RadixThemePilot' };",
      "src/components/ui/input.tsx":
        'import { TextField } from "@radix-ui/themes";\nexport function Input() { return <TextField.Root />; }',
      "src/components/ui/input.stories.tsx":
        "export default { title: 'UI/Input' };",
      "src/components/ui/textarea.tsx":
        'import { TextArea } from "@radix-ui/themes";\nexport function Textarea() { return <TextArea />; }',
      "src/components/ui/textarea.stories.tsx":
        "export default { title: 'UI/Textarea' };",
      "src/components/ui/status-callout.tsx":
        'import { Callout } from "@radix-ui/themes";\nexport function StatusCallout() { return <Callout.Root />; }',
      "src/components/ui/status-callout.stories.tsx":
        "export default { title: 'UI/StatusCallout' };",
      "src/components/ui/badge.tsx":
        'import { Badge } from "@radix-ui/themes";\nexport function LocalBadge() { return <Badge />; }',
      "src/components/ui/badge.stories.tsx":
        "export default { title: 'UI/Badge' };",
      "src/components/ui/data-card.tsx":
        'import { Card } from "@radix-ui/themes";\nexport function DataCard() { return <Card />; }',
      "src/components/ui/data-card.stories.tsx":
        "export default { title: 'UI/DataCard' };",
    });
    fixtureRoots.push(rootDir);

    const result = collectComponentGovernanceFindings(rootDir);

    expect(result.status).toBe("passed");
    expect(result.errors).toEqual([]);
  });
```

- [ ] **Step 2: Run the test and confirm it fails**

Run:

```bash
pnpm exec vitest run tests/unit/scripts/component-governance-check.test.ts -t "approved stable UI wrappers"
```

Expected:

- FAIL with `radix-themes-import-unapproved-ui-wrapper` for at least
  `src/components/ui/input.tsx`.

- [ ] **Step 3: Expand the approved wrapper set**

In `scripts/starter-checks.js`, replace
`COMPONENT_GOVERNANCE_RADIX_THEMES_APPROVED_WRAPPERS` with this complete set:

```js
const COMPONENT_GOVERNANCE_RADIX_THEMES_APPROVED_WRAPPERS = new Set([
  "src/components/ui/radix-theme.tsx",
  "src/components/ui/contact-form-shell.tsx",
  "src/components/ui/contact-form-control.tsx",
  "src/components/ui/input.tsx",
  "src/components/ui/textarea.tsx",
  "src/components/ui/status-callout.tsx",
  "src/components/ui/badge.tsx",
  "src/components/ui/data-card.tsx",
]);
```

- [ ] **Step 4: Update the pilot result with the stable takeover entry point**

Append this section to `docs/decisions/radix-contact-form-pilot-result.md` after
the existing `## Gate result` section:

```md

## Stable takeover follow-up

The Contact form controls pilot is the first proven Radix Themes surface. The
next approved direction is a staged stable takeover for low-risk control and
data surfaces, tracked in
`docs/superpowers/specs/2026-05-14-radix-stable-takeover-design.md`.

This follow-up does not approve full-site Radix Themes usage. The allowed
expansion remains limited to local `src/components/ui/*` wrappers for form
controls, status callouts, badges, and data/control cards. Hero, product
storytelling, proof sections, footer art direction, grid, and page layout remain
outside Radix Themes.
```

- [ ] **Step 5: Run focused governance checks**

Run:

```bash
pnpm exec vitest run tests/unit/scripts/component-governance-check.test.ts
pnpm component:governance
```

Expected:

- Vitest file passes.
- Component governance passes with no errors.

- [ ] **Step 6: Commit**

Run:

```bash
git add tests/unit/scripts/component-governance-check.test.ts scripts/starter-checks.js docs/decisions/radix-contact-form-pilot-result.md
git commit -m "chore: approve stable radix wrapper paths"
```

---

## Task 2: Extend the Radix theme wrapper with named surfaces

**Files:**
- Modify: `src/components/ui/radix-theme.tsx`
- Modify: `src/components/ui/__tests__/radix-theme.test.tsx`
- Modify: `src/components/ui/radix-theme.stories.tsx`

- [ ] **Step 1: Add failing tests for named surfaces**

Append these tests to `src/components/ui/__tests__/radix-theme.test.tsx`:

```tsx
  it("keeps the Contact form surface as the default marker", () => {
    render(
      <RadixThemePilot>
        <span>Contact surface</span>
      </RadixThemePilot>,
    );

    expect(screen.getByTestId("radix-theme-pilot")).toHaveAttribute(
      "data-ui-pilot",
      "radix-themes-contact-form",
    );
  });

  it("accepts a named stable takeover surface", () => {
    render(
      <RadixThemePilot surface="status-callout">
        <span>Status surface</span>
      </RadixThemePilot>,
    );

    expect(screen.getByTestId("radix-theme-pilot")).toHaveAttribute(
      "data-ui-pilot",
      "radix-themes-status-callout",
    );
  });
```

- [ ] **Step 2: Run the tests and confirm the second test fails**

Run:

```bash
pnpm exec vitest run src/components/ui/__tests__/radix-theme.test.tsx
```

Expected:

- FAIL because `RadixThemePilot` does not accept `surface`.

- [ ] **Step 3: Replace `src/components/ui/radix-theme.tsx` with this implementation**

```tsx
import { Theme } from "@radix-ui/themes";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

type ThemeProps = ComponentProps<typeof Theme>;

export type RadixThemePilotSurface =
  | "contact-form"
  | "form-control"
  | "status-callout"
  | "badge"
  | "data-card";

export interface RadixThemePilotProps {
  children: ReactNode;
  className?: string;
  surface?: RadixThemePilotSurface;
}

export function RadixThemePilot({
  children,
  className,
  surface = "contact-form",
}: RadixThemePilotProps) {
  return (
    <Theme
      accentColor="blue"
      appearance="inherit"
      className={cn("showcase-radix-theme-pilot", className)}
      data-testid="radix-theme-pilot"
      data-ui-pilot={`radix-themes-${surface}`}
      grayColor="slate"
      hasBackground={false}
      panelBackground="solid"
      radius="large"
      scaling="100%"
    >
      {children}
    </Theme>
  );
}

export type RadixThemePilotAppearance = ThemeProps["appearance"];
```

- [ ] **Step 4: Update the Storybook story**

In `src/components/ui/radix-theme.stories.tsx`, add this story after
`ContactSurface`:

```tsx
export const StatusSurface: Story = {
  args: {
    surface: "status-callout",
    children: (
      <div className="w-80 rounded-lg border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">
          Named surfaces make the Radix takeover reviewable without exposing
          Radix package imports to business code.
        </p>
      </div>
    ),
  },
};
```

- [ ] **Step 5: Run tests**

Run:

```bash
pnpm exec vitest run src/components/ui/__tests__/radix-theme.test.tsx
pnpm component:governance
```

Expected:

- Radix theme tests pass.
- Component governance passes.

- [ ] **Step 6: Commit**

Run:

```bash
git add src/components/ui/radix-theme.tsx src/components/ui/__tests__/radix-theme.test.tsx src/components/ui/radix-theme.stories.tsx
git commit -m "feat: name radix takeover surfaces"
```

---

## Task 3: Make general text input and textarea Radix-backed

**Files:**
- Modify: `src/components/ui/input.tsx`
- Modify: `src/components/ui/textarea.tsx`
- Modify: `src/components/ui/__tests__/input.test.tsx`
- Create: `src/components/ui/__tests__/textarea.test.tsx`

- [ ] **Step 1: Add failing assertions for Radix-backed text fields**

In `src/components/ui/__tests__/input.test.tsx`, add this test after the first
rendering test:

```tsx
  it("renders textual inputs inside the Radix form-control surface", () => {
    render(
      <Input
        id="email"
        name="email"
        type="email"
        placeholder="Business email"
        data-testid="input"
      />,
    );

    const input = screen.getByTestId("input");
    expect(input).toHaveAttribute("id", "email");
    expect(input).toHaveAttribute("name", "email");
    expect(input).toHaveAttribute("type", "email");
    expect(input.closest("[data-ui-pilot='radix-themes-form-control']")).not.toBeNull();
  });
```

Create `src/components/ui/__tests__/textarea.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Textarea } from "@/components/ui/textarea";

describe("Textarea", () => {
  it("renders inside the Radix form-control surface and forwards attributes", () => {
    render(
      <Textarea
        id="message"
        name="message"
        placeholder="Message"
        rows={5}
        required
        disabled
        aria-describedby="message-error"
        data-testid="textarea"
      />,
    );

    const textarea = screen.getByTestId("textarea");
    expect(textarea).toHaveAttribute("id", "message");
    expect(textarea).toHaveAttribute("name", "message");
    expect(textarea).toHaveAttribute("rows", "5");
    expect(textarea).toBeRequired();
    expect(textarea).toBeDisabled();
    expect(textarea).toHaveAttribute("aria-describedby", "message-error");
    expect(
      textarea.closest("[data-ui-pilot='radix-themes-form-control']"),
    ).not.toBeNull();
  });

  it("keeps native textarea typing behavior", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <Textarea
        name="message"
        placeholder="Message"
        onChange={handleChange}
      />,
    );

    const textarea = screen.getByPlaceholderText("Message");
    await user.type(textarea, "Need a quote");

    expect(textarea).toHaveValue("Need a quote");
    expect(handleChange).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the focused tests and confirm failure**

Run:

```bash
pnpm exec vitest run src/components/ui/__tests__/input.test.tsx src/components/ui/__tests__/textarea.test.tsx
```

Expected:

- FAIL because `Input` and `Textarea` are not yet Radix-backed.

- [ ] **Step 3: Replace `src/components/ui/input.tsx` with this implementation**

```tsx
import { TextField } from "@radix-ui/themes";
import type { ComponentPropsWithoutRef } from "react";
import { RadixThemePilot } from "@/components/ui/radix-theme";
import { cn } from "@/lib/utils";

type NativeInputProps = ComponentPropsWithoutRef<"input">;
type TextualInputType =
  | "date"
  | "datetime-local"
  | "email"
  | "hidden"
  | "month"
  | "number"
  | "password"
  | "search"
  | "tel"
  | "text"
  | "time"
  | "url"
  | "week";

interface InputProps extends Omit<NativeInputProps, "children" | "color" | "size"> {
  type?: NativeInputProps["type"];
}

const TEXTUAL_INPUT_TYPES = new Set<string>([
  "date",
  "datetime-local",
  "email",
  "hidden",
  "month",
  "number",
  "password",
  "search",
  "tel",
  "text",
  "time",
  "url",
  "week",
]);

const NATIVE_INPUT_CLASS_NAME =
  "flex h-10 w-full min-w-0 rounded-xl border border-input bg-transparent px-4 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40";

function isTextualInputType(type: NativeInputProps["type"]): type is TextualInputType {
  return type === undefined || TEXTUAL_INPUT_TYPES.has(type);
}

function Input({ className, type = "text", ...props }: InputProps) {
  if (!isTextualInputType(type)) {
    return (
      <input
        type={type}
        data-slot="input"
        className={cn(NATIVE_INPUT_CLASS_NAME, className)}
        {...props}
      />
    );
  }

  const textFieldProps = props as Omit<
    ComponentPropsWithoutRef<typeof TextField.Root>,
    "children" | "color" | "size" | "type"
  >;

  return (
    <RadixThemePilot className="contents" surface="form-control">
      <TextField.Root
        data-slot="input"
        className={cn("w-full", className)}
        radius="large"
        size="3"
        type={type}
        variant="surface"
        {...textFieldProps}
      />
    </RadixThemePilot>
  );
}

export { Input };
```

- [ ] **Step 4: Replace `src/components/ui/textarea.tsx` with this implementation**

```tsx
import { TextArea as RadixTextArea } from "@radix-ui/themes";
import type { ComponentPropsWithoutRef } from "react";
import { RadixThemePilot } from "@/components/ui/radix-theme";
import { cn } from "@/lib/utils";

type TextareaProps = Omit<
  ComponentPropsWithoutRef<"textarea">,
  "children" | "color" | "size" | "value"
> & {
  value?: string;
};

function Textarea({ className, rows = 4, ...props }: TextareaProps) {
  return (
    <RadixThemePilot className="contents" surface="form-control">
      <RadixTextArea
        className={cn("w-full", className)}
        data-slot="textarea"
        radius="large"
        resize="vertical"
        rows={rows}
        size="3"
        variant="surface"
        {...props}
      />
    </RadixThemePilot>
  );
}

export { Textarea };
```

- [ ] **Step 5: Update brittle class assertions in `input.test.tsx`**

Replace assertions that expect `h-10`, `rounded-xl`, `border`, or
`custom-input` directly on the textual `<input>` with assertions against the
nearest Radix surface:

```tsx
expect(input.closest("[data-ui-pilot='radix-themes-form-control']")).not.toBeNull();
```

Keep the file-input test because non-textual file input remains native and must
still expose file styling classes.

- [ ] **Step 6: Run focused UI tests**

Run:

```bash
pnpm exec vitest run src/components/ui/__tests__/input.test.tsx src/components/ui/__tests__/textarea.test.tsx src/components/ui/__tests__/contact-form-control.test.tsx src/components/forms/__tests__/contact-form-fields-core.test.tsx
```

Expected:

- All focused tests pass.
- Contact form field names and disabled state remain intact.

- [ ] **Step 7: Run governance and type checks**

Run:

```bash
pnpm component:governance
pnpm type-check
```

Expected:

- Component governance passes.
- Type check passes.

- [ ] **Step 8: Commit**

Run:

```bash
git add src/components/ui/input.tsx src/components/ui/textarea.tsx src/components/ui/__tests__/input.test.tsx src/components/ui/__tests__/textarea.test.tsx
git commit -m "feat: make form controls radix backed"
```

---

## Task 4: Add StatusCallout and migrate form/status panels

**Files:**
- Create: `src/components/ui/status-callout.tsx`
- Create: `src/components/ui/status-callout.stories.tsx`
- Create: `src/components/ui/__tests__/status-callout.test.tsx`
- Modify: `src/components/component-governance.registry.json`
- Modify: `src/components/forms/contact-form-feedback.tsx`
- Modify: `src/components/contact/contact-form-island.tsx`
- Modify: `src/components/contact/product-family-context-notice.tsx`

- [ ] **Step 1: Write the failing StatusCallout test**

Create `src/components/ui/__tests__/status-callout.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusCallout } from "@/components/ui/status-callout";

describe("StatusCallout", () => {
  it("renders error state as an assertive alert inside a named Radix surface", () => {
    render(
      <StatusCallout title="Could not send" tone="error">
        Try again.
      </StatusCallout>,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Could not send");
    expect(alert).toHaveTextContent("Try again.");
    expect(alert).toHaveAttribute("aria-live", "assertive");
    expect(
      alert.closest("[data-ui-pilot='radix-themes-status-callout']"),
    ).not.toBeNull();
  });

  it("renders non-error state as polite status", () => {
    render(<StatusCallout tone="success">Saved.</StatusCallout>);

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Saved.");
    expect(status).toHaveAttribute("aria-live", "polite");
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run:

```bash
pnpm exec vitest run src/components/ui/__tests__/status-callout.test.tsx
```

Expected:

- FAIL because `src/components/ui/status-callout.tsx` does not exist.

- [ ] **Step 3: Create `src/components/ui/status-callout.tsx`**

```tsx
import { Callout } from "@radix-ui/themes";
import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { RadixThemePilot } from "@/components/ui/radix-theme";
import { cn } from "@/lib/utils";

export type StatusCalloutTone = "info" | "success" | "warning" | "error";

interface StatusCalloutProps
  extends Omit<ComponentPropsWithoutRef<"div">, "children" | "color" | "title"> {
  children: ReactNode;
  title?: ReactNode;
  tone?: StatusCalloutTone;
}

const TONE_CLASS_NAMES: Record<StatusCalloutTone, string> = {
  info: "border-[var(--info-border)] bg-[var(--info-muted)] text-[var(--info-foreground)]",
  success:
    "border-[var(--success-border)] bg-[var(--success-muted)] text-[var(--success-foreground)]",
  warning:
    "border-[var(--warning-border)] bg-[var(--warning-muted)] text-[var(--warning-foreground)]",
  error:
    "border-[var(--error-border)] bg-[var(--error-muted)] text-[var(--error-foreground)]",
};

const StatusCallout = forwardRef<HTMLDivElement, StatusCalloutProps>(
  ({ children, className, role, title, tone = "info", ...props }, ref) => {
    const resolvedRole = role ?? (tone === "error" ? "alert" : "status");
    const ariaLive = tone === "error" ? "assertive" : "polite";

    return (
      <RadixThemePilot className="contents" surface="status-callout">
        <Callout.Root
          ref={ref}
          className={cn("w-full border", TONE_CLASS_NAMES[tone], className)}
          role={resolvedRole}
          aria-live={ariaLive}
          size="2"
          variant="surface"
          {...props}
        >
          {title ? <p className="font-medium">{title}</p> : null}
          <div className="text-sm">{children}</div>
        </Callout.Root>
      </RadixThemePilot>
    );
  },
);

StatusCallout.displayName = "StatusCallout";

export { StatusCallout };
```

- [ ] **Step 4: Add Storybook coverage**

Create `src/components/ui/status-callout.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { StatusCallout } from "@/components/ui/status-callout";

const meta = {
  title: "UI/StatusCallout",
  component: StatusCallout,
  parameters: {
    layout: "centered",
  },
  args: {
    children: "We could not verify the request. Please try again.",
    title: "Verification unavailable",
    tone: "warning",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof StatusCallout>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Warning: Story = {};

export const Success: Story = {
  args: {
    children: "Your inquiry was received.",
    title: "Message sent",
    tone: "success",
  },
};

export const Error: Story = {
  args: {
    children: "Please review the highlighted fields.",
    title: "Submission failed",
    tone: "error",
  },
};
```

- [ ] **Step 5: Register the primitive**

In `src/components/component-governance.registry.json`, add:

```json
    "status-callout": {
      "story": "required"
    },
```

Keep the existing JSON ordering alphabetical around `social-icons` and
`textarea`.

- [ ] **Step 6: Migrate `StatusMessage` to `StatusCallout`**

In `src/components/forms/contact-form-feedback.tsx`:

1. Add this import:

```ts
import { StatusCallout, type StatusCalloutTone } from "@/components/ui/status-callout";
```

2. Replace `getStatusConfig` return type with:

```ts
): { message: string; tone: StatusCalloutTone } | undefined {
```

3. Replace the switch return objects with:

```ts
    case "success":
      return {
        message: t("submitSuccess"),
        tone: "success",
      };
    case "error":
      return {
        message: t("submitError"),
        tone: "error",
      };
    case "submitting":
      return {
        message: t("submitting"),
        tone: "info",
      };
```

4. Replace the `return` JSX in `StatusMessage` with:

```tsx
  return (
    <StatusCallout
      data-testid="contact-form-status-message"
      tone={config.tone}
      translate="no"
    >
      <span data-testid="contact-form-status-message-text" translate="no">
        {config.message}
      </span>
    </StatusCallout>
  );
```

- [ ] **Step 7: Migrate `ErrorDisplay` to `StatusCallout`**

In `src/components/forms/contact-form-feedback.tsx`, replace
`containerClass` in `ErrorDisplayState` and `getErrorDisplayState` with no
class field. Then replace the outer `div` in `ErrorDisplay` with:

```tsx
    <StatusCallout
      ref={containerRef}
      data-testid="contact-form-error-display"
      role="alert"
      tabIndex={-1}
      tone="error"
      title={
        <span data-testid="contact-form-error-heading" translate="no">
          {translateForm("error")}
        </span>
      }
      translate="no"
    >
      {shouldShowTranslatedMessage && (
        <p className="text-sm">{translatedError}</p>
      )}
      {shouldShowRawMessage && <p className="text-sm">{state.error}</p>}
      {uniqueDetails && uniqueDetails.length > 0 && (
        <ul className="mt-2 list-inside list-disc text-sm">
          {uniqueDetails.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      )}
    </StatusCallout>
```

- [ ] **Step 8: Migrate Contact form island failure**

In `src/components/contact/contact-form-island.tsx`, import `StatusCallout`:

```ts
import { StatusCallout } from "@/components/ui/status-callout";
```

Replace the failed-state wrapper with:

```tsx
    <StatusCallout tone="error">
      <p>{errorMessage}</p>
      <Button
        className="mt-4"
        onClick={() => dispatch({ type: "retry" })}
        size="sm"
        type="button"
        variant="outline"
      >
        {retryLabel}
      </Button>
    </StatusCallout>
```

- [ ] **Step 9: Migrate product family context notice**

In `src/components/contact/product-family-context-notice.tsx`, import
`StatusCallout` and replace the outer notice `div` with:

```tsx
    <StatusCallout
      className="mb-6"
      data-testid="product-family-context-notice"
      tone="info"
      title={label}
    >
      <p className="mt-1 text-sm text-muted-foreground">
        <span translate="no">{context.marketLabel}</span>
        {" / "}
        <span translate="no">{context.familyLabel}</span>
      </p>
    </StatusCallout>
```

- [ ] **Step 10: Run focused tests**

Run:

```bash
pnpm exec vitest run src/components/ui/__tests__/status-callout.test.tsx src/components/forms/__tests__/contact-form-container.test.tsx src/components/forms/__tests__/contact-form-fields-core.test.tsx
pnpm component:governance
pnpm type-check
```

Expected:

- Focused tests pass.
- Governance passes.
- Type check passes.

- [ ] **Step 11: Commit**

Run:

```bash
git add src/components/ui/status-callout.tsx src/components/ui/status-callout.stories.tsx src/components/ui/__tests__/status-callout.test.tsx src/components/component-governance.registry.json src/components/forms/contact-form-feedback.tsx src/components/contact/contact-form-island.tsx src/components/contact/product-family-context-notice.tsx
git commit -m "feat: add radix status callout"
```

---

## Task 5: Move Badge to a Radix-backed wrapper

**Files:**
- Modify: `src/components/ui/badge.tsx`
- Modify: `src/components/ui/__tests__/badge.test.tsx`
- Modify: `src/components/ui/badge.stories.tsx`

- [ ] **Step 1: Update tests for semantic span badge and Radix surface**

In `src/components/ui/__tests__/badge.test.tsx`, change the first test to
expect `SPAN` and a named surface:

```tsx
    expect(badge.tagName).toBe("SPAN");
    expect(badge.closest("[data-ui-pilot='radix-themes-badge']")).not.toBeNull();
```

Replace variant class assertions with semantic behavior assertions:

```tsx
  it.each(["default", "secondary", "destructive", "outline"] as const)(
    "renders %s variant through the local badge contract",
    (variant) => {
      render(<Badge variant={variant}>Variant</Badge>);

      const badge = screen.getByText("Variant");
      expect(badge).toHaveAttribute("data-slot", "badge");
      expect(badge.closest("[data-ui-pilot='radix-themes-badge']")).not.toBeNull();
    },
  );
```

- [ ] **Step 2: Run and confirm failure**

Run:

```bash
pnpm exec vitest run src/components/ui/__tests__/badge.test.tsx src/components/ui/__tests__/badge-accessibility.test.tsx
```

Expected:

- FAIL because current `Badge` renders a `div` and is not in a Radix surface.

- [ ] **Step 3: Replace `src/components/ui/badge.tsx`**

```tsx
import { Badge as RadixBadge } from "@radix-ui/themes";
import { forwardRef, type HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { RadixThemePilot } from "@/components/ui/radix-theme";
import { cn } from "@/lib/utils";

const badgeVariants = cva("", {
  variants: {
    variant: {
      default: "border-transparent",
      secondary: "border-transparent",
      destructive:
        "border-[var(--error-border)] bg-[var(--error-muted)] text-[var(--error-foreground)]",
      outline: "border-border bg-transparent text-foreground",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  autoComplete?: string;
  disabled?: boolean;
  form?: string;
  name?: string;
  value?: string;
}

const RADIX_BADGE_VARIANT = {
  default: "solid",
  secondary: "soft",
  destructive: "surface",
  outline: "outline",
} as const;

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = "default", ...props }, ref) => {
    return (
      <RadixThemePilot className="contents" surface="badge">
        <RadixBadge
          ref={ref}
          data-slot="badge"
          className={cn(badgeVariants({ variant }), className)}
          radius="full"
          size="2"
          variant={RADIX_BADGE_VARIANT[variant]}
          {...props}
        />
      </RadixThemePilot>
    );
  },
);

Badge.displayName = "Badge";

export { Badge, badgeVariants };
```

- [ ] **Step 4: Run focused badge and product tests**

Run:

```bash
pnpm exec vitest run src/components/ui/__tests__/badge.test.tsx src/components/ui/__tests__/badge-accessibility.test.tsx src/components/products
pnpm component:governance
pnpm type-check
```

Expected:

- Badge tests pass.
- Product tests that render certification badges pass.
- Governance and type check pass.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/components/ui/badge.tsx src/components/ui/__tests__/badge.test.tsx src/components/ui/badge.stories.tsx
git commit -m "feat: make badges radix backed"
```

---

## Task 6: Add DataCard and migrate data/spec surfaces

**Files:**
- Create: `src/components/ui/data-card.tsx`
- Create: `src/components/ui/data-card.stories.tsx`
- Create: `src/components/ui/__tests__/data-card.test.tsx`
- Modify: `src/components/component-governance.registry.json`
- Modify: `src/components/products/product-specs.tsx`
- Modify: `src/components/products/spec-table.tsx`
- Modify: `src/app/[locale]/contact/contact-form-static-fallback.tsx`
- Modify: `src/components/content/about-page-shell.tsx`

- [ ] **Step 1: Write the failing DataCard test**

Create `src/components/ui/__tests__/data-card.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  DataCard,
  DataCardContent,
  DataCardHeader,
  DataCardTitle,
} from "@/components/ui/data-card";

describe("DataCard", () => {
  it("renders data card slots inside the Radix data-card surface", () => {
    render(
      <DataCard data-testid="data-card">
        <DataCardHeader>
          <DataCardTitle>Specifications</DataCardTitle>
        </DataCardHeader>
        <DataCardContent>Rows</DataCardContent>
      </DataCard>,
    );

    const card = screen.getByTestId("data-card");
    expect(card).toHaveAttribute("data-slot", "data-card");
    expect(card).toHaveTextContent("Specifications");
    expect(card).toHaveTextContent("Rows");
    expect(card.closest("[data-ui-pilot='radix-themes-data-card']")).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run:

```bash
pnpm exec vitest run src/components/ui/__tests__/data-card.test.tsx
```

Expected:

- FAIL because `data-card.tsx` does not exist.

- [ ] **Step 3: Create `src/components/ui/data-card.tsx`**

```tsx
import { Card as RadixCard } from "@radix-ui/themes";
import type { ComponentPropsWithoutRef } from "react";
import { RadixThemePilot } from "@/components/ui/radix-theme";
import { cn } from "@/lib/utils";

type DataCardProps = ComponentPropsWithoutRef<"div">;

function DataCard({ className, ...props }: DataCardProps) {
  return (
    <RadixThemePilot className="contents" surface="data-card">
      <RadixCard
        data-slot="data-card"
        className={cn("w-full", className)}
        size="3"
        variant="surface"
        {...props}
      />
    </RadixThemePilot>
  );
}

function DataCardHeader({ className, ...props }: DataCardProps) {
  return (
    <div
      data-slot="data-card-header"
      className={cn("px-6 pt-6", className)}
      {...props}
    />
  );
}

function DataCardTitle({ className, ...props }: DataCardProps) {
  return (
    <div
      data-slot="data-card-title"
      className={cn("text-lg font-semibold leading-none", className)}
      {...props}
    />
  );
}

function DataCardDescription({ className, ...props }: DataCardProps) {
  return (
    <div
      data-slot="data-card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

function DataCardContent({ className, ...props }: DataCardProps) {
  return (
    <div
      data-slot="data-card-content"
      className={cn("px-6 pb-6", className)}
      {...props}
    />
  );
}

export {
  DataCard,
  DataCardContent,
  DataCardDescription,
  DataCardHeader,
  DataCardTitle,
};
```

- [ ] **Step 4: Add Storybook coverage**

Create `src/components/ui/data-card.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  DataCard,
  DataCardContent,
  DataCardHeader,
  DataCardTitle,
} from "@/components/ui/data-card";

const meta = {
  title: "UI/DataCard",
  component: DataCard,
  parameters: {
    layout: "centered",
  },
  render: () => (
    <DataCard className="w-[420px]">
      <DataCardHeader>
        <DataCardTitle>Specification surface</DataCardTitle>
      </DataCardHeader>
      <DataCardContent>
        <dl className="grid grid-cols-[1fr_2fr] gap-3 text-sm">
          <dt className="text-muted-foreground">Material</dt>
          <dd translate="no">Replaceable example value</dd>
          <dt className="text-muted-foreground">MOQ</dt>
          <dd translate="no">500 pieces</dd>
        </dl>
      </DataCardContent>
    </DataCard>
  ),
  tags: ["autodocs"],
} satisfies Meta<typeof DataCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
```

- [ ] **Step 5: Register the primitive**

In `src/components/component-governance.registry.json`, add:

```json
    "data-card": {
      "story": "required"
    },
```

- [ ] **Step 6: Migrate `product-specs.tsx`**

In `src/components/products/product-specs.tsx`, replace the `Card` import with:

```ts
import {
  DataCard,
  DataCardContent,
  DataCardHeader,
  DataCardTitle,
} from "@/components/ui/data-card";
```

Then replace `Card`, `CardHeader`, `CardTitle`, and `CardContent` usages with
`DataCard`, `DataCardHeader`, `DataCardTitle`, and `DataCardContent`.

- [ ] **Step 7: Migrate `spec-table.tsx` group wrapper**

In `src/components/products/spec-table.tsx`, import:

```ts
import { DataCard, DataCardContent } from "@/components/ui/data-card";
```

Replace `SpecGroupTable` return with:

```tsx
  return (
    <DataCard>
      <DataCardContent className="space-y-3">
        <h4 className="font-mono text-sm font-semibold text-muted-foreground">
          {group.groupLabel}
        </h4>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {group.columns.map((col) => (
                  <th
                    key={col}
                    className="px-4 py-3 text-left font-medium text-muted-foreground"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {group.rows.map((row, rowIdx) => (
                <SpecRow key={rowIdx} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      </DataCardContent>
    </DataCard>
  );
```

- [ ] **Step 8: Migrate static fallback and about information cards**

For `src/app/[locale]/contact/contact-form-static-fallback.tsx`, replace
`Card` with `DataCard` and preserve existing class names.

For `src/components/content/about-page-shell.tsx`, migrate only the reusable
information card helper that currently imports `Card` pieces. Do not migrate
page layout wrappers, hero-like composition, or narrative section shells.

- [ ] **Step 9: Run focused tests**

Run:

```bash
pnpm exec vitest run src/components/ui/__tests__/data-card.test.tsx src/components/products src/components/content/__tests__/about-page-shell.test.tsx
pnpm component:governance
pnpm type-check
```

Expected:

- DataCard tests pass.
- Product and about tests pass.
- Governance and type check pass.

- [ ] **Step 10: Commit**

Run:

```bash
git add src/components/ui/data-card.tsx src/components/ui/data-card.stories.tsx src/components/ui/__tests__/data-card.test.tsx src/components/component-governance.registry.json src/components/products/product-specs.tsx src/components/products/spec-table.tsx 'src/app/[locale]/contact/contact-form-static-fallback.tsx' src/components/content/about-page-shell.tsx
git commit -m "feat: add radix data card surfaces"
```

---

## Task 7: Add DropdownMenu wrapper and migrate the language menu

**Files:**
- Create: `src/components/ui/dropdown-menu.tsx`
- Create: `src/components/ui/dropdown-menu.stories.tsx`
- Create: `src/components/ui/__tests__/dropdown-menu.test.tsx`
- Modify: `src/components/component-governance.registry.json`
- Modify: `src/components/layout/header-language-menu.tsx`
- Modify: `src/components/layout/__tests__/language-switcher/setup.tsx`
- Modify: `src/components/layout/__tests__/header-language-menu.test.tsx`

- [ ] **Step 1: Write the DropdownMenu wrapper test**

Create `src/components/ui/__tests__/dropdown-menu.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

describe("DropdownMenu", () => {
  it("opens menu content from the local wrapper trigger", async () => {
    const user = userEvent.setup();

    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>English</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    await user.click(screen.getByRole("button", { name: "Open menu" }));

    expect(screen.getByRole("menuitem", { name: "English" })).toBeVisible();
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run:

```bash
pnpm exec vitest run src/components/ui/__tests__/dropdown-menu.test.tsx
```

Expected:

- FAIL because `dropdown-menu.tsx` does not exist.

- [ ] **Step 3: Create `src/components/ui/dropdown-menu.tsx`**

```tsx
"use client";

import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";
import { cn } from "@/lib/utils";

const DropdownMenu = DropdownMenuPrimitive.Root;
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
const DropdownMenuGroup = DropdownMenuPrimitive.Group;
const DropdownMenuPortal = DropdownMenuPrimitive.Portal;

const DropdownMenuContent = forwardRef<
  ElementRef<typeof DropdownMenuPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 8, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 min-w-[180px] rounded-xl border border-border bg-popover p-2 text-popover-foreground shadow-lg outline-none",
        className,
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
));
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName;

const DropdownMenuItem = forwardRef<
  ElementRef<typeof DropdownMenuPrimitive.Item>,
  ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      "flex cursor-pointer select-none items-center justify-between rounded-md px-3.5 py-2 text-sm font-medium text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus:bg-muted focus:text-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 dark:hover:bg-foreground/10",
      className,
    )}
    {...props}
  />
));
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName;

const DropdownMenuSeparator = forwardRef<
  ElementRef<typeof DropdownMenuPrimitive.Separator>,
  ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-border", className)}
    {...props}
  />
));
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName;

export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
};
```

- [ ] **Step 4: Add Storybook coverage**

Create `src/components/ui/dropdown-menu.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const meta = {
  title: "UI/DropdownMenu",
  parameters: {
    layout: "centered",
  },
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">Language</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>English</DropdownMenuItem>
        <DropdownMenuItem>简体中文</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
  tags: ["autodocs"],
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
```

- [ ] **Step 5: Register the primitive**

In `src/components/component-governance.registry.json`, add:

```json
    "dropdown-menu": {
      "story": "required"
    },
```

- [ ] **Step 6: Migrate `HeaderLanguageMenu`**

In `src/components/layout/header-language-menu.tsx`:

1. Import local wrappers:

```ts
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
```

2. Remove `DismissableMenuOptions`, `useDismissableMenu`, `rootRef`, `triggerId`,
   `menuId`, `TRIGGER_CLASS_NAME`, `MENU_CLASS_NAME`, and
   `LANGUAGE_LINK_CLASS_NAME`.

3. Keep `getLanguageHref`, `getCurrentBrowserPathname`, and
   `useLanguageTransition`.

4. Use controlled Radix open state:

```tsx
  const [pathname, setPathname] = useState(getCurrentBrowserPathname);
  const [isOpen, setIsOpen] = useState(() => initialOpen);
  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (nextOpen) {
      setPathname(getCurrentBrowserPathname());
    }
    setIsOpen(nextOpen);
  }, []);
```

5. Replace the return JSX with:

```tsx
  return (
    <div
      data-testid="language-switcher"
      className="notranslate relative inline-block"
      translate="no"
    >
      <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
        <DropdownMenuTrigger
          data-testid="language-toggle-button"
          aria-label={currentLanguageName}
          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full border border-border bg-background px-3 text-muted-foreground transition-colors duration-150 ease-out hover:bg-muted/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
        >
          <GlobeIcon />
          <span
            className="text-xs font-medium text-muted-foreground"
            data-testid="language-current-label"
            translate="no"
          >
            {currentLanguageName}
          </span>
          <ChevronIcon isOpen={isOpen} />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          data-testid="language-dropdown-content"
          translate="no"
        >
          {LANGUAGE_OPTIONS.map((option) => (
            <DropdownMenuItem
              asChild
              data-testid="language-dropdown-item"
              key={option.locale}
            >
              <a
                href={languageHrefs[option.locale]}
                data-locale={option.locale}
                data-testid={`language-link-${option.locale}`}
                translate="no"
                onClick={() => handleLanguageClick(option.locale)}
              >
                <span
                  className="text-xs"
                  data-testid={`language-option-label-${option.locale}`}
                  translate="no"
                >
                  {option.label}
                </span>
                {switchingTo === option.locale && <LoaderIcon />}
                {locale === option.locale && switchingTo !== option.locale && (
                  <CheckIcon />
                )}
              </a>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
```

- [ ] **Step 7: Update language-switcher mocks**

In `src/components/layout/__tests__/language-switcher/setup.tsx`, replace the
existing `@/components/ui/dropdown-menu` mock with one that exports these names:

```tsx
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div role="menu" {...props}>
      {children}
    </div>
  ),
  DropdownMenuItem: ({
    asChild,
    children,
    ...props
  }: React.HTMLAttributes<HTMLDivElement> & { asChild?: boolean }) =>
    asChild && React.isValidElement(children) ? (
      React.cloneElement(children, props)
    ) : (
      <div role="menuitem" {...props}>
        {children}
      </div>
    ),
  DropdownMenuTrigger: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));
```

- [ ] **Step 8: Run focused language and dropdown tests**

Run:

```bash
pnpm exec vitest run src/components/ui/__tests__/dropdown-menu.test.tsx src/components/layout/__tests__/header-language-menu.test.tsx src/components/layout/__tests__/language-switcher
pnpm component:governance
pnpm type-check
```

Expected:

- Dropdown wrapper test passes.
- Header language menu tests pass.
- Governance and type check pass.

- [ ] **Step 9: Commit**

Run:

```bash
git add src/components/ui/dropdown-menu.tsx src/components/ui/dropdown-menu.stories.tsx src/components/ui/__tests__/dropdown-menu.test.tsx src/components/component-governance.registry.json src/components/layout/header-language-menu.tsx src/components/layout/__tests__/language-switcher/setup.tsx src/components/layout/__tests__/header-language-menu.test.tsx
git commit -m "feat: add radix dropdown menu wrapper"
```

---

## Task 8: Record intentional local exceptions

**Files:**
- Modify: `docs/decisions/ADR-ui-foundation.md`
- Modify: `docs/decisions/radix-contact-form-pilot-result.md`
- Modify: `src/components/sections/__tests__/faq-section.test.tsx`

- [ ] **Step 1: Preserve the FAQ no-client regression test**

Keep this existing assertion in
`src/components/sections/__tests__/faq-section.test.tsx` unchanged:

```tsx
expect(source).not.toContain('"use client"');
expect(source).not.toContain("@/components/ui/accordion");
expect(source).not.toContain("lucide-react");
```

This is the proof that FAQ is an intentional local exception for this wave.

- [ ] **Step 2: Add local exception notes to ADR**

Append this section to `docs/decisions/ADR-ui-foundation.md`:

```md

## Stable takeover exceptions

The stable takeover keeps these surfaces local unless a future design proves the
risk has changed:

- Contact checkboxes stay native until a dedicated checkbox spike proves native
  `FormData`, no-JS fallback, label-click behavior, and existing E2E locators.
- FAQ disclosure stays native `<details>/<summary>` while the route-level test
  requires it to avoid client JavaScript.
- Narrative `Card` usage stays local; Radix-backed `DataCard` is only for
  data/control surfaces.
- Hero, product story, proof sections, footer art direction, grid, and page
  layout stay Tailwind/project-token owned.
```

- [ ] **Step 3: Add stable takeover result note**

Append this section to `docs/decisions/radix-contact-form-pilot-result.md`:

```md

## Stable takeover exception log

The stable takeover intentionally does not migrate checkboxes, FAQ disclosure,
or narrative cards in this wave. Those surfaces are risk exceptions, not missed
work:

- native checkboxes protect form submission semantics;
- native FAQ disclosure protects the current no-client JavaScript contract;
- local narrative cards protect brand and page storytelling freedom.
```

- [ ] **Step 4: Run docs and FAQ checks**

Run:

```bash
pnpm exec vitest run src/components/sections/__tests__/faq-section.test.tsx
pnpm component:governance
```

Expected:

- FAQ tests pass.
- Component governance passes.

- [ ] **Step 5: Commit**

Run:

```bash
git add docs/decisions/ADR-ui-foundation.md docs/decisions/radix-contact-form-pilot-result.md src/components/sections/__tests__/faq-section.test.tsx
git commit -m "docs: record radix takeover exceptions"
```

---

## Task 9: Final proof and takeover summary

**Files:**
- Modify: `docs/decisions/radix-contact-form-pilot-result.md`
- Modify: `docs/superpowers/specs/2026-05-14-radix-stable-takeover-design.md`

- [ ] **Step 1: Run full stable takeover validation**

Run:

```bash
pnpm component:governance:test
pnpm component:governance
pnpm component:check
pnpm type-check
pnpm lint:check
pnpm build
```

Expected:

- All commands pass.
- If `pnpm build` prints existing non-blocking warnings, record them exactly in
  the result note and do not treat them as Radix regressions unless they mention
  a changed file from this plan.

- [ ] **Step 2: Capture import boundary proof**

Run:

```bash
rg -n "from \"@radix-ui|from '@radix-ui|@radix-ui/themes|@radix-ui/react" src
rg -n "rt-[A-Za-z0-9_-]+" src
```

Expected:

- Radix imports appear only in `src/components/ui/*`.
- `@radix-ui/themes` imports appear only in approved UI wrappers.
- No production source depends on `.rt-*` classes.

- [ ] **Step 3: Capture buyer-visible browser proof**

Start the local app in one terminal:

```bash
pnpm dev
```

In a browser, verify these routes:

```text
http://localhost:3000/en/contact
http://localhost:3000/en/products
http://localhost:3000/en
```

Expected:

- Contact form renders with Radix-backed text controls and status surfaces.
- Product specification/data surfaces render without obvious visual breakage.
- Homepage hero, proof sections, product story, and footer do not look taken over
  by Radix Themes.

Save screenshots under `reports/` with these exact names:

```text
reports/radix-stable-takeover-en-contact-2026-05-14.png
reports/radix-stable-takeover-en-products-2026-05-14.png
reports/radix-stable-takeover-en-home-2026-05-14.png
```

- [ ] **Step 4: Update the result docs**

Append this section to `docs/decisions/radix-contact-form-pilot-result.md`:

```md

## Stable takeover result

Result: stable limited expansion.

Expanded Radix ownership:

- textual form controls;
- textarea controls;
- status callouts;
- badges;
- data/control cards;
- dropdown menu primitive for the language menu.

Intentionally local:

- contact checkboxes;
- FAQ disclosure;
- narrative cards;
- hero, product storytelling, proof sections, footer art direction, grid, and
  page layout.

Final validation:

- `pnpm component:governance:test`
- `pnpm component:governance`
- `pnpm component:check`
- `pnpm type-check`
- `pnpm lint:check`
- `pnpm build`

Browser proof artifacts:

- `reports/radix-stable-takeover-en-contact-2026-05-14.png`
- `reports/radix-stable-takeover-en-products-2026-05-14.png`
- `reports/radix-stable-takeover-en-home-2026-05-14.png`
```

- [ ] **Step 5: Update the design spec with implementation result**

Append this section to
`docs/superpowers/specs/2026-05-14-radix-stable-takeover-design.md`:

```md

## Implementation result

The stable takeover was implemented as a limited expansion, not a full-site
Radix Themes migration.

The final boundary is:

- Radix-backed: textual form controls, textarea controls, status callouts,
  badges, data/control cards, and dropdown menu primitive.
- Intentionally local: native checkboxes, FAQ disclosure, narrative cards, hero,
  product storytelling, proof sections, footer art direction, grid, and page
  layout.

This result satisfies the design goal: maximum Radix ownership outside surfaces
where Radix would add form-semantics, client-boundary, or brand-expression risk.
```

- [ ] **Step 6: Final commit**

Run:

```bash
git add docs/decisions/radix-contact-form-pilot-result.md docs/superpowers/specs/2026-05-14-radix-stable-takeover-design.md reports/radix-stable-takeover-en-contact-2026-05-14.png reports/radix-stable-takeover-en-products-2026-05-14.png reports/radix-stable-takeover-en-home-2026-05-14.png
git commit -m "docs: record radix stable takeover proof"
```

---

## Self-review checklist

- Spec coverage:
  - Governance upgrade: Task 1.
  - Forms and feedback: Tasks 2, 3, and 4.
  - Badge/status: Tasks 4 and 5.
  - Data/spec cards: Task 6.
  - Interaction primitives: Task 7.
  - Risk exceptions: Task 8.
  - Final proof and ADR update: Task 9.
- Placeholder scan:
  - No task uses open-ended implementation language.
  - Every code-changing task gives exact file paths and concrete code.
- Type consistency:
  - `RadixThemePilotSurface` values match wrapper usage.
  - `StatusCalloutTone` values match form feedback usage.
  - `DataCard*` component names match migration instructions.
  - `DropdownMenu*` component names match header migration instructions.
