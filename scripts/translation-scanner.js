#!/usr/bin/env node

/**
 * 翻译键自动扫描工具
 * 使用AST解析扫描代码中的翻译键，确保翻译完整性
 */

const fs = require("fs");
const path = require("path");
const { parse } = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const glob = require("glob");

console.log("🔍 开始翻译键扫描...\n");

// 配置
const CONFIG = {
  // 扫描的文件模式
  SCAN_PATTERNS: ["src/**/*.{ts,tsx,js,jsx}", "app/**/*.{ts,tsx,js,jsx}"],

  // 排除的文件模式（传递给 glob ignore 选项）
  IGNORE_PATTERNS: [
    "**/*.test.{ts,tsx,js,jsx}",
    "**/*.spec.{ts,tsx,js,jsx}",
    "**/*.d.ts",
    "**/_templates/**",
  ],

  // 翻译函数名
  TRANSLATION_FUNCTIONS: ["t", "useTranslations", "getTranslations"],

  // 输出目录
  OUTPUT_DIR: path.join(process.cwd(), "reports"),

  // 翻译文件目录
  MESSAGES_DIR: path.join(process.cwd(), "messages"),

  // 支持的语言
  LOCALES: require("../i18n-locales.config").locales,

  // 允许多命名空间匹配的键（这些键在多个命名空间中重复存在，scanner 无法确定具体使用哪个）
  // 当代码中使用短键名且存在多个完整路径匹配时，跳过缺失检测
  ALLOW_MULTI_NAMESPACE_KEYS: ["submitting", "message", "subtitle", "button"],
};

const scanResults = {
  totalFiles: 0,
  scannedFiles: 0,
  translationKeys: new Set(),
  keyUsages: new Map(),
  errors: [],
  warnings: [],
  statistics: {
    totalKeys: 0,
    uniqueKeys: 0,
    missingKeys: [],
    unusedKeys: [],
  },
};

/**
 * 扫描文件中的翻译键
 */
function scanFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    const ast = parse(content, {
      sourceType: "module",
      plugins: [
        "typescript",
        "jsx",
        "decorators-legacy",
        "classProperties",
        "objectRestSpread",
        "asyncGenerators",
        "functionBind",
        "exportDefaultFrom",
        "exportNamespaceFrom",
        "dynamicImport",
        "nullishCoalescingOperator",
        "optionalChaining",
      ],
    });

    const fileKeys = new Set();
    const namespaceByBinding = new Map();

    function setNamespaceForBinding(binding, namespace) {
      if (binding && namespace) {
        namespaceByBinding.set(binding, namespace);
      }
    }

    function getNamespaceForName(path, identifierName) {
      if (!identifierName) {
        return undefined;
      }

      const binding = path.scope.getBinding(identifierName);
      if (!binding) {
        return undefined;
      }

      return namespaceByBinding.get(binding);
    }

    function recordNamespace(bindingPath, namespace) {
      if (!namespace) {
        return;
      }

      let targetPath = bindingPath.parentPath;

      if (targetPath && targetPath.isAwaitExpression()) {
        targetPath = targetPath.parentPath;
      }

      if (targetPath && targetPath.isVariableDeclarator()) {
        const identifier = targetPath.node.id;
        if (identifier && identifier.type === "Identifier") {
          const binding = targetPath.scope.getBinding(identifier.name);
          setNamespaceForBinding(binding, namespace);
        }
      } else if (
        targetPath &&
        targetPath.isAssignmentExpression() &&
        targetPath.node.left.type === "Identifier"
      ) {
        const binding = targetPath.scope.getBinding(targetPath.node.left.name);
        setNamespaceForBinding(binding, namespace);
      }
    }

    function resolveKeyWithNamespace(nodePath, calleeNode, rawKey) {
      if (!rawKey || typeof rawKey !== "string") {
        return null;
      }

      if (calleeNode.type === "Identifier") {
        const namespace = getNamespaceForName(nodePath, calleeNode.name);
        if (namespace) {
          if (rawKey === namespace || rawKey.startsWith(`${namespace}.`)) {
            return rawKey;
          }
          return `${namespace}.${rawKey}`;
        }
      }

      if (
        calleeNode.type === "MemberExpression" &&
        calleeNode.object.type === "Identifier"
      ) {
        const namespace = getNamespaceForName(nodePath, calleeNode.object.name);
        if (namespace) {
          if (rawKey === namespace || rawKey.startsWith(`${namespace}.`)) {
            return rawKey;
          }
          return `${namespace}.${rawKey}`;
        }
      }

      return rawKey;
    }

    function propagateAlias(variablePath) {
      const { node } = variablePath;
      const { id, init } = node;

      if (!init || !id || id.type !== "Identifier") {
        return;
      }

      const targetBinding = variablePath.scope.getBinding(id.name);
      if (!targetBinding) {
        return;
      }

      if (init.type === "Identifier") {
        const namespace = getNamespaceForName(variablePath, init.name);
        if (namespace) {
          setNamespaceForBinding(targetBinding, namespace);
        }
        return;
      }

      if (
        init.type === "ArrowFunctionExpression" ||
        init.type === "FunctionExpression"
      ) {
        const { body: initialBody } = init;
        let body = initialBody;

        if (body.type === "BlockStatement") {
          const { body: statements } = body;
          const returnStatement = statements.find(
            (statement) =>
              statement.type === "ReturnStatement" && statement.argument,
          );
          if (!returnStatement) {
            return;
          }
          body = returnStatement.argument;
        }

        if (body && body.type === "CallExpression") {
          if (body.callee.type === "Identifier") {
            const namespace = getNamespaceForName(
              variablePath,
              body.callee.name,
            );
            if (namespace) {
              setNamespaceForBinding(targetBinding, namespace);
            }
          } else if (
            body.callee.type === "MemberExpression" &&
            body.callee.object.type === "Identifier"
          ) {
            const namespace = getNamespaceForName(
              variablePath,
              body.callee.object.name,
            );
            if (namespace) {
              setNamespaceForBinding(targetBinding, namespace);
            }
          }
        }
      }
    }

    function getFunctionPathFromBinding(binding) {
      if (!binding) {
        return null;
      }

      const bindingPath = binding.path;
      if (
        bindingPath.isFunctionDeclaration() ||
        bindingPath.isFunctionExpression() ||
        bindingPath.isArrowFunctionExpression()
      ) {
        return bindingPath;
      }

      if (bindingPath.isVariableDeclarator()) {
        const initPath = bindingPath.get("init");
        if (
          initPath &&
          !Array.isArray(initPath) &&
          (initPath.isFunctionExpression() ||
            initPath.isArrowFunctionExpression())
        ) {
          return initPath;
        }

        if (
          initPath &&
          !Array.isArray(initPath) &&
          initPath.isCallExpression() &&
          initPath.node.arguments.length > 0
        ) {
          const firstArgPath = initPath.get("arguments.0");
          if (
            firstArgPath &&
            !Array.isArray(firstArgPath) &&
            (firstArgPath.isFunctionExpression() ||
              firstArgPath.isArrowFunctionExpression())
          ) {
            return firstArgPath;
          }
        }
      }

      return null;
    }

    const deferredJsxBindings = [];

    function propagateNamespaceFromJSX(attributePath) {
      const { node } = attributePath;

      if (
        node.name.type !== "JSXIdentifier" ||
        node.value?.type !== "JSXExpressionContainer" ||
        node.value.expression.type !== "Identifier"
      ) {
        return;
      }

      const propName = node.name.name;
      const passedIdentifier = node.value.expression;
      const namespace = getNamespaceForName(
        attributePath,
        passedIdentifier.name,
      );

      if (!namespace) {
        deferredJsxBindings.push({
          attributePath,
          componentName:
            attributePath.parent?.name?.type === "JSXIdentifier"
              ? attributePath.parent.name.name
              : null,
          propName,
          identifierName: passedIdentifier.name,
        });
        return;
      }

      const openingElement = attributePath.parent;
      if (
        !openingElement ||
        openingElement.type !== "JSXOpeningElement" ||
        openingElement.name.type !== "JSXIdentifier"
      ) {
        return;
      }

      const componentName = openingElement.name.name;
      const componentBinding = attributePath.scope.getBinding(componentName);
      if (!componentBinding) {
        return;
      }

      const functionPath = getFunctionPathFromBinding(componentBinding);
      if (!functionPath) {
        return;
      }

      const functionScope = functionPath.scope;
      const paramBinding =
        functionScope.getOwnBinding?.(propName) ??
        functionScope.getBinding(propName);

      if (paramBinding) {
        setNamespaceForBinding(paramBinding, namespace);
      }
    }

    function extractDefaultValueFromBinding(binding) {
      if (!binding || !binding.path) {
        return undefined;
      }

      const bindingPath = binding.path;
      const identifierName = binding.identifier?.name;

      if (bindingPath.isAssignmentPattern()) {
        const right = bindingPath.node.right;
        if (right && right.type === "StringLiteral") {
          return right.value;
        }

        const left = bindingPath.node.left;
        if (left && left.type === "ObjectPattern" && identifierName) {
          for (const prop of left.properties) {
            if (
              prop.type === "ObjectProperty" &&
              prop.key.type === "Identifier" &&
              prop.key.name === identifierName &&
              prop.value.type === "AssignmentPattern" &&
              prop.value.right?.type === "StringLiteral"
            ) {
              return prop.value.right.value;
            }
          }
        }
      }

      if (
        bindingPath.isIdentifier() &&
        bindingPath.parentPath &&
        bindingPath.parentPath.isAssignmentPattern()
      ) {
        const right = bindingPath.parentPath.node.right;
        if (right && right.type === "StringLiteral") {
          return right.value;
        }
      }

      if (
        bindingPath.isObjectProperty() &&
        bindingPath.node.value &&
        bindingPath.node.value.type === "AssignmentPattern"
      ) {
        const right = bindingPath.node.value.right;
        if (right && right.type === "StringLiteral") {
          return right.value;
        }
      }

      return undefined;
    }

    function captureNamespaceBindings(nodePath) {
      const { node } = nodePath;

      if (
        node.callee.type === "Identifier" &&
        node.callee.name === "useTranslations" &&
        node.arguments.length > 0 &&
        node.arguments[0].type === "StringLiteral"
      ) {
        recordNamespace(nodePath, node.arguments[0].value);
        return;
      }

      if (
        node.callee.type === "Identifier" &&
        node.callee.name === "useTranslations" &&
        node.arguments.length > 0 &&
        node.arguments[0].type === "Identifier"
      ) {
        const argName = node.arguments[0].name;
        const binding = nodePath.scope.getBinding(argName);
        const defaultValue = extractDefaultValueFromBinding(binding);
        if (defaultValue) {
          recordNamespace(nodePath, defaultValue);
        }
        return;
      }

      if (
        node.callee.type === "Identifier" &&
        (node.callee.name === "getTranslations" ||
          node.callee.name === "getTranslationsCached")
      ) {
        const firstArg = node.arguments[0];
        if (firstArg && firstArg.type === "ObjectExpression") {
          const namespaceProperty = firstArg.properties.find(
            (property) =>
              property.type === "ObjectProperty" &&
              ((property.key.type === "Identifier" &&
                property.key.name === "namespace") ||
                (property.key.type === "StringLiteral" &&
                  property.key.value === "namespace")) &&
              property.value.type === "StringLiteral",
          );

          if (namespaceProperty) {
            recordNamespace(nodePath, namespaceProperty.value.value);
          }
        } else if (firstArg && firstArg.type === "StringLiteral") {
          recordNamespace(nodePath, firstArg.value);
        }
      }
    }

    traverse(ast, {
      CallExpression(nodePath) {
        captureNamespaceBindings(nodePath);
      },
    });

    traverse(ast, {
      VariableDeclarator(variablePath) {
        propagateAlias(variablePath);
      },
    });

    traverse(ast, {
      JSXAttribute(attributePath) {
        propagateNamespaceFromJSX(attributePath);
      },
    });

    let resolvedInIteration = true;
    while (resolvedInIteration && deferredJsxBindings.length > 0) {
      resolvedInIteration = false;

      for (let index = deferredJsxBindings.length - 1; index >= 0; index--) {
        const entry = deferredJsxBindings[index];
        const { attributePath, componentName, propName, identifierName } =
          entry;

        if (
          !attributePath ||
          !attributePath.node ||
          attributePath.removed ||
          !componentName
        ) {
          deferredJsxBindings.splice(index, 1);
          continue;
        }

        const namespace = getNamespaceForName(attributePath, identifierName);
        if (!namespace) {
          continue;
        }

        const componentBinding = attributePath.scope.getBinding(componentName);
        if (!componentBinding) {
          deferredJsxBindings.splice(index, 1);
          continue;
        }

        const functionPath = getFunctionPathFromBinding(componentBinding);
        if (!functionPath) {
          deferredJsxBindings.splice(index, 1);
          continue;
        }

        const functionScope = functionPath.scope;
        const paramBinding =
          functionScope.getOwnBinding?.(propName) ??
          functionScope.getBinding(propName);

        if (paramBinding) {
          setNamespaceForBinding(paramBinding, namespace);
          deferredJsxBindings.splice(index, 1);
          resolvedInIteration = true;
        }
      }
    }

    traverse(ast, {
      // 扫描翻译键使用
      CallExpression(nodePath) {
        const { node } = nodePath;

        if (
          node.arguments.length === 0 ||
          node.arguments[0].type !== "StringLiteral"
        ) {
          return;
        }

        const { callee, arguments: callArgs } = node;
        const [firstArg] = callArgs;
        const { value: argValue } = firstArg;
        let resolvedKey = null;

        if (callee.type === "Identifier") {
          const namespace = getNamespaceForName(nodePath, callee.name);
          if (namespace || callee.name === "t") {
            resolvedKey = resolveKeyWithNamespace(nodePath, callee, argValue);
          }
        } else if (
          callee.type === "MemberExpression" &&
          callee.property.type === "Identifier" &&
          callee.property.name === "t" &&
          callee.object.type === "Identifier" &&
          getNamespaceForName(nodePath, callee.object.name)
        ) {
          resolvedKey = resolveKeyWithNamespace(nodePath, callee, argValue);
        }

        if (resolvedKey) {
          fileKeys.add(resolvedKey);
          recordKeyUsage(resolvedKey, filePath, node.loc);
        }
      },
    });

    scanResults.scannedFiles++;
    fileKeys.forEach((key) => scanResults.translationKeys.add(key));

    console.log(`✅ 扫描完成: ${filePath} (发现 ${fileKeys.size} 个翻译键)`);
  } catch (error) {
    scanResults.errors.push({
      file: filePath,
      error: error.message,
      type: "parse_error",
    });
    console.error(`❌ 扫描失败: ${filePath} - ${error.message}`);
    if (error && error.stack) {
      console.error(error.stack);
    }
  }
}

