# React Doctor Policy

React Doctor is an error-level gate in this starter.

## Gate policy

- `error` blocks CI.
- `warning` is backlog until classified.
- React Doctor native scan should stay at `0 warning / 0 error` after project
  calibration.
- `react-doctor.config.json` may suppress only narrow file/rule combinations
  that are backed by this policy, the exception registry, or the classified
  governance report.
- Do not add broad `ignore.rules` or whole-directory `ignore.files` entries for
  convenience.
- CI also runs the classified governance gate. The classified gate blocks on any `blocking-error` or `confirmed-real` diagnostic that has not been fixed or otherwise classified with owner and reason.
- CI also runs a raw-governance gate against the pre-suppression diagnostics.
  That gate verifies the native suppression config still matches the current
  raw file/rule set and does not use global rule or whole-file ignores.

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

At the current calibrated baseline, native React Doctor reports zero issues.
Historical diagnostics are represented by narrow project config overrides and
the governance docs. If a future raw React Doctor run produces a diagnostic
outside that config, the raw-governance gate should fail until the item is
repaired, removed after proof, or reclassified with owner and reason.

## Current known shape

The initial integrated scan had 516 warnings and 0 errors.

After the production repair waves, sanitizer proof lane, and config
calibration, the native scan is 0 warning / 0 error. The historical backlog is
still documented so future agents understand why each suppressed file/rule pair
is not a hidden bug.

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
- sanitizer warnings were fixed after a dedicated security proof lane covered
  nested tags, missing closing tags, mixed casing, and attacker-controlled
  payloads

## Warning gate decision

Raw warning-level CI blocking is still not used, because warning handling is
owned by a calibrated config plus raw governance classification. The effective
target is nevertheless native React Doctor 0 warning / 0 error.

Do not change the CI gate to `--fail-on warning` unless the team intentionally
decides that the current `react-doctor.config.json` should be treated as the
canonical suppression baseline for warning-level blocking.

## Rules of repair

1. Do not treat warning count as bug count.
2. Do not delete code from dead-code tools without runtime and script proof.
3. Do not rewrite tests only to improve a score.
4. Do not migrate `forwardRef` or `useContext` mechanically.
5. Do not treat JSON-LD `dangerouslySetInnerHTML` as a normal XSS bug when the JSON serializer is escaping unsafe characters.
6. Keep React Doctor warning cleanup out of release blocking until the warning signal is stable.
