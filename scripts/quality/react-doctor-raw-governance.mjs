import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  assertGovernance,
  assertSuppressionCoverage,
  classifyDiagnostics,
} from "./react-doctor-classify.mjs";

const REPO_ROOT = path.resolve(import.meta.dirname, "../..");
const RAW_REPORT_PATH = path.join(
  os.tmpdir(),
  "showcase-react-doctor-raw-current.json",
);
const CLASSIFIED_REPORT_PATH = path.join(
  os.tmpdir(),
  "showcase-react-doctor-raw-classified.json",
);
const TEMP_CONFIG_ROOT = path.join(os.tmpdir(), "react-doctor-raw-config");
const TEMP_CONFIG_PATH = path.join(TEMP_CONFIG_ROOT, "react-doctor.config.json");
const PROJECT_CONFIG_PATH = path.join(REPO_ROOT, "react-doctor.config.json");
const REACT_DOCTOR_BIN = path.join(
  REPO_ROOT,
  "node_modules/.bin/react-doctor",
);

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

writeJson(TEMP_CONFIG_PATH, { rootDir: REPO_ROOT });

const result = spawnSync(
  REACT_DOCTOR_BIN,
  [TEMP_CONFIG_ROOT, "--offline", "--json", "--fail-on", "none"],
  {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 64,
  },
);

if (result.error) {
  throw result.error;
}

if (result.status !== 0) {
  process.stderr.write(result.stderr);
  process.stderr.write(result.stdout);
  throw new Error(`React Doctor raw scan exited with ${result.status}`);
}

fs.writeFileSync(RAW_REPORT_PATH, result.stdout);

const rawReport = JSON.parse(result.stdout);
const config = JSON.parse(fs.readFileSync(PROJECT_CONFIG_PATH, "utf8"));
const diagnostics = rawReport.projects?.[0]?.diagnostics ?? [];
const classified = classifyDiagnostics(diagnostics);

assertGovernance(classified);
assertSuppressionCoverage(classified, config);
writeJson(CLASSIFIED_REPORT_PATH, classified);

console.log(
  [
    `[react-doctor-raw-governance] raw diagnostics: ${classified.summary.total}`,
    `[react-doctor-raw-governance] unresolved: ${classified.summary.unresolved}`,
    "[react-doctor-raw-governance] suppression coverage check passed",
    `[react-doctor-raw-governance] wrote ${CLASSIFIED_REPORT_PATH}`,
  ].join("\n"),
);
