# React Doctor Baseline

React Doctor is integrated as an error-level CI gate.

Current policy:

- error blocks CI
- warning is backlog
- warning is not yet merge-blocking

Fresh calibrated baseline:

```text
errorCount: 0
warningCount: 203
affectedFileCount: 81
score: 97 / 100
```

React Doctor now loads `react-doctor.config.json`, which records narrow
file/rule overrides for warnings that already entered one of the accepted
dispositions. CI only runs the error-level gate (`pnpm react:doctor`).
`pnpm react:doctor:report` remains available for a human JSON snapshot when
someone wants to review warning backlog manually. Warning classification is
human backlog/reference, not a separate CI governance layer.

Pre-config classified backlog before native suppression:

```text
total: 426
errors: 0
warnings: 426
unresolved: 0
```

File type split:

```text
tests: 301
production: 105
scripts: 20
```

Classified backlog:

```text
test-fixture-noise: 301
low-value-style: 83
confirmed-real: 0
project-exception: 42
needs-manual-proof: 0
unresolved: 0
```

Disposition split:

```text
exempt-after-proof: 343
temporarily-retain: 83
fix: 0
delete-after-proof: 0
```

Owner split:

```text
test-governance: 301
quality-governance: 125
proof-lane: 0
engineering: 0
```

Latest governance notes:

- `rerender-memo-with-default-value` was fixed in shared grid/header components by using stable module-level empty arrays.
- `rerender-state-only-in-handlers` findings in lazy client islands are classified as project exceptions after proof. The state values drive early-return or fallback-to-interactive render branches, and changing them to refs would break the required rerender.
- Low-risk `scripts/starter-checks.js` iteration warnings were cleaned up inside the scripts proof lane with focused tests and guardrail commands.
- Remaining `scripts/starter-checks.js` warnings are classified as project exceptions because they are string/doc scans or ordered Cloudflare smoke probes, not safe array lookup or parallelization rewrites.
- The former sanitizer `needs-manual-proof` warnings in `src/lib/security-validation.ts` were resolved through a security proof lane. Tests now cover mixed-case tags, missing closing tags, and a nested script payload before the scanner implementation was changed. The same scanner is shared by `script` and `iframe`.
- Remaining production warnings are now classified as project exceptions, proof lanes, or low-value style cleanup. No current warning is treated as confirmed production bug debt.
- The calibrated React Doctor gate target for this branch is now `0 error`.
  Warning-level dead-code output remains a backlog and must not be treated as
  automatic deletion work.

Current warning shape:

```text
Dead Code: 203
knip/types: 102
knip/exports: 78
knip/files: 19
knip/duplicates: 4
```

The remaining `knip/files` signals include retained support assets:
`lighthouserc.js`, `open-next.config.ts`, `.devtools/react-grab-dev.mjs`,
`src/test/css-stub.ts`, `src/test/mdx-stub.ts`, and local skill helper scripts
under `.claude/skills/impeccable/scripts/`. Do not delete these from raw
dead-code output alone.

## Policy files

- Policy: `docs/quality/react-doctor-policy.md`
- Exceptions: `docs/quality/react-doctor-exceptions.md`

The current native React Doctor baseline is zero errors. If new diagnostics
appear, they must be fixed, deleted after proof, exempted after proof, or
temporarily retained with an owner and reason before merge.

The former raw baseline is no longer enforced as a separate CI layer. Do not
claim raw React Doctor output is gate-kept by a tracked raw baseline file.
If new diagnostics appear in the retained gate or manual report, fix them,
delete after proof, exempt after proof, or temporarily retain them with an
owner and reason before merge.

Do not switch to `--fail-on warning` until false positives, retained support
assets, API-surface exports, dead-code candidates, and test fixture noise are
triaged.
