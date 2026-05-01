#!/usr/bin/env node

const { ensureSemgrep, run } = require("./semgrep-common");

const FILE_CONTRACT_FIXTURES = [
  {
    ruleId: "env-access-bypass-in-config",
    config: "tests/semgrep/rules/env-access-bypass-in-config.yaml",
    target: "tests/semgrep/targets/src/config/example-config.ts",
    expectedFindings: 2,
  },
  {
    ruleId: "env-access-bypass-in-config",
    config: "tests/semgrep/rules/env-access-bypass-in-config.yaml",
    target: "tests/semgrep/targets/src/config/security.ts",
    expectedFindings: 0,
  },
  {
    ruleId: "critical-lead-route-missing-idempotency",
    config: "tests/semgrep/rules/critical-lead-route-missing-idempotency.yaml",
    target: "tests/semgrep/targets/src/app/api/inquiry/route.ts",
    expectedFindings: 0,
  },
  {
    ruleId: "critical-lead-route-missing-idempotency",
    config: "tests/semgrep/rules/critical-lead-route-missing-idempotency.yaml",
    target: "tests/semgrep/targets/src/app/api/subscribe/route.ts",
    expectedFindings: 0,
  },
  {
    ruleId: "object-injection-untrusted-key-write",
    config: "tests/semgrep/rules/object-injection-untrusted-key-write.yaml",
    target: "tests/semgrep/targets/object-injection-untrusted-key-write.ts",
    expectedFindings: 3,
  },
];

function parseSemgrepJson(result, description) {
  const stdout = (result.stdout || "").trim();
  if (!stdout) {
    throw new Error(`${description} returned no JSON output`);
  }

  try {
    return JSON.parse(stdout);
  } catch (error) {
    throw new Error(
      `${description} returned invalid JSON: ${error.message}\n${stdout}`,
      { cause: error },
    );
  }
}

function runFileContractFixtures(semgrepPath) {
  for (const fixture of FILE_CONTRACT_FIXTURES) {
    const result = run(semgrepPath, [
      "scan",
      "--quiet",
      "--json",
      "--config",
      fixture.config,
      fixture.target,
    ]);

    if (result.status !== 0 && result.status !== 1) {
      const output = [result.stdout, result.stderr]
        .filter(Boolean)
        .join("\n")
        .trim();
      throw new Error(
        `Semgrep fixture scan failed for ${fixture.target}: ${output || `exit ${result.status}`}`,
      );
    }

    const payload = parseSemgrepJson(
      result,
      `Semgrep fixture scan for ${fixture.target}`,
    );
    const findings = (payload.results || []).filter(
      (item) =>
        item.check_id === fixture.ruleId ||
        item.check_id.endsWith(`.${fixture.ruleId}`),
    );

    if (findings.length !== fixture.expectedFindings) {
      throw new Error(
        [
          `Unexpected findings for ${fixture.target}`,
          `rule=${fixture.ruleId}`,
          `expected=${fixture.expectedFindings}`,
          `actual=${findings.length}`,
        ].join(" "),
      );
    }
  }

  console.log(
    `File-contract Semgrep fixtures: ${FILE_CONTRACT_FIXTURES.length}/${FILE_CONTRACT_FIXTURES.length} passed`,
  );
}

function main() {
  const semgrepPath = ensureSemgrep();
  const result = run(semgrepPath, [
    "scan",
    "--test",
    "--config",
    "tests/semgrep/rules",
    "tests/semgrep/targets",
  ]);

  const output = [result.stdout, result.stderr]
    .filter(Boolean)
    .join("\n")
    .trim();
  if (output) {
    console.log(output);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  runFileContractFixtures(semgrepPath);

  process.exit(0);
}

try {
  main();
} catch (error) {
  console.error(`Semgrep rule tests failed: ${error.message}`);
  process.exit(2);
}
