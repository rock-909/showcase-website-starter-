#!/usr/bin/env node

import { parse } from "@babel/parser";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_ROOT = process.cwd();
const LOGO_REFERENCE = "/images/logo.svg";
const LOGO_ASSET_PATH = "public/images/logo.svg";
const MARKDOWN_LOGO_REFERENCE_PATTERN =
  /!?\[[^\]]*\]\(\s*<?\/images\/logo\.svg>?(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)/iu;
const ATTRIBUTE_LOGO_REFERENCE_PATTERN =
  /\b(?:href|src)\s*=\s*(?:"\/images\/logo\.svg"|'\/images\/logo\.svg'|\{\s*(?:"\/images\/logo\.svg"|'\/images\/logo\.svg'|`\/images\/logo\.svg`)\s*\})/iu;

const SCAN_TARGETS = [
  {
    root: "content/pages",
    extensions: new Set([".md", ".mdx"]),
    scanTextRules: true,
  },
  {
    root: "messages",
    extensions: new Set([".json"]),
    allowedPathPattern: /^messages\/[^/]+\/(?:critical|deferred)\.json$/u,
    scanTextRules: true,
  },
  {
    root: "public/images",
    extensions: new Set([".svg"]),
    scanTextRules: false,
    scanPathRules: true,
  },
  {
    root: "src/config/website",
    extensions: new Set([".js", ".json", ".mjs", ".ts", ".tsx"]),
    scanTextRules: true,
  },
];

const GENERATED_DIR_NAMES = new Set([
  ".git",
  ".next",
  ".open-next",
  ".wrangler",
  "coverage",
  "dist",
  "generated",
  "node_modules",
  "reports",
  "storybook-static",
]);

const EXCLUDED_FILE_PATTERN =
  /(?:^|\/)(?:__tests__|__mocks__)(?:\/|$)|\.(?:test|spec)\.[^.]+$/u;

const TEXT_RULES = [
  {
    ruleId: "fake-phone",
    severity: "error",
    pattern:
      /(?:\+?1[\s.-]?)?(?:\(?555\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b|\b123[\s.-]?456[\s.-]?7890\b/giu,
    message: "Fake phone marker is present in buyer-visible content.",
  },
  {
    ruleId: "sample-product",
    severity: "warning",
    pattern: /\bsample(?:[\s_-]+)product\b/giu,
    message:
      "Starter sample product text is still present. Replace it before launch.",
  },
  {
    ruleId: "replace-this-image",
    severity: "warning",
    pattern: /\breplace this image\b/giu,
    message:
      "Image replacement placeholder is still present. Replace it before launch.",
  },
  {
    ruleId: "todo-marker",
    severity: "error",
    pattern: /\bTODO\b/gu,
    message: "TODO marker is present in buyer-visible content.",
  },
  {
    ruleId: "lorem-ipsum",
    severity: "error",
    pattern: /\blorem ipsum\b/giu,
    message: "Lorem ipsum filler text is still present.",
  },
  {
    ruleId: "your-company",
    severity: "warning",
    pattern: /\byour company\b/giu,
    message:
      "Generic company placeholder text is still present. Replace it before launch.",
  },
  {
    ruleId: "your-email",
    severity: "warning",
    pattern: /\byour@email\b/giu,
    message:
      "Generic email placeholder text is still present. Replace it before launch.",
  },
  {
    ruleId: "placeholder",
    severity: "warning",
    pattern: /\bplaceholder\b/giu,
    message:
      "Placeholder marker is present. Confirm it is intentional before launch.",
  },
  {
    ruleId: "example-domain",
    severity: "warning",
    pattern: /\bexample\.com\b/giu,
    message:
      "example.com appears in buyer-visible input. Confirm it is intentional before launch.",
  },
];

const CONFIG_SOURCE_EXTENSIONS = new Set([".js", ".mjs", ".ts", ".tsx"]);
const TS_TYPE_ONLY_NODE_TYPES = new Set([
  "TSArrayType",
  "TSConditionalType",
  "TSConstructorType",
  "TSDeclareFunction",
  "TSExportAssignment",
  "TSExpressionWithTypeArguments",
  "TSFunctionType",
  "TSImportEqualsDeclaration",
  "TSIndexSignature",
  "TSIndexedAccessType",
  "TSInferType",
  "TSInstantiationExpression",
  "TSInterfaceBody",
  "TSInterfaceDeclaration",
  "TSIntersectionType",
  "TSLiteralType",
  "TSMappedType",
  "TSMethodSignature",
  "TSModuleBlock",
  "TSModuleDeclaration",
  "TSNamedTupleMember",
  "TSOptionalType",
  "TSParameterProperty",
  "TSParenthesizedType",
  "TSPropertySignature",
  "TSQualifiedName",
  "TSRestType",
  "TSThisType",
  "TSTupleType",
  "TSTypeAliasDeclaration",
  "TSTypeAnnotation",
  "TSTypeAssertion",
  "TSTypeLiteral",
  "TSTypeOperator",
  "TSTypeParameter",
  "TSTypeParameterDeclaration",
  "TSTypeParameterInstantiation",
  "TSTypePredicate",
  "TSTypeQuery",
  "TSTypeReference",
  "TSUnionType",
]);

function toRepoPath(rootDir, absolutePath) {
  return path.relative(rootDir, absolutePath).split(path.sep).join("/");
}

function isExcludedPath(repoPath) {
  return (
    repoPath.startsWith("docs/") ||
    repoPath.startsWith("reports/") ||
    repoPath.startsWith("generated/") ||
    EXCLUDED_FILE_PATTERN.test(repoPath)
  );
}

function isSourceFile(repoPath, filePath, target) {
  if (!target.extensions.has(path.extname(filePath))) return false;
  return target.allowedPathPattern
    ? target.allowedPathPattern.test(repoPath)
    : true;
}

function collectFiles(rootDir, target) {
  const results = [];
  const startPath = path.join(rootDir, target.root);

  if (!fs.existsSync(startPath)) return results;

  function walk(currentPath) {
    const repoPath = toRepoPath(rootDir, currentPath);
    if (isExcludedPath(repoPath)) return;

    const stats = fs.statSync(currentPath);
    if (stats.isDirectory()) {
      if (GENERATED_DIR_NAMES.has(path.basename(currentPath))) return;

      const entries = fs
        .readdirSync(currentPath, { withFileTypes: true })
        .sort((left, right) => left.name.localeCompare(right.name));

      for (const entry of entries) {
        walk(path.join(currentPath, entry.name));
      }
      return;
    }

    if (stats.isFile() && isSourceFile(repoPath, currentPath, target)) {
      results.push({
        absolutePath: currentPath,
        repoPath,
        scanTextRules: target.scanTextRules,
        scanPathRules: target.scanPathRules ?? false,
      });
    }
  }

  walk(startPath);
  return results;
}

function getLineNumber(content, index) {
  return content.slice(0, index).split("\n").length;
}

function getLineText(content, index) {
  const lineStart = content.lastIndexOf("\n", index - 1) + 1;
  const lineEnd = content.indexOf("\n", index);
  return content.slice(lineStart, lineEnd === -1 ? content.length : lineEnd);
}

function getEffectiveSeverity(rule, scanUnit, index) {
  if (rule.ruleId !== "fake-phone") return rule.severity;

  if (/placeholder/iu.test(scanUnit.context ?? "")) return "warning";
  if (/placeholder/iu.test(getLineText(scanUnit.value, index)))
    return "warning";

  return rule.severity;
}

function toJsonStringLiteral(value) {
  return JSON.stringify(value);
}

function getNextNonWhitespaceCharacter(content, index) {
  for (
    let currentIndex = index;
    currentIndex < content.length;
    currentIndex += 1
  ) {
    const character = content[currentIndex];
    if (!/\s/u.test(character)) return character;
  }

  return "";
}

function findJsonValueLiteralIndex(content, literal, startIndex) {
  let searchIndex = startIndex;

  while (searchIndex < content.length) {
    const literalIndex = content.indexOf(literal, searchIndex);
    if (literalIndex === -1) return -1;

    const nextCharacter = getNextNonWhitespaceCharacter(
      content,
      literalIndex + literal.length,
    );
    if (nextCharacter !== ":") return literalIndex;

    searchIndex = literalIndex + literal.length;
  }

  return -1;
}

function collectJsonStringValues(value, content, state, pointer = "") {
  if (typeof value === "string") {
    const literal = toJsonStringLiteral(value);
    const literalIndex = findJsonValueLiteralIndex(
      content,
      literal,
      state.searchIndex,
    );
    if (literalIndex !== -1) {
      state.searchIndex = literalIndex + literal.length;
    }

    return [
      {
        value,
        line:
          literalIndex === -1 ? 1 : getLineNumber(content, literalIndex + 1),
        context: pointer,
      },
    ];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      collectJsonStringValues(item, content, state, `${pointer}.${index}`),
    );
  }

  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) =>
      collectJsonStringValues(item, content, state, `${pointer}.${key}`),
    );
  }

  return [];
}

