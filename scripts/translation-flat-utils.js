#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const LOCALES = require("../i18n-locales.config").locales;
const MESSAGES_DIR = path.join(ROOT, "messages");

function deepMerge(target, source) {
  const result = { ...target };
  for (const [key, value] of Object.entries(source)) {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      result[key] &&
      typeof result[key] === "object" &&
      !Array.isArray(result[key])
    ) {
      result[key] = deepMerge(result[key], value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function collectLeafPaths(obj, prefix = "") {
  const paths = [];

  if (!isPlainObject(obj)) {
    return paths;
  }

  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;

    if (isPlainObject(value)) {
      paths.push(...collectLeafPaths(value, path));
    } else {
      paths.push(path);
    }
  }

  return paths;
}

function getNestedValue(obj, path) {
  return path.split(".").reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
}

function setNestedValue(obj, path, value) {
  const keys = path.split(".");
  const lastKey = keys.pop();

  let current = obj;
  for (const key of keys) {
    if (!isPlainObject(current[key])) {
      current[key] = {};
    }
    current = current[key];
  }

  current[lastKey] = value;
}

function asSet(values) {
  return new Set(values);
}

function diffSets(a, b) {
  const out = [];
  for (const value of a) {
    if (!b.has(value)) out.push(value);
  }
  return out;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function getLocaleSplitPaths(locale) {
  return {
    locale,
    critical: path.join(MESSAGES_DIR, locale, "critical.json"),
    deferred: path.join(MESSAGES_DIR, locale, "deferred.json"),
    flat: path.join(MESSAGES_DIR, `${locale}.json`),
  };
}

function loadLocaleSplit(locale) {
  const paths = getLocaleSplitPaths(locale);
  const critical = readJson(paths.critical);
  const deferred = readJson(paths.deferred);

  return {
    ...paths,
    critical,
    deferred,
    merged: deepMerge(critical, deferred),
  };
}

function writeFlatTranslation(locale, merged) {
  const { flat } = getLocaleSplitPaths(locale);
  writeJson(flat, merged);
  return flat;
}

module.exports = {
  LOCALES,
  MESSAGES_DIR,
  deepMerge,
  isPlainObject,
  collectLeafPaths,
  getNestedValue,
  setNestedValue,
  asSet,
  diffSets,
  readJson,
  writeJson,
  getLocaleSplitPaths,
  loadLocaleSplit,
  writeFlatTranslation,
};
