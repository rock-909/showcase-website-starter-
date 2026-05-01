#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;

const ROOT = process.cwd();
const REPORT_DIR = path.join(ROOT, "reports", "translation-compat");

const TRANSLATION_LEAF_RULES = [
  {
    file: "src/app/[locale]/contact/contact-form-static-fallback.tsx",
    markers: ["data-contact-form-fallback", 'translate="no"'],
  },
  {
    file: "src/components/contact/product-family-context-notice.tsx",
    markers: ["product-family-context-notice", 'translate="no"'],
  },
  {
    file: "src/components/layout/header-language-menu.tsx",
    markers: [
      "language-switcher",
      "language-dropdown-content",
      "language-current-label",
      "language-option-label-",
      'translate="no"',
    ],
  },
  {
    file: "src/components/layout/mobile-navigation-interactive.tsx",
    markers: [
      "mobile-language-switcher",
      "mobile-language-switcher-label",
      "mobile-language-option-label-",
      'translate="no"',
    ],
  },
  {
    file: "src/components/forms/contact-form-container.tsx",
    markers: ["contact-form-submit-label", 'translate="no"'],
  },
  {
    file: "src/components/forms/contact-form-feedback.tsx",
    markers: [
      "contact-form-status-message",
      "contact-form-error-display",
      'translate="no"',
    ],
  },
  {
    file: "src/components/layout/header.tsx",
    markers: [
      "header-desktop-nav",
      "header-nav-label-",
      "header-contact-sales-label",
      'translate="no"',
    ],
  },
  {
    file: "src/components/layout/header-client.tsx",
    markers: ["header-mobile-menu-label", 'translate="no"'],
  },
  {
    file: "src/components/sections/faq-accordion.tsx",
    markers: ["faq-accordion", "faq-question-", 'translate="no"'],
  },
  {
    file: "src/components/sections/final-cta.tsx",
    markers: [
      "final-cta-primary-label",
      "final-cta-secondary-label",
      'translate="no"',
    ],
  },
  {
    file: "src/components/sections/sample-cta.tsx",
    markers: ["sample-cta-label", 'translate="no"'],
  },
];

const RISK_SCAN_FILES = TRANSLATION_LEAF_RULES.map((rule) => rule.file).filter(
  (file) => file.endsWith(".tsx"),
);

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function warnFileRead(repoPath, err) {
  const message = err instanceof Error ? err.message : String(err);
  console.warn(`translate-compat: failed to read ${repoPath}: ${message}`);
}

function readFile(repoPath) {
  try {
    return fs.readFileSync(path.join(ROOT, repoPath), "utf8");
  } catch (err) {
    warnFileRead(repoPath, err);
    return null;
  }
}

function isStringish(node) {
  if (!node) return false;

  if (node.type === "StringLiteral") return true;

  if (node.type === "TemplateLiteral") {
    return node.expressions.length === 0;
  }

  return false;
}

function isTextCarrier(node) {
  if (!node) return false;

  if (isStringish(node)) return true;

  return (
    node.type === "Identifier" ||
    node.type === "MemberExpression" ||
    node.type === "OptionalMemberExpression"
  );
}

function unwrapExpression(node) {
  let current = node;

  while (
    current &&
    (current.type === "TSAsExpression" ||
      current.type === "TSTypeAssertion" ||
      current.type === "TSNonNullExpression" ||
      current.type === "ParenthesizedExpression")
  ) {
    current = current.expression;
  }

  return current;
}

function getUnwrappedExpressionPath(pathRef) {
  let current = pathRef;

  while (
    current?.node &&
    (current.isTSAsExpression?.() ||
      current.isTSTypeAssertion?.() ||
      current.isTSNonNullExpression?.() ||
      current.isParenthesizedExpression?.())
  ) {
    current = current.get("expression");
  }

  return current;
}

function isNullable(node) {
  return (
    node?.type === "NullLiteral" ||
    (node?.type === "Identifier" && node.name === "undefined")
  );
}

