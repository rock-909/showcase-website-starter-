# Radix Stable Takeover Design

## Purpose

Move the project from a narrow Contact / Inquiry form Radix Themes pilot to a
stable, broad Radix takeover for low-risk UI surfaces.

"Broad takeover" does not mean "Radix owns the whole website." The starter is a
showcase and conversion website, so Tailwind plus project-owned tokens must keep
owning brand expression, page composition, and narrative sections. Radix should
own controls, interaction behavior, state surfaces, and repeated data/control
UI where it gives better accessibility, consistency, and agent reuse.

## Current state on 2026-05-14

The required context checks before this design were:

```bash
git status --short --branch
git log --oneline -8
rg -n "Radix|radix|ui foundation|Themes|pilot|Contact form|接管" docs .claude/rules src/components package.json
rg -n "from \"@radix-ui|@radix-ui/themes|@radix-ui/react" src tests/unit/scripts/component-governance-check.test.ts
rg -n "@/components/ui/(badge|card|input|textarea|button|sheet|label|breadcrumb|separator|contact-form|radix-theme)|<Badge|<Card|<Input|<Textarea|<Sheet|<Button|<Label|<Separator|<Breadcrumb" src content mdx-components.tsx
```

Observed state:

- `main` was clean before the design branch was created.
- Latest relevant commit: `2d2606e feat(ui): add radix contact form pilot foundation`.
- `docs/decisions/ADR-ui-foundation.md` accepts a hybrid / pilot-first UI
  foundation, not a full-site Radix Themes-first migration.
- `docs/decisions/radix-contact-form-pilot-result.md` says the Contact /
  Inquiry form pilot may stay, but it is not approved for broad expansion yet.
- `@radix-ui/themes` is already installed and imported once through
  `src/app/globals.css` in the `components` cascade layer.
- Radix Themes React imports are currently limited to:
  - `src/components/ui/radix-theme.tsx`
  - `src/components/ui/contact-form-shell.tsx`
  - `src/components/ui/contact-form-control.tsx`
- Radix Primitives already back:
  - `src/components/ui/button.tsx` through `@radix-ui/react-slot`
  - `src/components/ui/breadcrumb.tsx` through `@radix-ui/react-slot`
  - `src/components/ui/label.tsx` through `@radix-ui/react-label`
  - `src/components/ui/sheet.tsx` through `@radix-ui/react-dialog`
- Local non-Radix wrappers still own broad surfaces such as `Badge`, `Card`,
  `Input`, `Textarea`, `Separator`, feedback UI, product spec cards, and form
  field modules outside the Contact form path.
- `scripts/starter-checks.js` currently allows Radix Themes only in the three
  approved Contact-pilot wrappers listed above.

## Takeover definition

The goal is maximum stable takeover outside high-risk narrative surfaces.

Radix may take over a surface when at least one is true:

- it handles user input;
- it has open/closed, selected, disabled, loading, pending, success, warning, or
  error state;
- it needs keyboard behavior, focus management, ARIA wiring, or overlay
  behavior;
- it is a repeated data/control primitive such as a badge, callout, table, card,
  or specification block whose semantics should stay consistent across pages;
- it reduces wrapper variance without making app code depend on Radix internal
  DOM or classes.

Radix must not take over a surface when its main job is:

- hero layout;
- page composition;
- product storytelling;
- factory, quality, or capability proof;
- trust-strip narrative design;
- footer art direction;
- grid system and responsive section framing;
- MDX prose styling;
- static cards whose only purpose is typography, imagery, or brand tone.

## Architecture

The stable architecture has five layers:

1. Project-owned tokens in `src/app/globals.css` remain the runtime design truth.
2. Tailwind remains the layout and brand-expression system.
3. Radix Primitives remain the default for complex interaction wrappers under
   `src/components/ui/*`.
4. Radix Themes is allowed only through explicitly approved
   `src/components/ui/*` wrappers.
5. Business components, sections, pages, forms, and product modules consume local
   wrappers only.

Business code must not import:

- `@radix-ui/themes`
- `@radix-ui/react-*`
- Radix internal `.rt-*` classes
- Radix DOM structure

If a business component needs a Radix behavior, add or extend a local wrapper
first.

## Takeover layers

### Layer 0: Governance upgrade

Purpose: turn the current Contact-only pilot contract into a staged broad
takeover contract.

Scope:

- Update the Radix decision docs so they say Contact passed the first boundary
  proof but broad expansion still requires staged gates.
