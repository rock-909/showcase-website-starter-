# React Doctor Baseline

React Doctor is integrated as an error-level CI gate.

Current policy:

- error blocks CI
- warning is backlog
- warning is not yet merge-blocking

Fresh baseline:

```text
errorCount: 0
warningCount: 428
affectedFileCount: 153
score: 72 / 100
```

Warning breakdown:

```text
Architecture: 173
Performance: 150
Server: 50
Accessibility: 41
Correctness: 21
Next.js: 15
State & Effects: 5
Bundle Size: 2
Security: 2
```

File type split:

```text
tests: 301
production: 107
scripts: 20
```

Classified backlog:

```text
test-fixture-noise: 301
low-value-style: 83
confirmed-real: 0
project-exception: 42
needs-manual-proof: 2
unresolved: 0
```

Disposition split:

```text
exempt-after-proof: 343
temporarily-retain: 85
fix: 0
```

Owner split:

```text
test-governance: 301
quality-governance: 125
proof-lane: 2
engineering: 0
```

Latest governance notes:

- `rerender-memo-with-default-value` was fixed in shared grid/header components by using stable module-level empty arrays.
- `rerender-state-only-in-handlers` findings in lazy client islands are classified as project exceptions after proof. The state values drive early-return or fallback-to-interactive render branches, and changing them to refs would break the required rerender.
- Low-risk `scripts/starter-checks.js` iteration warnings were cleaned up inside the scripts proof lane with focused tests and guardrail commands.
- Remaining `scripts/starter-checks.js` warnings are classified as project exceptions because they are string/doc scans or ordered Cloudflare smoke probes, not safe array lookup or parallelization rewrites.
- The only remaining `needs-manual-proof` warnings are two sanitizer string scans in `src/lib/security-validation.ts`. They require a dedicated security proof lane before any rewrite.
- Remaining production warnings are now classified as project exceptions, proof lanes, or low-value style cleanup. No current warning is treated as confirmed production bug debt.
- The calibrated React Doctor target for this branch is `0 blocking-error`, `0 confirmed-real`, and `0 unresolved` after classification. Raw warning count is still tracked, but raw warning count alone is not treated as the project rule after calibration.

## Policy files

- Policy: `docs/quality/react-doctor-policy.md`
- Exceptions: `docs/quality/react-doctor-exceptions.md`

The current baseline is a warning backlog. It is not a release blocker and it is not a count of real production bugs.

Do not switch to `--fail-on warning` until false positives, dead-code candidates, and test fixture noise are triaged.