function isDirectJsxChild(pathRef) {
  return (
    pathRef.parentPath?.isJSXExpressionContainer() &&
    (pathRef.parentPath.parentPath?.isJSXElement() ||
      pathRef.parentPath.parentPath?.isJSXFragment())
  );
}

function resolveIdentifierInit(pathRef, seen = new Set()) {
  if (!pathRef?.isIdentifier()) {
    return null;
  }

  const { name } = pathRef.node;
  if (seen.has(name)) {
    return null;
  }

  seen.add(name);

  const binding = pathRef.scope.getBinding(name);
  if (!binding?.path?.isVariableDeclarator()) {
    return null;
  }

  const initPath = binding.path.get("init");
  if (!initPath?.node) {
    return null;
  }

  return initPath;
}

function branchIsTextCarrier(pathRef, seen = new Set()) {
  const expressionPath = getUnwrappedExpressionPath(pathRef);
  if (!expressionPath?.node) {
    return false;
  }

  const node = expressionPath.node;
  if (!node) {
    return false;
  }

  if (isTextCarrier(node)) {
    if (node.type !== "Identifier") {
      return true;
    }

    const resolvedInit = resolveIdentifierInit(expressionPath, seen);
    if (!resolvedInit) {
      return true;
    }

    return expressionHasRiskyText(resolvedInit, seen);
  }

  if (node.type === "TemplateLiteral") {
    return true;
  }

  if (
    node.type === "BinaryExpression" &&
    node.operator === "+" &&
    (branchIsTextCarrier(expressionPath.get("left"), seen) ||
      branchIsTextCarrier(expressionPath.get("right"), seen))
  ) {
    return true;
  }

  return false;
}

function expressionHasRiskyText(pathRef, seen = new Set()) {
  const expressionPath = getUnwrappedExpressionPath(pathRef);
  if (!expressionPath?.node) {
    return false;
  }

  const node = expressionPath.node;
  if (!node) {
    return false;
  }

  if (node.type === "LogicalExpression" && node.operator === "&&") {
    return branchIsTextCarrier(expressionPath.get("right"), seen);
  }

  if (node.type === "ConditionalExpression") {
    const consequentPath = expressionPath.get("consequent");
    const alternatePath = expressionPath.get("alternate");

    return (
      (branchIsTextCarrier(consequentPath, seen) &&
        (branchIsTextCarrier(alternatePath, seen) ||
          isNullable(unwrapExpression(alternatePath.node)))) ||
      (branchIsTextCarrier(alternatePath, seen) &&
        (branchIsTextCarrier(consequentPath, seen) ||
          isNullable(unwrapExpression(consequentPath.node))))
    );
  }

  if (node.type === "Identifier") {
    const resolvedInit = resolveIdentifierInit(expressionPath, seen);
    if (!resolvedInit) {
      return false;
    }

    return expressionHasRiskyText(resolvedInit, seen);
  }

  return false;
}

function hasLiteralAttribute(openingElement, name, value) {
  return openingElement.attributes.some((attribute) => {
    if (
      attribute.type !== "JSXAttribute" ||
      attribute.name?.type !== "JSXIdentifier" ||
      attribute.name.name !== name
    ) {
      return false;
    }

    if (attribute.value?.type === "StringLiteral") {
      return attribute.value.value === value;
    }

    if (attribute.value?.type === "JSXExpressionContainer") {
      return (
        attribute.value.expression?.type === "StringLiteral" &&
        attribute.value.expression.value === value
      );
    }

    return false;
  });
}

function getAttributeStringValues(attribute) {
  if (attribute.value?.type === "StringLiteral") {
    return [attribute.value.value];
  }

  if (attribute.value?.type !== "JSXExpressionContainer") {
    return [];
  }

  const expression = unwrapExpression(attribute.value.expression);

  if (expression?.type === "StringLiteral") {
    return [expression.value];
  }

  if (expression?.type === "TemplateLiteral") {
    return expression.quasis
      .map((quasi) => quasi.value.cooked)
      .filter((value) => typeof value === "string" && value.length > 0);
  }

  return [];
}

