# React Doctor Policy

React Doctor is an error-level gate in this starter.

## Gate policy

- `error` blocks CI.
- `warning` is backlog.
- Do not use `--fail-on warning` until warnings are classified, exceptions are documented, and test fixture noise is isolated.
- CI also runs the classified governance gate. The classified gate blocks on any `blocking-error` or `confirmed-real` diagnostic that has not been fixed or otherwise classified with owner and reason.

## Buckets

| Bucket | Meaning | Merge impact |
| --- | --- | --- |
| `blocking-error` | React Doctor error. | Blocks. |
| `confirmed-real` | Real production risk or quality debt with clear proof. | Fix in repair waves. |
| `needs-manual-proof` | Rule may be right, but hidden runtime or order dependencies need proof. | Do not batch-fix. |
| `project-exception` | Tool rule is generally good, but this repo has a documented exception. | Do not fix unless the exception changes. |
| `test-fixture-noise` | Test or support fixture warning. | Do not block release. |
| `low-value-style` | Style or micro-optimization. | Cleanup only after higher-value work. |

## Calibrated zero-warning definition

The long-term target remains React Doctor `0 warning / 0 error`, but the
project rule after calibration is stricter than a raw count and safer than
blind cleanup:

```text
blocking-error: 0
confirmed-real: 0
unresolved: 0
```

Every raw warning must have exactly one actionable disposition:

| Disposition | Meaning | Owner |
| --- | --- | --- |
| `fix` | The warning is real and must be repaired. | `engineering` |
| `delete-after-proof` | The code is unnecessary, and runtime/build/script proof supports removal. | `engineering` |
| `exempt-after-proof` | The warning is a documented exception or test/support fixture signal. | `quality-governance` or `test-governance` |
| `temporarily-retain` | The warning needs a dedicated proof lane or is low-value style cleanup. | `proof-lane` or `quality-governance` |

At the current baseline, `fix` and `delete-after-proof` are zero. If a future
React Doctor run produces either bucket, the classified governance gate should
fail until the item is repaired, removed after proof, or reclassified with
owner and reason.

## Current known shape

The initial integrated scan had 516 warnings and 0 errors.

After the first production repair waves and classifier calibration, the current
classified backlog has 0 `confirmed-real` warnings and 0 unresolved warnings.
This still does not mean raw warnings are ready to block CI, because test
fixture noise, proof-heavy items, project exceptions, and low-value style
cleanup remain.

Most warning volume is not production behavior:

- test and fixture files are the largest source
- many production findings are style shorthand suggestions
- scripts mostly trigger performance micro-optimization rules
- several warnings are known project exceptions
- static loading skeleton keys, decorative grid crosshair keys, pure content
  render helpers, and user-entered email line keys are not treated as immediate
  production bugs
- lazy client island activation state warnings are documented project
  exceptions when tests prove that state drives the render branch
- quality script warnings are handled in a separate proof lane before any
  rewrite; string/document scans and ordered Cloudflare smoke probes are
  documented exceptions, not batch performance cleanup targets
- the remaining sanitizer warnings stay in `needs-manual-proof` until a
  dedicated security proof lane covers nested tags, missing closing tags,
  mixed casing, and attacker-controlled payloads

## Warning gate decision

Warning-level CI blocking is deferred until project exceptions are stable, proof lanes are resolved or separately gated, and test fixture noise is excluded from release blocking.

Do not change the CI gate to `--fail-on warning`. If warning enforcement is added later, it should be a separate classified gate that targets only production `confirmed-real` warnings after the proof lanes are stable.

## Rules of repair

1. Do not treat warning count as bug count.
2. Do not delete code from dead-code tools without runtime and script proof.
3. Do not rewrite tests only to improve a score.
4. Do not migrate `forwardRef` or `useContext` mechanically.
5. Do not treat JSON-LD `dangerouslySetInnerHTML` as a normal XSS bug when the JSON serializer is escaping unsafe characters.
6. Keep React Doctor warning cleanup out of release blocking until the warning signal is stable.
