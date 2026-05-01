---
name: Showcase Website Starter
description: Provisional design operating model for reusable showcase websites.
status: provisional
colors:
  source: "src/app/globals.css"
  current-contract: "docs/impeccable/system/COLOR-SYSTEM.md"
  status: "role-based architecture is stable; exact values are replaceable"
  brand-role: "--primary / --brand-*"
  neutral-role: "--background / --foreground / --neutral-*"
  status-roles: "--success-* / --warning-* / --error-* / --info-*"
typography:
  display:
    fontFamily: "Figtree, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "36px mobile, 48px desktop"
    fontWeight: 800
    lineHeight: "1.1 mobile, 1.0 desktop"
    letterSpacing: "-0.03em mobile, -0.05em desktop"
  headline:
    fontFamily: "Figtree, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "32px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Figtree, Source Han Sans SC, Noto Sans SC, PingFang SC, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
spacing:
  unit: "4px"
  container-max: "1080px"
  container-padding: "24px"
  section-y-mobile: "56px"
  section-y-desktop: "72px"
components:
  button-primary:
    backgroundColor: "var(--primary)"
    textColor: "var(--primary-foreground)"
    rounded: "{rounded.md}"
    padding: "height 38px, horizontal 20px"
  button-secondary:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "height 38px, horizontal 20px"
  card-default:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "24px"
  section-container:
    width: "{spacing.container-max}"
    padding: "{spacing.container-padding}"
---

# Design System: Showcase Website Starter

## 1. Overview

**Creative North Star: "Clear, credible, reusable showcase."**

This is a provisional design operating model for the starter. It gives agents enough boundaries to design consistently while still letting each real project replace the brand, content, imagery, and tone.

The starter should feel polished, modern, and trustworthy without locking every future project into one industry or one brand personality.

Stable principles:

- Clarity beats decoration.
- Trust evidence should be close to claims.
- Components should be reusable and easy to inspect.
- Semantic tokens are the interface; raw color values are not the interface.
- Storybook is a review surface for component quality, not a second implementation.
- The exact brand palette is replaceable.

Not final:

- Final brand colors for any derivative project.
- Final photography direction.
- Final illustration style.
- Final amount of motion.
- Final product/service taxonomy.

## 2. Colors

The current palette is a restrained blue and neutral system. It is good as a starter baseline, but it is not the final identity for every derived website.

The stable design decision is the role-based color architecture:

- Primary action role: `--primary`
- Primary foreground role: `--primary-foreground`
- Brand scale roles: `--brand-*`
- Neutral surface and text roles: `--background`, `--foreground`, `--muted`, `--card`
- Status roles: `--success-*`, `--warning-*`, `--error-*`, `--info-*`

Rules:

- Use role tokens in UI code.
- Do not hard-code brand hex values inside components.
- Change brand appearance from the token layer, not by patching components one by one.
- If a real project changes brand color, update docs and token contract together.

## 3. Typography

Typography should support fast scanning:

- clear H1 for page purpose;
- short section headings;
- readable body text;
- labels for specs, metadata, and navigation;
- restrained mono usage for IDs, standards, and technical values.

Default font baseline:

- Display/body: Figtree with system fallbacks.
- Chinese fallback: Source Han Sans SC, Noto Sans SC, PingFang SC.
- Technical labels: JetBrains Mono or system monospace where appropriate.

## 4. Components

Components should make future AI-assisted work easier:

- Reuse existing `src/components/ui/` primitives before creating new UI.
- Reuse section patterns before inventing a one-off layout.
- Add Storybook stories for components that need visual review, reusable variants, or governance.
- Keep business-specific copy out of low-level UI primitives.
- Keep accessibility behavior inside shared primitives where possible.

### Buttons

- Primary buttons are for the main next step.
- Secondary buttons are for lower-commitment actions.
- Destructive/status buttons must use semantic status tokens.
- Focus state must remain visible.

### Cards and Sections

- Cards should organize information, not decorate empty space.
- Prefer consistent spacing, border, and shadow patterns.
- Section layout should make the page easy to skim on mobile and desktop.

### Forms

- Keep the default contact form simple.
- Add fields only when the project has a real reason.
- Validation copy should be specific and easy to understand.
- Critical forms need usable fallback states.

## 5. Motion

Motion is optional and should support understanding:

- Prefer opacity and transform.
- Keep common interactions quick.
- Respect reduced motion.
- Do not add heavy animation runtime without a clear reason.

## 6. Do's and Don'ts

Do:

- Use design tokens and shared components.
- Keep examples replaceable.
- Add component stories when a component needs review or reuse.
- Put proof near claims.
- Keep responsive behavior and accessibility visible during review.

Don't:

- Treat starter colors as the final brand of a new project.
- Create duplicate buttons/cards/forms because it is faster in the moment.
- Put one project's business identity into shared primitives.
- Hide content truth inside component code when it belongs in config or MDX.
- Add fake proof assets, fake logos, or unsupported claims.

## 7. Current Truth Sources

- Runtime colors: `src/app/globals.css`
- Color contract: `docs/impeccable/system/COLOR-SYSTEM.md`
- Component governance: `docs/impeccable/system/COMPONENT-GOVERNANCE.md`
- Website replacement docs: `docs/website/`
- Product context: `PRODUCT.md`
