"use strict";

function readEnvString(key) {
  const value = process.env[key];
  return typeof value === "string" ? value : undefined;
}

function readEnvBoolean(key, trueValues = ["true"]) {
  const value = readEnvString(key);
  if (value === undefined) {
    return undefined;
  }

  return trueValues.includes(value);
}

function readEnvNumber(key) {
  const value = readEnvString(key);
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function isNodeEnv(expected) {
  return readEnvString("NODE_ENV") === expected;
}

function isProductionBuildPhase() {
  return readEnvString("NEXT_PHASE") === "phase-production-build";
}

module.exports = {
  isNodeEnv,
  isProductionBuildPhase,
  readEnvBoolean,
  readEnvNumber,
  readEnvString,
};