function collectJsonScanUnits(content) {
  try {
    return collectJsonStringValues(JSON.parse(content), content, {
      searchIndex: 0,
    });
  } catch {
    return [
      {
        value: content,
        line: 1,
      },
    ];
  }
}

function isSkippableConfigString(value) {
  return (
    value.startsWith("/") ||
    value.startsWith("./") ||
    value.startsWith("../") ||
    /^https?:\/\/\S+\.(?:avif|gif|jpe?g|png|svg|webp)(?:[?#].*)?$/iu.test(value)
  );
}

function pushConfigStringUnit(units, value, content, node) {
  if (!value) return;

  units.push({
    value,
    line: node.loc?.start.line ?? getLineNumber(content, node.start ?? 0),
    skipTextRules: isSkippableConfigString(value),
  });
}

function collectStringLiteralsFromNode(node, units, content) {
  if (!node || typeof node !== "object") return;

  if (TS_TYPE_ONLY_NODE_TYPES.has(node.type)) return;

  if (node.type === "ImportDeclaration") return;

  if (node.type === "ExportAllDeclaration") return;

  if (
    node.type === "ExportNamedDeclaration" ||
    node.type === "ExportDefaultDeclaration"
  ) {
    collectStringLiteralsFromNode(node.declaration, units, content);
    return;
  }

  if (
    (node.type === "StringLiteral" || node.type === "DirectiveLiteral") &&
    typeof node.value === "string"
  ) {
    pushConfigStringUnit(units, node.value, content, node);
    return;
  }

  if (node.type === "TemplateElement") {
    const value = node.value?.cooked ?? node.value?.raw;
    pushConfigStringUnit(units, value, content, node);
    return;
  }

  if (node.type === "ObjectProperty" || node.type === "ObjectMethod") {
    if (node.computed) {
      collectStringLiteralsFromNode(node.key, units, content);
    }
    collectStringLiteralsFromNode(node.value ?? node.body, units, content);
    return;
  }

  for (const [key, value] of Object.entries(node)) {
    if (
      key === "comments" ||
      key === "leadingComments" ||
      key === "innerComments" ||
      key === "trailingComments" ||
      key === "loc" ||
      key === "start" ||
      key === "end"
    ) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        collectStringLiteralsFromNode(item, units, content);
      }
      continue;
    }

    collectStringLiteralsFromNode(value, units, content);
  }
}