/**
 * 记录翻译键使用情况
 */
function recordKeyUsage(key, filePath, location) {
  if (!scanResults.keyUsages.has(key)) {
    scanResults.keyUsages.set(key, []);
  }

  scanResults.keyUsages.get(key).push({
    file: filePath,
    line: location ? location.start.line : null,
    column: location ? location.start.column : null,
  });
}

/**
 * 深度合并两个对象
 */
function deepMerge(target, source) {
  const result = { ...target };
  for (const [key, value] of Object.entries(source)) {
    if (
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value) &&
      typeof result[key] === "object" &&
      result[key] !== null &&
      !Array.isArray(result[key])
    ) {
      result[key] = deepMerge(result[key], value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * 加载现有翻译文件
 * 支持 messages/{locale}/critical.json + deferred.json 结构
 */
function loadExistingTranslations() {
  const translations = {};

  for (const locale of CONFIG.LOCALES) {
    let merged = {};

    // Try loading from subdirectory structure (critical.json + deferred.json)
    const localeDir = path.join(CONFIG.MESSAGES_DIR, locale);
    const criticalPath = path.join(localeDir, "critical.json");
    const deferredPath = path.join(localeDir, "deferred.json");

    let loadedFromSubdir = false;

    if (fs.existsSync(criticalPath)) {
      try {
        const content = fs.readFileSync(criticalPath, "utf8");
        merged = deepMerge(merged, JSON.parse(content));
        console.log(`📖 加载翻译文件: ${locale}/critical.json`);
        loadedFromSubdir = true;
      } catch (error) {
        console.warn(
          `⚠️  无法加载翻译文件: ${locale}/critical.json - ${error.message}`,
        );
      }
    }

    if (fs.existsSync(deferredPath)) {
      try {
        const content = fs.readFileSync(deferredPath, "utf8");
        merged = deepMerge(merged, JSON.parse(content));
        console.log(`📖 加载翻译文件: ${locale}/deferred.json`);
        loadedFromSubdir = true;
      } catch (error) {
        console.warn(
          `⚠️  无法加载翻译文件: ${locale}/deferred.json - ${error.message}`,
        );
      }
    }

    if (!loadedFromSubdir) {
      console.warn(
        `⚠️  未找到 split 翻译文件: ${locale}/critical.json + ${locale}/deferred.json`,
      );
    }

    translations[locale] = merged;
  }

  return translations;
}

/**
 * 获取嵌套对象的所有键
 */
function getAllKeys(obj, prefix = "") {
  const keys = new Set();

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === "object" && value !== null) {
      getAllKeys(value, fullKey).forEach((k) => keys.add(k));
    } else {
      keys.add(fullKey);
    }
  }

  return keys;
}

/**
 * 获取所有对象路径（非叶子键）
 */
function getAllObjectPaths(obj, prefix = "") {
  const paths = new Set();
  for (const [key, value] of Object.entries(obj || {})) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      // 当前即为对象路径
      paths.add(fullKey);
      // 继续深入
      getAllObjectPaths(value, fullKey).forEach((p) => paths.add(p));
    }
  }
  return paths;
}

