---
paths:
  - "src/**/*.{ts,tsx}"
  - "tests/**/*.{ts,tsx}"
  - "scripts/**/*.{js,mjs,ts}"
  - "*config.{js,ts,mjs,mts}"
  - "eslint.config.mjs"
---

# Coding Standards

## TypeScript

### Strict Mode
- `strict: true`, `noImplicitAny: true`
- **No `any`** (tests have limited exceptions)
- TypeScript docs treat `interface` vs `type` as mostly a design choice; in this repo, default to `interface` for object shapes, and use `type` for unions, tuples, mapped types, or utility-heavy compositions
- Use `satisfies` for type-safe object literals
- Repo convention: prefer `const` objects + union types over `enum` unless third-party interop explicitly requires `enum`

### exactOptionalPropertyTypes

Cannot pass explicit `undefined` to optional properties:

```typescript
// ❌ Error
const config: Config = { name: 'test', description: undefined };

// ✅ Correct: conditional spread
const config: Config = { name: 'test', ...(desc ? { description: desc } : {}) };
```

## Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `ProductCard.tsx` |
| Hooks | `use` prefix | `useBreakpoint.ts` |
| Utilities | camelCase | `formatPrice.ts` |
| Constants | SCREAMING_SNAKE | `MAX_ITEMS` |
| Directories | kebab-case | `user-profile/` |
| Booleans | `is/has/can/should` | `isLoading` |
| Event handlers | `handle` prefix | `handleSubmit` |

## Imports

### Path Aliases
Always use `@/` alias. No deep relative imports.

### Import Order

Maintain this order (no lint enforcement — the rule itself is the mechanism):

1. `react`, `react/*`
2. `next`, `next/*`
3. Third-party modules
4. `@/types/*`
5. `@/lib/*`
6. `@/components/*`
7. `@/app/*`
8. Other `@/*` aliases
9. Relative imports (`./`, `../`)

## Formatting Tooling

Prettier patch upgrades can be handled as a small formatting-tool lane. Do not
mix them with `prettier-plugin-tailwindcss` minor upgrades or import-sorting
plugin changes, because those can create broad formatting churn. Prove the lane
with `pnpm format:check` plus the normal type/lint/build checks.

## Constants

- Organize by domain in `src/constants/`, use `as const`
- Magic number rules → see `code-quality.md`
- User-facing text must use i18n keys

## Logging

```typescript
// ❌ Bare console in production
console.log('user submitted', data);

// ✅ Structured logger
import { logger } from '@/lib/logger';
logger.error('API failed', { endpoint, statusCode });
logger.warn('Rate limit approaching', { remaining, ip });
```

Production: only `logger.error()`, `logger.warn()`. Dev: `logger.info()`, `logger.debug()`.