- Replace the hard-coded "approved Contact wrappers only" governance whitelist
  with a deliberate approved-wrapper list that can grow one surface at a time.
- Keep the scanner strict: direct Radix import outside `src/components/ui/*`
  remains an error.
- Add test coverage for newly approved wrapper paths before allowing them.

Acceptance:

- The docs clearly distinguish Radix Primitives, Radix Themes, and Tailwind
  ownership.
- Governance can approve additional Radix Themes UI wrappers without loosening
  business-code restrictions.
- `pnpm component:governance:test` and `pnpm component:governance` stay green.

### Layer 1: Forms and feedback

Purpose: make forms the first broad stable takeover area.

Scope:

- Unify the current Contact-specific Radix text input and textarea wrappers into
  a reusable form-control path, or make the existing `Input` and `Textarea`
  wrappers delegate to the same Radix-backed implementation when safe.
- Keep `Label` backed by Radix Label.
- Add a local `StatusCallout` or `FormFeedback` wrapper for error, success,
  warning, pending, and unavailable states.
- Migrate Contact form feedback surfaces to the local wrapper.
- Evaluate checkbox separately. Checkbox may stay native if Radix replacement
  risks native FormData behavior, no-JS fallback, or label-click behavior.

Required behavior:

- Field names and native submission payloads stay unchanged.
- Labels, descriptions, errors, status text, and aria text stay localizable.
- Disabled and pending states remain visible.
- Error summary remains accessible.
- No hard-coded English enters reusable wrappers.

First target files:

- `src/components/ui/contact-form-control.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/textarea.tsx`
- `src/components/ui/label.tsx`
- `src/components/forms/contact-form-feedback.tsx`
- `src/components/forms/contact-form-fields.tsx`
- `src/components/forms/fields/*.tsx`
- `src/components/contact/contact-form-island.tsx`

### Layer 2: Status, badge, and callout surfaces

Purpose: move low-risk state markers and message panels onto Radix-backed local
wrappers.

Scope:

- Convert `Badge` to a Radix-backed or Radix-Themes-backed wrapper if visual tone
  and token mapping hold.
- Add `Callout` or `StatusCallout` for buyer-visible information, warning,
  error, and success messages.
- Use the callout wrapper for form errors, Turnstile unavailable state, route
  error messages, and product context notices where appropriate.
- Keep props semantic: `variant="info" | "success" | "warning" | "error"` rather
  than exposing Radix palette names.

Required behavior:

- Badge remains usable in product specs and Storybook color stories without
  Radix default palettes becoming brand identity.
- Callout wrappers expose content slots but no Radix internal DOM contract.
- Status surfaces remain screen-reader friendly when they represent live form
  feedback.

First target files:

- `src/components/ui/badge.tsx`
- `src/components/ui/badge.stories.tsx`
- `src/components/forms/contact-form-feedback.tsx`
- `src/components/contact/product-family-context-notice.tsx`
- `src/components/errors/route-error-view.tsx`
- `src/components/products/product-specs.tsx`

### Layer 3: Data/control cards and specifications

Purpose: take over repeated data/control card surfaces while avoiding marketing
story cards.

Allowed card surfaces:

- product specification cards;
- specification table containers;
- contact static fallback card;
- about-page reusable information cards;
- data/control cards where consistent border, radius, surface, and state
  semantics matter.

Forbidden card surfaces:

- hero visual composition;
- product storytelling cards;
- homepage narrative cards;
- proof or trust cards whose design job is brand expression;
- footer blocks.

Scope:

- Either introduce a distinct `DataCard` / `SpecCard` wrapper backed by Radix
  Themes, or add a semantic `tone` / `surface` path to the local `Card` wrapper
  without forcing every narrative card through Radix Themes.
- Keep business imports stable where possible.
- Do not let Radix Card spacing or typography defaults silently rewrite page
  sections.

Required behavior:

- Product spec tables and cards keep their current content hierarchy.
- Cards can still be rendered server-side unless a specific Radix dependency
  requires client behavior.
- Any changed card surface gets Storybook proof.

First target files:

- `src/components/ui/card.tsx`
- `src/components/products/product-specs.tsx`
- `src/components/products/spec-table.tsx`
- `src/app/[locale]/contact/contact-form-static-fallback.tsx`
- `src/components/content/about-page-shell.tsx`

### Layer 4: Interaction primitives

Purpose: let Radix Primitives own complex interaction behavior wherever the site
needs it.

Scope:

- Keep and harden `Sheet` for mobile navigation.
- Add or migrate `Accordion` for FAQ disclosure if current FAQ behavior is local
  or inconsistent.
