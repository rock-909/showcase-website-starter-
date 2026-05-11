# React Doctor Baseline

React Doctor is integrated as an error-level CI gate.

Current policy:

- error blocks CI
- warning is backlog
- warning is not yet merge-blocking

Fresh baseline:

```text
errorCount: 0
warningCount: 516
affectedFileCount: 173
score: 66 / 100
```

Warning breakdown:

```text
Architecture: 204
Performance: 156
Accessibility: 53
Server: 52
Correctness: 22
Next.js: 15
State & Effects: 10
Bundle Size: 2
Security: 2
```

File type split:

```text
tests: 324
prod: 192
```

## Policy files

- Policy: `docs/quality/react-doctor-policy.md`
- Exceptions: `docs/quality/react-doctor-exceptions.md`

The current baseline is a warning backlog. It is not a release blocker and it is not a count of real production bugs.

Do not switch to `--fail-on warning` until false positives, dead-code candidates, and test fixture noise are triaged.