/**
 * 分析翻译键使用情况
 */
function analyzeTranslationUsage(translations) {
  const allTranslationKeys = new Set();

  // 收集所有翻译文件中的叶子键
  for (const locale of CONFIG.LOCALES) {
    if (translations[locale]) {
      getAllKeys(translations[locale]).forEach((key) =>
        allTranslationKeys.add(key),
      );
    }
  }

  // 收集所有“对象路径”（非叶子键），用于检测 object-as-string-key 误用
  const objectPaths = new Set();
  for (const locale of CONFIG.LOCALES) {
    if (translations[locale]) {
      getAllObjectPaths(translations[locale]).forEach((p) =>
        objectPaths.add(p),
      );
    }
  }

  const translationKeyArray = Array.from(allTranslationKeys);

  // 找出缺失的键（代码中使用但翻译文件中没有）
  const missingKeys = [];
  const allowedMultiNamespaceKeys = CONFIG.ALLOW_MULTI_NAMESPACE_KEYS || [];
  scanResults.translationKeys.forEach((key) => {
    if (allTranslationKeys.has(key)) {
      return;
    }

    const fallbackMatches = translationKeyArray.filter(
      (translationKey) =>
        translationKey.endsWith(`.${key}`) || translationKey === key,
    );

    if (fallbackMatches.length === 1) {
      return;
    }

    // 允许配置的多命名空间键（存在多个匹配但都是有效的）
    if (fallbackMatches.length > 1 && allowedMultiNamespaceKeys.includes(key)) {
      return;
    }

    missingKeys.push(key);
  });

  // 检测对象键被当作叶子键使用的情况（例如 t('seo')）
  const misuseKeys = [];
  scanResults.translationKeys.forEach((key) => {
    if (objectPaths.has(key)) {
      misuseKeys.push(key);
      const usages = scanResults.keyUsages.get(key) || [];
      if (usages.length === 0) {
        scanResults.errors.push({
          file: "<unknown>",
          error: `object_key_misuse: ${key} (object path used as leaf key)`,
          type: "object_key_misuse",
        });
      } else {
        usages.forEach((u) =>
          scanResults.errors.push({
            file: u.file,
            line: u.line,
            column: u.column,
            error: `object_key_misuse: ${key} (object path used as leaf key)`,
            type: "object_key_misuse",
          }),
        );
      }
    }
  });

  // 找出未使用的键（翻译文件中有但代码中没有使用）
  const unusedKeys = [];
  allTranslationKeys.forEach((key) => {
    if (!scanResults.translationKeys.has(key)) {
      unusedKeys.push(key);
    }
  });

  scanResults.statistics = {
    totalKeys: allTranslationKeys.size,
    uniqueKeys: scanResults.translationKeys.size,
    missingKeys,
    unusedKeys,
    misuseKeys,
  };

  return { missingKeys, unusedKeys, misuseKeys };
}