function collectConfigStringScanUnits(content) {
  const units = [];

  try {
    const ast = parse(content, {
      sourceType: "module",
      plugins: ["jsx", "typescript"],
    });
    collectStringLiteralsFromNode(ast.program, units, content);
  } catch {
    return [];
  }

  return units;
}

function collectPathScanUnits(repoPath) {
  return [
    {
      value: repoPath,
      line: 1,
    },
  ];
}

function stripMdxComments(content) {
  return content.replaceAll(/\{\/\*[\s\S]*?\*\/\}|<!--[\s\S]*?-->/gu, (match) =>
    "\n".repeat(match.split("\n").length - 1),
  );
}

function collectScanUnits(content, filePath) {
  const extension = path.extname(filePath);
  if (extension === ".json") return collectJsonScanUnits(content);
  if (CONFIG_SOURCE_EXTENSIONS.has(extension)) {
    return collectConfigStringScanUnits(content);
  }

  const scanContent =
    extension === ".md" || extension === ".mdx"
      ? stripMdxComments(content)
      : content;

  return scanContent.split("\n").map((line, index) => ({
    value: line,
    line: index + 1,
  }));
}

function isConfigRuntimeLogoReference(file, unit) {
  return (
    file.repoPath.startsWith("src/config/website/") &&
    unit.value.trim() === LOGO_REFERENCE
  );
}

