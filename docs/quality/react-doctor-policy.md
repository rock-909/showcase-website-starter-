# React Doctor Policy

React Doctor is an error-level gate in this starter.

## Gate policy

- `error` blocks CI.
- `warning` is backlog.
- Do not use `--fail-on warning` until warnings are classified, exceptions are documented, and test fixture noise is isolated.

## Buckets

| Bucket | Meaning | Merge impact |
| --- | --- | --- |
| `blocking-error` | React Doctor error. | Blocks. |
| `confirmed-real` | Real production risk or quality debt with clear proof. | Fix in repair waves. |
| `needs-manual-proof` | Rule may be right, but hidden runtime or order dependencies need proof. | Do not batch-fix. |
| `project-exception` | Tool rule is generally good, but this repo has a documented exception. | Do not fix unless the exception changes. |
| `test-fixture-noise` | Test or support fixture warning. | Do not block release. |
| `low-value-style` | Style or micro-optimization. | Cleanup only after higher-value work. |

## Current known shape

The initial integrated scan had 516 warnings and 0 errors.

Most warning volume is not production behavior:

- test and fixture files are the largest source
- many production findings are style shorthand suggestions
- scripts mostly trigger performance micro-optimization rules
- several warnings are known project exceptions

## Warning gate decision

Warning-level CI blocking is deferred until `confirmed-real <= 10`, all project exceptions are documented, and test fixture noise is excluded from release blocking.

Do not change the CI gate to `--fail-on warning`. If warning enforcement is added later, it should be a separate classified gate that targets only production `confirmed-real` warnings after the proof lanes are stable.

## Rules of repair

1. Do not treat warning count as bug count.
2. Do not delete code from dead-code tools without runtime and script proof.
3. Do not rewrite tests only to improve a score.
4. Do not migrate `forwardRef` or `useContext` mechanically.
5. Do not treat JSON-LD `dangerouslySetInnerHTML` as a normal XSS bug when the JSON serializer is escaping unsafe characters.
6. Keep React Doctor warning cleanup out of release blocking until the warning signal is stable.
