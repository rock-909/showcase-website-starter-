const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { readEnvString } = require("./lib/runtime-env");

function pickPython() {
  const fromEnv = readEnvString("SEMGREP_PYTHON");
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;

  const candidates = [
    "/Library/Frameworks/Python.framework/Versions/3.12/bin/python3",
    "/Library/Frameworks/Python.framework/Versions/3.11/bin/python3",
    "/Library/Frameworks/Python.framework/Versions/3.10/bin/python3",
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  return "python3";
}

function run(cmd, args, options = {}) {
  return spawnSync(cmd, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
}

function findSemgrep() {
  const fromEnv = readEnvString("SEMGREP_BIN");
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;

  const home = readEnvString("HOME") || "";
  const candidates = [
    path.join(home, ".local", "bin", "semgrep"),
    "/Library/Frameworks/Python.framework/Versions/3.12/bin/semgrep",
    "/Library/Frameworks/Python.framework/Versions/3.11/bin/semgrep",
    "/Library/Frameworks/Python.framework/Versions/3.10/bin/semgrep",
    "/usr/local/bin/semgrep",
    "/opt/homebrew/bin/semgrep",
    "/usr/bin/semgrep",
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  const which = run("bash", ["-lc", "command -v semgrep || true"]);
  const found = (which.stdout || "").trim();
  return found || null;
}

function ensureSemgrep() {
  const existing = findSemgrep();
  if (existing) return existing;

  const install = run(pickPython(), [
    "-m",
    "pip",
    "install",
    "--user",
    "semgrep<2",
  ]);
  if (install.status !== 0) {
    throw new Error(
      `Semgrep install failed: ${(install.stderr || install.stdout || "").trim()}`,
    );
  }

  const installed = findSemgrep();
  if (!installed) {
    throw new Error("Semgrep not found after installation");
  }

  const versionCheck = run(installed, ["--version"]);
  if (versionCheck.status !== 0) {
    throw new Error(
      `Semgrep not runnable after installation: ${(versionCheck.stderr || versionCheck.stdout || "").trim()}`,
    );
  }

  return installed;
}

module.exports = {
  ensureSemgrep,
  run,
};
