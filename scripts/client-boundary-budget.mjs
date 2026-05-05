#!/usr/bin/env node

import { parse } from "@babel/parser";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_ROOT = process.cwd();
const BUDGET_PATH = "docs/quality/client-boundary-budget.json";
const REPORT_PATH = "reports/quality/client-boundary-budget.json";
const SOURCE_ROOT = "src";
const BUDGET_VERSION = 1;
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);
const EXCLUDED_DIR_NAMES = new Set([
  "__fixtures__",
  "__mocks__",
  "__tests__",
  "mock",
  "mocks",
  "spec",
  "specs",
  "stories",
  "storybook",
  ".storybook",
]);
const EXCLUDED_FILE_PATTERN =
  /\.(?:mock|spec|stories|story|test)\.[cm]?(?:ts|tsx)$/u;

function toRepoPath(rootDir, absolutePath) {
  return path.relative(rootDir, absolutePath).split(path.sep).join("/");
}

function isExcludedPath(repoPath) {
  if (repoPath.startsWith("src/test/")) return true;
  if (repoPath.startsWith("src/testing/")) return true;
  if (EXCLUDED_FILE_PATTERN.test(repoPath)) return true;

  return repoPath.split("/").some((part) => EXCLUDED_DIR_NAMES.has(part));
}

function collectSourceFiles(rootDir) {
  const srcDir = path.join(rootDir, SOURCE_ROOT);
  const results = [];
  if (!fs.existsSync(srcDir)) return results;

  function walk(currentPath) {
    const repoPath = toRepoPath(rootDir, currentPath);
    if (isExcludedPath(repoPath)) return;

    const stats = fs.statSync(currentPath);
    if (stats.isDirectory()) {
      for (const entry of fs.readdirSync(currentPath, {
        withFileTypes: true,
      })) {
        walk(path.join(currentPath, entry.name));
      }
      return;
    }

    if (stats.isFile() && SOURCE_EXTENSIONS.has(path.extname(currentPath))) {
      results.push(currentPath);
    }
  }

  walk(srcDir);
  return results.sort((left, right) => left.localeCompare(right));
}

function hasTopLevelUseClientDirective(source) {
  const ast = parse(source, {
    sourceType: "module",
    plugins: ["jsx", "typescript"],
  });

  return ast.program.directives.some(
    (directive) => directive.value.value === "use client",
  );
}

function collectClientBoundaryFiles(rootDir = DEFAULT_ROOT) {
  return collectSourceFiles(rootDir)
    .filter((filePath) =>
      hasTopLevelUseClientDirective(fs.readFileSync(filePath, "utf8")),
    )
    .map((filePath) => toRepoPath(rootDir, filePath))
    .sort((left, right) => left.localeCompare(right));
}

function createBudgetError(kind, message) {
  return {
    kind,
    file: BUDGET_PATH,
    message,
  };
}

function isValidBudgetShape(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    value.version === BUDGET_VERSION &&
    Number.isInteger(value.maxClientBoundaries) &&
    value.maxClientBoundaries >= 0 &&
    Array.isArray(value.allowedClientBoundaries) &&
    value.allowedClientBoundaries.every((item) => typeof item === "string")
  );
}

function readBudget(rootDir) {
  const budgetFile = path.join(rootDir, BUDGET_PATH);
  if (!fs.existsSync(budgetFile)) {
    return {
      budget: null,
      errors: [
        createBudgetError(
          "budget-missing",
          "Client boundary budget file is missing.",
        ),
      ],
    };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(budgetFile, "utf8"));
    if (!isValidBudgetShape(parsed)) {
      return {
        budget: null,
        errors: [
          createBudgetError(
            "budget-invalid",
            "Client boundary budget must define version 1, maxClientBoundaries, and allowedClientBoundaries.",
          ),
        ],
      };
    }

    return {
      budget: {
        version: parsed.version,
        maxClientBoundaries: parsed.maxClientBoundaries,
        allowedClientBoundaries: [...parsed.allowedClientBoundaries].sort(
          (left, right) => left.localeCompare(right),
        ),
      },
      errors: [],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      budget: null,
      errors: [createBudgetError("budget-invalid-json", message)],
    };
  }
}

function writeReport(rootDir, payload) {
  const reportFile = path.join(rootDir, REPORT_PATH);
  fs.mkdirSync(path.dirname(reportFile), { recursive: true });
  fs.writeFileSync(reportFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function createUnexpectedBoundaryErrors(clientBoundaries, budget) {
  const allowed = new Set(budget.allowedClientBoundaries);
  return clientBoundaries
    .filter((file) => !allowed.has(file))
    .map((file) => ({
      kind: "unexpected-client-boundary",
      file,
      message: "Client boundary is not listed in the committed budget.",
    }));
}

function createStaleBoundaryErrors(clientBoundaries, budget) {
  const actual = new Set(clientBoundaries);
  return budget.allowedClientBoundaries
    .filter((file) => !actual.has(file))
    .map((file) => ({
      kind: "stale-client-boundary",
      file,
      message:
        "Client boundary is listed in the committed budget but is not detected in src.",
    }));
}

function createBudgetExceededError(clientBoundaries, budget) {
  if (clientBoundaries.length <= budget.maxClientBoundaries) return null;

  return createBudgetError(
    "budget-exceeded",
    `Detected ${clientBoundaries.length} client boundaries, but the budget allows ${budget.maxClientBoundaries}.`,
  );
}

function runClientBoundaryBudgetCheck(rootDir = DEFAULT_ROOT) {
  const clientBoundaries = collectClientBoundaryFiles(rootDir);
  const { budget, errors: budgetErrors } = readBudget(rootDir);
  const errors = [...budgetErrors];
  let unexpectedClientBoundaries = [];
  let staleClientBoundaries = [];

  if (budget) {
    const unexpectedErrors = createUnexpectedBoundaryErrors(
      clientBoundaries,
      budget,
    );
    unexpectedClientBoundaries = unexpectedErrors.map((error) => error.file);
    errors.push(...unexpectedErrors);

    const staleErrors = createStaleBoundaryErrors(clientBoundaries, budget);
    staleClientBoundaries = staleErrors.map((error) => error.file);
    errors.push(...staleErrors);

    const budgetExceededError = createBudgetExceededError(
      clientBoundaries,
      budget,
    );
    if (budgetExceededError) errors.push(budgetExceededError);
  }

  const result = {
    status: errors.length === 0 ? "passed" : "failed",
    budgetPath: BUDGET_PATH,
    reportPath: REPORT_PATH,
    clientBoundaries,
    unexpectedClientBoundaries,
    staleClientBoundaries,
    maxClientBoundaries: budget?.maxClientBoundaries ?? null,
    errors,
  };

  writeReport(rootDir, {
    createdAt: new Date().toISOString(),
    ...result,
  });

  return result;
}

function main() {
  const result = runClientBoundaryBudgetCheck(DEFAULT_ROOT);

  console.log(
    `[client-boundary-budget] ${result.status}: ${result.clientBoundaries.length} client boundary file(s)`,
  );

  for (const error of result.errors) {
    console.log(`- ERROR ${error.file} ${error.kind}: ${error.message}`);
  }

  if (result.status === "failed") {
    process.exit(1);
  }
}

const isCli = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (isCli) {
  main();
}

export {
  collectClientBoundaryFiles,
  hasTopLevelUseClientDirective,
  runClientBoundaryBudgetCheck,
};