- Add `DropdownMenu` for language or navigation menus only if it improves current
  keyboard behavior and does not over-clientize the header.
- Add `Dialog`, `Popover`, `Tooltip`, or `Tabs` only when a real surface needs
  them; do not add unused primitives for inventory.

Required behavior:

- Header and navigation remain accessible with keyboard and screen readers.
- Server Component boundaries stay narrow. Client wrappers are allowed only for
  real interactivity.
- No static narrative section becomes a Client Component just to use Radix.

First target files:

- `src/components/ui/sheet.tsx`
- potential new `src/components/ui/accordion.tsx`
- potential new `src/components/ui/dropdown-menu.tsx`
- `src/components/sections/faq-accordion.tsx`
- `src/components/layout/header-language-menu.tsx`
- `src/components/layout/mobile-navigation-interactive.tsx`

### Layer 5: Proof and rollout gates

Purpose: make the takeover durable and reversible.

Every implementation wave must include:

- wrapper tests for changed UI primitives;
- Storybook states for reviewable visual variants;
- governance tests for any new approved Radix Themes wrapper;
- focused business tests for the migrated surface;
- CSS and bundle notes when Radix Themes usage expands;
- browser proof for buyer-visible routes affected by the wave.

Minimum commands by change type:

```bash
pnpm component:governance:test
pnpm component:governance
pnpm component:check
pnpm type-check
pnpm lint:check
```

If the wave touches Next.js runtime behavior, client/server boundaries, global
CSS, or route output, also run:

```bash
pnpm build
```

If the wave is release-facing or broad, run:

```bash
pnpm website:check
```

## Implementation sequencing

The implementation should happen in small, reviewable waves:

1. Governance upgrade and documentation.
2. Forms and feedback.
3. Badge and callout/status wrappers.
4. Data/spec card wrappers.
5. FAQ/navigation interaction primitives.
6. Final proof and ADR update.

Each wave should produce a working repository and should not depend on
half-migrated business components.

## Acceptance criteria

The stable takeover is complete when:

- Radix Primitives are the default for all complex interaction wrappers that
  exist in production UI.
- Radix Themes imports are limited to explicitly approved local UI wrappers.
- Business code has no direct Radix imports.
- No production code depends on `.rt-*` classes or Radix internal DOM.
- Forms, status feedback, badges, data/spec cards, and real interaction
  primitives are either Radix-backed or explicitly documented as intentionally
  native/local because Radix would add risk.
- Hero, product story, proof sections, footer art direction, grid system, and
  page layout remain Tailwind/project-token owned.
- Storybook, wrapper tests, governance checks, type-check, lint, and build proof
  all pass for the final wave.
- The final ADR records which surfaces were expanded, which were left local, and
  why.

## Risks and mitigations

### Risk: Radix Themes turns into a hidden full-site design system

Mitigation: keep direct imports blocked, keep wrappers semantic, and keep hero,
story, proof, footer, grid, and page layout outside Radix Themes.

### Risk: CSS cost grows globally

Mitigation: record CSS/JS evidence for every Radix Themes expansion. If the
global shared CSS cost becomes unacceptable, freeze Radix Themes expansion and
continue with Radix Primitives plus local token styling.

### Risk: Server Components become Client Components unnecessarily

Mitigation: do not add `"use client"` to static narrative components. Use Radix
Primitives only where behavior requires client-side interaction.

### Risk: Form semantics regress

Mitigation: tests must prove field names, label association, disabled behavior,
error feedback, and native FormData behavior after each form-control migration.

### Risk: Visual tone becomes generic SaaS

Mitigation: wrappers must map to project-owned tokens and buyer-facing Storybook
states. Do not expose Radix palette names to business components.

## Rollback rules

- If a Radix Themes wrapper creates cascade workarounds, remove or freeze that
  wrapper instead of adding stronger selectors.
- If a migrated form control breaks native submission, no-JS fallback, or
  accessibility, revert that control to the previous local/native wrapper.
- If a data/card migration changes narrative visual tone, split `DataCard` from
  narrative `Card` instead of forcing one wrapper to serve both jobs.
- If governance needs to be loosened for a migration, the migration is not ready.

## Out of scope

- Full-site Radix Themes migration.
- Dark-mode redesign.
- Brand redesign.
- Page layout rewrite.
- Footer redesign.
- Hero redesign.
- Product story redesign.
- Cloudflare deployment changes.
- Dependency-wide upgrade beyond Radix packages directly required by a wave.