function getAttributeValues(openingElement, name) {
  return openingElement.attributes.flatMap((attribute) => {
    if (
      attribute.type !== "JSXAttribute" ||
      attribute.name?.type !== "JSXIdentifier" ||
      attribute.name.name !== name
    ) {
      return [];
    }

    return getAttributeStringValues(attribute);
  });
}

function hasNotranslateClass(openingElement) {
  return openingElement.attributes.some((attribute) => {
    if (
      attribute.type !== "JSXAttribute" ||
      attribute.name?.type !== "JSXIdentifier" ||
      attribute.name.name !== "className"
    ) {
      return false;
    }

    if (attribute.value?.type === "StringLiteral") {
      return attribute.value.value.includes("notranslate");
    }

    return false;
  });
}

function hasProtectedAncestor(pathRef) {
  let current = pathRef.parentPath;

  while (current) {
    if (current.isJSXElement()) {
      const openingElement = current.node.openingElement;
      if (
        hasLiteralAttribute(openingElement, "translate", "no") ||
        hasNotranslateClass(openingElement)
      ) {
        return true;
      }
    }

    current = current.parentPath;
  }

  return false;
}

function hasTranslateNo(openingElement) {
  return hasLiteralAttribute(openingElement, "translate", "no");
}

function collectRiskFindingsFromSource(source, repoPath) {
  const ast = parser.parse(source, {
    sourceType: "module",
    plugins: ["typescript", "jsx"],
  });

  const findings = [];

  traverse(ast, {
    LogicalExpression(logicalPath) {
      if (
        logicalPath.node.operator === "&&" &&
        branchIsTextCarrier(logicalPath.get("right")) &&
        isDirectJsxChild(logicalPath) &&
        !hasProtectedAncestor(logicalPath)
      ) {
        findings.push({
          file: repoPath,
          line: logicalPath.node.loc?.start.line ?? null,
          kind: "logical-direct-string",
          message:
            "Direct JSX conditional string render found. Wrap status text in a stable element instead of rendering a bare string branch.",
        });
      }
    },
    ConditionalExpression(condPath) {
      if (!isDirectJsxChild(condPath) || hasProtectedAncestor(condPath)) {
        return;
      }

      const consequentPath = condPath.get("consequent");
      const alternatePath = condPath.get("alternate");
      const consequent = unwrapExpression(consequentPath.node);
      const alternate = unwrapExpression(alternatePath.node);
      const hasRiskyBranch =
        (branchIsTextCarrier(consequentPath) &&
          (branchIsTextCarrier(alternatePath) || isNullable(alternate))) ||
        (branchIsTextCarrier(alternatePath) &&
          (branchIsTextCarrier(consequentPath) || isNullable(consequent)));

      if (hasRiskyBranch) {
        findings.push({
          file: repoPath,
          line: condPath.node.loc?.start.line ?? null,
          kind: "ternary-direct-string",
          message:
            "Direct JSX ternary string render found. Keep state text inside a stable wrapper instead of swapping bare strings.",
        });
      }
    },
    JSXExpressionContainer(containerPath) {
      if (
        !(
          containerPath.parentPath?.isJSXElement() ||
          containerPath.parentPath?.isJSXFragment()
        ) ||
        hasProtectedAncestor(containerPath)
      ) {
        return;
      }

      const expressionPath = containerPath.get("expression");
      if (
        !expressionPath.isIdentifier() ||
        !expressionHasRiskyText(expressionPath)
      ) {
        return;
      }

      findings.push({
        file: repoPath,
        line: expressionPath.node.loc?.start.line ?? null,
        kind: "alias-direct-string",
        message:
          "Direct JSX identifier render resolves to a conditional bare text branch. Keep state text inside a stable wrapper instead of routing it through an alias variable.",
      });
    },
  });

  return findings;
}

