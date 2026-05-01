---
paths:
  - "src/components/**/*.tsx"
  - "src/app/**/page.tsx"
  - "src/components/sections/**"
---

# UI Coding Constraints

## Before Creating Components

Check `src/components/` subdirectories (`ui/`, `blocks/`, `sections/`, `forms/`, `products/`, `layout/`, `contact/`, `trust/`) for existing components before creating new ones.

For reusable UI work, also read `docs/impeccable/system/COMPONENT-GOVERNANCE.md`.

Follow the reuse decision tree:

1. Reuse an existing component.
2. Use or add a variant when the concept is the same.
3. Create a composed business component only when there is clear business meaning.
4. Keep one-off page UI local instead of over-abstracting.
5. Create a new `src/components/ui/` primitive only with a clear reason, Storybook coverage, and tests or contract checks when behavior exists.

Do not import Radix primitives directly from route pages, page sections, or business components. Use project wrappers in `src/components/ui/` unless an explicit governance exception is documented.

When changing reusable components, update or add Storybook stories for the states that matter to review.

## Design Tokens

Design values (spacing, color, typography) live in `src/app/globals.css`, not in component code.

```typescript
// ❌ Hardcoded values
<div className="text-[#004d9e]" style={{ maxWidth: '1080px' }} />

// ✅ Design tokens from globals.css
<div className="text-primary" style={{ maxWidth: 'var(--container-max)' }} />
```

### Design token migration rule

The current color values are provisional. Do not treat `#004D9E` or any current blue as final brand identity.

For production UI:

- Use semantic tokens from `src/app/globals.css`, such as `bg-primary`, `text-foreground`, `border-border`, `ring-ring`, or explicit CSS-variable classes like `bg-[var(--success-muted)]`.
- Do not introduce raw brand hex values in components.
- Do not introduce raw Tailwind palette classes such as `bg-blue-50`, `text-red-500`, `border-amber-200`, or `text-green-600` in production UI unless the class is inside a test fixture.
- If a new visual state is needed, add or reuse a semantic/component token in `src/app/globals.css`.
- If a non-CSS or email surface needs a color, use `src/config/static-theme-colors.ts`.
- Browser UI must not import `src/config/static-theme-colors.ts` or treat the static bridge as the color truth source. That bridge is only for email and other non-CSS surfaces.

Before changing brand color, theme, or design-token architecture, read:

1. `DESIGN.md`
2. `docs/design-truth.md`
3. `docs/impeccable/system/COLOR-SYSTEM.md`
4. `docs/guides/CANONICAL-TRUTH-REGISTRY.md`

## Component Library

- **Base**: shadcn/ui (Radix UI + Tailwind CSS) at `src/components/ui/`
- **Add**: `pnpm dlx shadcn@latest add <component>`
- **Icons**: Lucide React — `import { ChevronRight } from 'lucide-react'`

## Tailwind CSS v4

Config via `@theme inline` in `globals.css` (no `tailwind.config.ts`).

When upgrading Tailwind CSS, keep `tailwindcss` and `@tailwindcss/postcss` on
the same patch version in the same branch. Treat `postcss` as part of the same
style-build validation lane. Prove the upgrade with a production build plus a
browser-facing smoke or visual check when styles could be affected.

### `cn()` for conditional classes

```typescript
import { cn } from '@/lib/utils';
cn("px-4", "px-6")                          // → "px-6" (merge)
cn("bg-red-500", isActive && "bg-blue-500") // conditional
```

### Dynamic class names forbidden

Tailwind only detects complete class names it can statically see in source files. Do not build utility names by string interpolation:

```typescript
// ❌ Gets purged — Tailwind can't see the full class name
<span className={`bg-${color}-100`} />

// ✅ Literal mapping
const colors = {
  success: 'bg-green-100 text-green-800',
  error: 'bg-red-100 text-red-800',
} as const;
<span className={colors[status]} />

// ✅ Truly dynamic → inline style
<button style={{ backgroundColor: dynamicColor }} className="rounded-md px-3" />
```

## Image

Default to `next/image` for user-facing app images. Native `<img>` is only acceptable when optimization is intentionally skipped or unsupported, and the reason should be obvious in code. For API details (fill, sizes, preload/priority, placeholder), see `node_modules/next/dist/docs/`.

## Font & Metadata

For `next/font` and `generateMetadata` usage, see `node_modules/next/dist/docs/` - the installed package docs are version-matched.