/**
 * 生成扫描报告
 */
function generateScanReport(translations, analysis) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalFiles: scanResults.totalFiles,
      scannedFiles: scanResults.scannedFiles,
      errorCount: scanResults.errors.length,
      warningCount: scanResults.warnings.length,
      ...scanResults.statistics,
    },
    translationKeys: Array.from(scanResults.translationKeys).sort(),
    keyUsages: Object.fromEntries(
      Array.from(scanResults.keyUsages.entries()).map(([key, usages]) => [
        key,
        usages,
      ]),
    ),
    analysis,
    errors: scanResults.errors,
    warnings: scanResults.warnings,
  };

  // 确保输出目录存在
  if (!fs.existsSync(CONFIG.OUTPUT_DIR)) {
    fs.mkdirSync(CONFIG.OUTPUT_DIR, { recursive: true });
  }

  // 写入报告文件
  const reportPath = path.join(
    CONFIG.OUTPUT_DIR,
    "translation-scan-report.json",
  );

  if (fs.existsSync(reportPath)) {
    try {
      const previousContent = fs.readFileSync(reportPath, "utf8");
      const previousReport = JSON.parse(previousContent);
      const { timestamp: previousTimestamp, ...previousRest } = previousReport;
      const { timestamp: _currentTimestamp, ...currentRest } = report;

      if (JSON.stringify(previousRest) === JSON.stringify(currentRest)) {
        report.timestamp = previousTimestamp;
      }
    } catch {
      // Ignore parse errors and proceed with new timestamp
    }
  }

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(`📊 扫描报告已生成: ${reportPath}`);
  return report;
}