function collectMarkerTokensFromSource(source) {
  const ast = parser.parse(source, {
    sourceType: "module",
    plugins: ["typescript", "jsx"],
  });

  const tokens = new Set();

  traverse(ast, {
    JSXAttribute(attributePath) {
      const attribute = attributePath.node;
      if (attribute.name?.type !== "JSXIdentifier") {
        return;
      }

      const attributeName = attribute.name.name;
      tokens.add(attributeName);

      if (attribute.value?.type === "StringLiteral") {
        tokens.add(attribute.value.value);

        if (attributeName === "translate") {
          tokens.add(`${attributeName}="${attribute.value.value}"`);
        }
      }

      if (attribute.value?.type === "JSXExpressionContainer") {
        const expression = unwrapExpression(attribute.value.expression);

        if (expression?.type === "StringLiteral") {
          tokens.add(expression.value);

          if (attributeName === "translate") {
            tokens.add(`${attributeName}="${expression.value}"`);
          }
        }

        if (expression?.type === "TemplateLiteral") {
          for (const quasi of expression.quasis) {
            if (quasi.value.cooked) {
              tokens.add(quasi.value.cooked);
            }
          }
        }
      }
    },
    StringLiteral(stringPath) {
      tokens.add(stringPath.node.value);
    },
    TemplateLiteral(templatePath) {
      for (const quasi of templatePath.node.quasis) {
        if (quasi.value.cooked) {
          tokens.add(quasi.value.cooked);
        }
      }
    },
  });

  return tokens;
}

function collectProtectedLeavesFromSource(source) {
  const ast = parser.parse(source, {
    sourceType: "module",
    plugins: ["typescript", "jsx"],
  });

  const leaves = [];

  traverse(ast, {
    JSXElement(elementPath) {
      const openingElement = elementPath.node.openingElement;
      const testIds = getAttributeValues(openingElement, "data-testid");

      for (const testId of testIds) {
        leaves.push({
          testId,
          translateNo: hasTranslateNo(openingElement),
        });
      }
    },
  });

  return leaves;
}

function markerMatchesToken(marker, token) {
  if (!token) {
    return false;
  }

  if (marker === 'translate="no"') {
    return token === marker;
  }

  if (marker === "notranslate") {
    return token === marker || token.split(/\s+/).includes(marker);
  }

  if (marker.endsWith("-")) {
    return token.startsWith(marker);
  }

  return token === marker;
}

function collectMissingMarkersFromSource(source, repoPath, markers) {
  const tokens = collectMarkerTokensFromSource(source);
  const protectedLeaves = collectProtectedLeavesFromSource(source);
  const leafMarkers = markers.filter((marker) => marker.endsWith("-"));
  const leafTranslationFailures = new Set();

  return markers.flatMap((marker) => {
    if (marker.endsWith("-")) {
      const matchedLeaves = protectedLeaves.filter((leaf) =>
        leaf.testId.startsWith(marker),
      );

      if (matchedLeaves.length === 0) {
        return [
          {
            file: repoPath,
            marker,
            message:
              "Protected translation compatibility marker is missing from a guarded surface.",
          },
        ];
      }

      if (matchedLeaves.some((leaf) => !leaf.translateNo)) {
        leafTranslationFailures.add(marker);
        return [
          {
            file: repoPath,
            marker: 'translate="no"',
            message:
              'Protected translation leaf marker exists but is missing translate="no" on the same JSX element.',
          },
        ];
      }

      return [];
    }

    if (
      marker === 'translate="no"' &&
      leafMarkers.length > 0 &&
      leafTranslationFailures.size === 0 &&
      leafMarkers.every((leafMarker) =>
        protectedLeaves.some(
          (leaf) => leaf.testId.startsWith(leafMarker) && leaf.translateNo,
        ),
      )
    ) {
      return [];
    }

    const present = Array.from(tokens).some((token) =>
      markerMatchesToken(marker, token),
    );

    if (present) {
      return [];
    }

    return [
      {
        file: repoPath,
        marker,
        message:
          "Protected translation compatibility marker is missing from a guarded surface.",
      },
    ];
  });
}

