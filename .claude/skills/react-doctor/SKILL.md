---
name: react-doctor
description: Use before completing React or Next.js code changes, before committing UI/form/client-component work, or when improving code quality. Runs the project-pinned React Doctor gate used by CI.
---

# React Doctor for Claude Code

Use this skill after React/Next.js changes and before saying the work is done.

## Required command

Run the project-pinned error gate:

```bash
pnpm react:doctor
```

This is blocking. React Doctor errors must be fixed before completion.

## Governance gate

When the task targets React Doctor warning cleanup or repo quality governance,
also run the classified governance gate:

```bash
pnpm react:doctor:governance
```

This does not blindly fail on raw warnings. It fails only when a diagnostic is
still unresolved after classification. Every warning must be mapped to fix,
delete-after-proof, exempt-after-proof, or temporarily-retain with owner and
reason.

## Full report

For cleanup, audit, or triage work, generate the JSON report:

```bash
pnpm react:doctor:classify
```

## Project rules

- Errors are CI blockers.
- Warnings are review signals unless the task explicitly targets warning cleanup.
- Do not mechanically fix warnings that could change buyer-facing behavior, i18n, deployment/runtime behavior, or design tokens.
- For dead-code findings, verify real production, script, build, and runtime references before removing anything.
- Prefer small, behavior-preserving fixes over score-chasing.
- If a finding appears false-positive, explain why and use the narrowest suppression only after proving the cleanup path is worse.
