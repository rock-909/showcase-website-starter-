#!/usr/bin/env node
"use strict";

/**
 * Component governance scanner.
 *
 * This is an obvious-violation text scan, not a full AST/CSS lint. It catches
 * governance drift that is cheap to detect before Storybook or architecture
 * checks run.
 */

const fs = require("fs");
const path = require("path");
const { writeGuardrailSummary } = require("./lib/guardrail-report.js");

const REGISTRY_PATH = "src/components/component-governance.registry.json";
const COMPONENTS_ROOT = "src/components";
const APP_ROOT = "src/app";
const UI_ROOT = "src/components/ui";
const STORY_WARNING_ROOTS = [
  "src/components/contact",
  "src/components/footer",
  "src/components/forms",
  "src/components/products",
  "src/components/sections",
];
const REQUIRED_STORY_VALUE = "required";
const SOURCE_FILE_PATTERN = /\.(?:ts|tsx|js|jsx)$/;
const UI_PRIMITIVE_FILE_PATTERN = /\.(?:tsx|jsx)$/;
const EXCLUDED_FILE_PATTERN =
  /(?:\.stories\.[^.]+|\.(?:test|spec)\.[^.]+|\/__tests__\/)/;
const RADIX_IMPORT_PATTERN = /from\s+["']@radix-ui\//;
const STATIC_THEME_COLORS_MODULE_PATTERN =
  "(?:@/config/static-theme-colors|(?:\\.\\.?/)+config/static-theme-colors)";
const STATIC_THEME_COLORS_IMPORT_PATTERN = new RegExp(
  `(?:from\\s+["']${STATIC_THEME_COLORS_MODULE_PATTERN}["']|import\\s*\\(\\s*["']${STATIC_THEME_COLORS_MODULE_PATTERN}["']\\s*\\)|require\\s*\\(\\s*["']${STATIC_THEME_COLORS_MODULE_PATTERN}["']\\s*\\))`,
);
const RAW_TAILWIND_PALETTE_CLASS_PATTERN =
  /(?:^|[\s"'`])(?:[a-z-]+:)*(?:bg|text|border|ring|outline|divide|from|via|to|stroke|fill)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}(?:\/\d{1,3})?(?=$|[\s"'`])/;

function toRelativePath(rootDir, filePath) {
  return path.relative(rootDir, filePath).replaceAll("\\", "/");
}

function exists(rootDir, relativePath) {
  return fs.existsSync(path.join(rootDir, relativePath));
}

function readText(rootDir, relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

function getLineNumber(source, pattern) {
  const lines = source.split("\n");
  const index = lines.findIndex((line) => pattern.test(line));
  return index === -1 ? 1 : index + 1;
}

function walkFiles(rootDir, relativeRoot) {
  const absoluteRoot = path.join(rootDir, relativeRoot);
  if (!fs.existsSync(absoluteRoot)) return [];

  const files = [];
  const pending = [absoluteRoot];

  while (pending.length > 0) {
    const currentDir = pending.pop();
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const absolutePath = path.join(currentDir, entry.name);
      const relativePath = toRelativePath(rootDir, absolutePath);

      if (entry.isDirectory()) {
        if (entry.name === "__tests__") continue;
        pending.push(absolutePath);
        continue;
      }

      if (entry.isFile()) {
        files.push(relativePath);
      }
    }
  }

  return files.sort();
}

function getScannedSourceFiles(rootDir) {
  return [COMPONENTS_ROOT, APP_ROOT]
    .flatMap((root) => walkFiles(rootDir, root))
    .filter((file) => SOURCE_FILE_PATTERN.test(file))
    .filter((file) => !EXCLUDED_FILE_PATTERN.test(file));
}

function getUiPrimitiveNames(rootDir) {
  return walkFiles(rootDir, UI_ROOT)
    .filter((file) => path.dirname(file) === UI_ROOT)
    .filter((file) => UI_PRIMITIVE_FILE_PATTERN.test(file))
    .filter((file) => !EXCLUDED_FILE_PATTERN.test(file))
    .map((file) => path.basename(file).replace(UI_PRIMITIVE_FILE_PATTERN, ""))
    .sort();
}

function createFinding(file, kind, detail, line = 1) {
  return { file, line, kind, detail };
}

function readRegistry(rootDir, errors) {
  if (!exists(rootDir, REGISTRY_PATH)) {
    errors.push(
      createFinding(
        REGISTRY_PATH,
        "registry-missing",
        "Component governance registry is missing.",
      ),
    );
    return null;
  }

  try {
    return JSON.parse(readText(rootDir, REGISTRY_PATH));
  } catch (error) {
    errors.push(
      createFinding(
        REGISTRY_PATH,
        "registry-invalid-json",
        `Component governance registry is not valid JSON: ${error.message}`,
      ),
    );
    return null;
  }
}

function collectRegistryFindings(rootDir, registry, errors) {
  if (!registry || typeof registry !== "object") return;

  const components = registry.components;
  if (!components || typeof components !== "object") {
    errors.push(
      createFinding(
        REGISTRY_PATH,
        "registry-components-missing",
        "Registry must define a components object.",
      ),
    );
    return;
  }

  const primitiveNames = getUiPrimitiveNames(rootDir);
  const primitiveNameSet = new Set(primitiveNames);
  const registeredNames = Object.keys(components).sort();
  const registeredNameSet = new Set(registeredNames);

  for (const primitiveName of primitiveNames) {
    if (!registeredNameSet.has(primitiveName)) {
      errors.push(
        createFinding(
          `${UI_ROOT}/${primitiveName}.tsx`,
          "ui-primitive-missing-from-registry",
          `UI primitive "${primitiveName}" is missing from the governance registry.`,
        ),
      );
    }
  }

  for (const componentName of registeredNames) {
    const component = components[componentName];

    if (!primitiveNameSet.has(componentName)) {
      errors.push(
        createFinding(
          `${UI_ROOT}/${componentName}.tsx`,
          "registry-primitive-missing-source",
          `Registry lists "${componentName}", but the UI primitive file does not exist.`,
        ),
      );
    }

    if (
      !component ||
      typeof component !== "object" ||
      !Object.prototype.hasOwnProperty.call(component, "story")
    ) {
      errors.push(
        createFinding(
          REGISTRY_PATH,
          "registry-story-missing",
          `Registry item "${componentName}" must define story governance.`,
        ),
      );
      continue;
    }

    if (component.story !== REQUIRED_STORY_VALUE) {
      errors.push(
        createFinding(
          REGISTRY_PATH,
          "registry-story-invalid",
          `Registry item "${componentName}" story must be "required".`,
        ),
      );
      continue;
    }

    const storyPath = `${UI_ROOT}/${componentName}.stories.tsx`;
    if (!exists(rootDir, storyPath)) {
      errors.push(
        createFinding(
          storyPath,
          "required-story-missing",
          `Required story for UI primitive "${componentName}" is missing.`,
        ),
      );
    }
  }
}

function collectTextScanFindings(rootDir, errors) {
  for (const file of getScannedSourceFiles(rootDir)) {
    const source = readText(rootDir, file);

    if (!file.startsWith(`${UI_ROOT}/`) && RADIX_IMPORT_PATTERN.test(source)) {
      errors.push(
        createFinding(
          file,
          "radix-import-outside-ui",
          "Production UI must import Radix through src/components/ui wrappers.",
          getLineNumber(source, RADIX_IMPORT_PATTERN),
        ),
      );
    }

    if (RAW_TAILWIND_PALETTE_CLASS_PATTERN.test(source)) {
      errors.push(
        createFinding(
          file,
          "raw-tailwind-palette-class",
          "Production UI must use design tokens instead of obvious raw Tailwind palette classes.",
          getLineNumber(source, RAW_TAILWIND_PALETTE_CLASS_PATTERN),
        ),
      );
    }

    if (STATIC_THEME_COLORS_IMPORT_PATTERN.test(source)) {
      errors.push(
        createFinding(
          file,
          "static-theme-colors-browser-import",
          "Browser UI must not import static theme color config directly.",
          getLineNumber(source, STATIC_THEME_COLORS_IMPORT_PATTERN),
        ),
      );
    }
  }
}

function getMatchingStoryPath(componentFile) {
  return componentFile.replace(/\.(?:tsx|jsx)$/, ".stories.tsx");
}

function isBusinessComponentOrSection(file) {
  if (!/\.(?:tsx|jsx)$/.test(file)) return false;
  if (!file.startsWith(`${COMPONENTS_ROOT}/`)) return false;
  if (file.startsWith(`${UI_ROOT}/`)) return false;
  if (EXCLUDED_FILE_PATTERN.test(file)) return false;
  if (!STORY_WARNING_ROOTS.some((root) => file.startsWith(`${root}/`))) {
    return false;
  }
  return true;
}

function collectStoryWarnings(rootDir, warnings) {
  for (const file of walkFiles(rootDir, COMPONENTS_ROOT)) {
    if (!isBusinessComponentOrSection(file)) continue;

    const storyPath = getMatchingStoryPath(file);
    if (!exists(rootDir, storyPath)) {
      warnings.push(
        createFinding(
          file,
          "business-component-missing-story",
          `Business component or section should have a matching story at ${storyPath}.`,
        ),
      );
    }
  }
}

function collectComponentGovernanceFindings(rootDir = process.cwd()) {
  const errors = [];
  const warnings = [];
  const registry = readRegistry(rootDir, errors);

  collectRegistryFindings(rootDir, registry, errors);
  collectTextScanFindings(rootDir, errors);
  collectStoryWarnings(rootDir, warnings);

  return {
    status: errors.length === 0 ? "passed" : "failed",
    errors,
    warnings,
  };
}

function main() {
  const payload = collectComponentGovernanceFindings(process.cwd());
  writeGuardrailSummary("component-governance", payload);

  console.log(
    `[component-governance] ${payload.status}: ${payload.errors.length} error(s), ${payload.warnings.length} warning(s)`,
  );

  for (const error of payload.errors) {
    console.log(
      `- ERROR ${error.file}:${error.line} ${error.kind}: ${error.detail}`,
    );
  }

  for (const warning of payload.warnings) {
    console.log(
      `- WARN ${warning.file}:${warning.line} ${warning.kind}: ${warning.detail}`,
    );
  }

  if (payload.status === "failed") {
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  collectComponentGovernanceFindings,
};