function isContentRuntimeLogoReference(file, unit) {
  return (
    file.repoPath.startsWith("content/pages/") &&
    (MARKDOWN_LOGO_REFERENCE_PATTERN.test(unit.value) ||
      ATTRIBUTE_LOGO_REFERENCE_PATTERN.test(unit.value))
  );
}

function findRuntimeLogoReferenceUnit(file, scanUnits) {
  if (file.scanPathRules) return undefined;

  return scanUnits.find(
    (unit) =>
      isConfigRuntimeLogoReference(file, unit) ||
      isContentRuntimeLogoReference(file, unit),
  );
}

function scanTextFile(rootDir, file) {
  const content = fs.readFileSync(file.absolutePath, "utf8");
  const scanUnits = file.scanPathRules
    ? collectPathScanUnits(file.repoPath)
    : collectScanUnits(content, file.absolutePath);
  const findings = [];

  for (const unit of scanUnits) {
    if (unit.skipTextRules) continue;

    for (const rule of TEXT_RULES) {
      rule.pattern.lastIndex = 0;

      for (const match of unit.value.matchAll(rule.pattern)) {
        const index = match.index ?? 0;
        findings.push({
          file: file.repoPath,
          line: unit.line,
          ruleId: rule.ruleId,
          severity: getEffectiveSeverity(rule, unit, index),
          message: rule.message,
          match: match[0],
        });
      }
    }
  }

  const logoReferenceUnit = findRuntimeLogoReferenceUnit(file, scanUnits);
  const hasLogoReference = Boolean(logoReferenceUnit);
  const hasLogoAsset = fs.existsSync(path.join(rootDir, LOGO_ASSET_PATH));
  if (hasLogoReference && !hasLogoAsset) {
    findings.push({
      file: file.repoPath,
      line: logoReferenceUnit.line,
      ruleId: "missing-logo-asset",
      severity: "error",
      message:
        "Runtime reference to /images/logo.svg exists, but public/images/logo.svg is missing.",
      match: LOGO_REFERENCE,
    });
  }

  return findings;
}

export function collectContentReadinessFindings(rootDir = DEFAULT_ROOT) {
  const files = SCAN_TARGETS.flatMap((target) => collectFiles(rootDir, target));
  return files.flatMap((file) =>
    file.scanTextRules || file.scanPathRules ? scanTextFile(rootDir, file) : [],
  );
}

export function runContentReadinessCheck(rootDir = DEFAULT_ROOT) {
  const findings = collectContentReadinessFindings(rootDir);
  const errors = findings.filter((finding) => finding.severity === "error");
  const warnings = findings.filter((finding) => finding.severity === "warning");

  return {
    status: errors.length > 0 ? "failed" : "passed",
    findings,
    errors,
    warnings,
  };
}

function printFinding(finding) {
  const suffix = finding.match ? ` (${finding.match})` : "";
  console.error(
    `- [${finding.severity}] ${finding.file}:${finding.line} ${finding.ruleId}: ${finding.message}${suffix}`,
  );
}

function main() {
  const result = runContentReadinessCheck(DEFAULT_ROOT);

  if (result.findings.length === 0) {
    console.log("content readiness passed: no buyer-visible residue found");
    return;
  }

  const summary = `content readiness ${result.status}: ${result.errors.length} error(s), ${result.warnings.length} warning(s)`;
  const log = result.status === "failed" ? console.error : console.log;
  log(summary);

  for (const finding of result.findings) {
    printFinding(finding);
  }

  if (result.status === "failed") {
    process.exit(1);
  }
}

const isCliEntrypoint = process.argv[1]
  ? fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
  : false;

if (isCliEntrypoint) {
  main();
}