/**
 * 显示扫描结果
 */
function displayResults(analysis) {
  console.log("\n📊 扫描统计:\n");
  console.log(
    `   扫描文件: ${scanResults.scannedFiles}/${scanResults.totalFiles}`,
  );
  console.log(`   发现翻译键: ${scanResults.statistics.uniqueKeys}`);
  console.log(`   翻译文件总键数: ${scanResults.statistics.totalKeys}`);
  console.log(`   缺失键: ${analysis.missingKeys.length}`);
  console.log(`   未使用键: ${analysis.unusedKeys.length}`);
  console.log(`   错误: ${scanResults.errors.length}`);
  console.log(`   警告: ${scanResults.warnings.length}\n`);

  // 显示缺失的键
  if (analysis.missingKeys.length > 0) {
    console.log("❌ 缺失的翻译键:");
    analysis.missingKeys.slice(0, 10).forEach((key) => {
      const usages = scanResults.keyUsages.get(key) || [];
      console.log(`   - ${key} (使用 ${usages.length} 次)`);
    });
    if (analysis.missingKeys.length > 10) {
      console.log(`   ... 还有 ${analysis.missingKeys.length - 10} 个键`);
    }
    console.log();
  }

  // 显示未使用的键
  if (analysis.unusedKeys.length > 0) {
    console.log("⚠️  未使用的翻译键:");
    analysis.unusedKeys.slice(0, 10).forEach((key) => {
      console.log(`   - ${key}`);
    });
    if (analysis.unusedKeys.length > 10) {
      console.log(`   ... 还有 ${analysis.unusedKeys.length - 10} 个键`);
    }
    console.log();
  }
}

/**
 * 主函数
 */
async function main() {
  try {
    // 获取要扫描的文件
    const files = [];
    for (const pattern of CONFIG.SCAN_PATTERNS) {
      const matchedFiles = glob.sync(pattern, {
        cwd: process.cwd(),
        ignore: CONFIG.IGNORE_PATTERNS,
      });
      files.push(...matchedFiles);
    }

    scanResults.totalFiles = files.length;
    console.log(`📁 找到 ${files.length} 个文件待扫描\n`);

    // 扫描文件
    for (const file of files) {
      scanFile(file);
    }

    // 加载现有翻译
    const translations = loadExistingTranslations();

    // 分析使用情况
    const analysis = analyzeTranslationUsage(translations);

    // 生成报告
    generateScanReport(translations, analysis);

    // 显示结果
    displayResults(analysis);

    // 判断是否通过
    const hasErrors = scanResults.errors.length > 0;
    const hasMissingKeys = analysis.missingKeys.length > 0;

    if (!hasErrors && !hasMissingKeys) {
      console.log("✅ 翻译键扫描通过！所有翻译键都已正确定义。\n");
      process.exit(0);
    } else if (!hasErrors && hasMissingKeys) {
      console.log("⚠️  翻译键扫描完成，但发现缺失的翻译键。\n");
      process.exit(1);
    } else {
      console.log("❌ 翻译键扫描失败！存在解析错误。\n");
      process.exit(1);
    }
  } catch (error) {
    console.error("💥 翻译键扫描失败:", error.message);
    process.exit(1);
  }
}

// 运行主函数
main();