function scanForRiskPatterns(repoPath) {
  const source = readFile(repoPath);
  if (source === null) {
    return [
      {
        file: repoPath,
        line: null,
        kind: "unreadable-file",
        message:
          "Protected surface file could not be read, so risk pattern scanning was skipped.",
      },
    ];
  }

  return collectRiskFindingsFromSource(source, repoPath);
}

function collectMissingMarkers() {
  const missing = [];

  for (const rule of TRANSLATION_LEAF_RULES) {
    const source = readFile(rule.file);
    if (source === null) {
      missing.push({
        file: rule.file,
        marker: "(file unreadable)",
        message:
          "Protected surface file is missing or unreadable, so marker checks could not be completed.",
      });
      continue;
    }

    missing.push(
      ...collectMissingMarkersFromSource(source, rule.file, rule.markers),
    );
  }

  return missing;
}

function writeReports(result) {
  ensureDir(REPORT_DIR);
  const timestamp = Date.now();
  const jsonPath = path.join(REPORT_DIR, `translate-compat-${timestamp}.json`);
  const mdPath = path.join(REPORT_DIR, `translate-compat-${timestamp}.md`);
  const latestJson = path.join(REPORT_DIR, "translate-compat-latest.json");
  const latestMd = path.join(REPORT_DIR, "translate-compat-latest.md");

  fs.writeFileSync(jsonPath, `${JSON.stringify(result, null, 2)}\n`);

  const lines = [
    "# Translate Compatibility Check",
    "",
    `- Generated at: ${result.generatedAt}`,
    `- Status: ${result.status}`,
    `- Missing markers: ${result.missingMarkers.length}`,
    `- Risk findings: ${result.riskFindings.length}`,
    "",
    "## Missing Markers",
    "",
    ...(result.missingMarkers.length === 0
      ? ["- none"]
      : result.missingMarkers.map(
          (item) => `- ${item.file}: missing marker \`${item.marker}\``,
        )),
    "",
    "## Risk Findings",
    "",
    ...(result.riskFindings.length === 0
      ? ["- none"]
      : result.riskFindings.map(
          (item) =>
            `- ${item.file}:${item.line ?? "?"} [${item.kind}] ${item.message}`,
        )),
    "",
  ];

  fs.writeFileSync(mdPath, `${lines.join("\n")}\n`);
  fs.copyFileSync(jsonPath, latestJson);
  fs.copyFileSync(mdPath, latestMd);
}

function main() {
  const missingMarkers = collectMissingMarkers();
  const riskFindings = RISK_SCAN_FILES.flatMap((file) =>
    scanForRiskPatterns(file),
  );

  const result = {
    generatedAt: new Date().toISOString(),
    status:
      missingMarkers.length === 0 && riskFindings.length === 0
        ? "passed"
        : "failed",
    missingMarkers,
    riskFindings,
  };

  writeReports(result);

  if (result.status === "passed") {
    console.log("translate-compat: passed");
    process.exit(0);
  }

  console.error("translate-compat: failed");

  for (const item of missingMarkers) {
    console.error(`- [missing-marker] ${item.file}: ${item.marker}`);
  }

  for (const item of riskFindings) {
    console.error(
      `- [${item.kind}] ${item.file}:${item.line ?? "?"}: ${item.message}`,
    );
  }

  process.exit(1);
}

module.exports = {
  collectMissingMarkersFromSource,
  collectMarkerTokensFromSource,
  collectRiskFindingsFromSource,
  RISK_SCAN_FILES,
  scanForRiskPatterns,
};

if (require.main === module) {
  main();
}
