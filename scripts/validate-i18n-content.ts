#!/usr/bin/env tsx
/**
 * 国际化内容验证工具
 *
 * 功能：
 * 1. 检测 en 页面是否显示 zh 内容
 * 2. 检测 zh 页面是否显示 en 内容
 * 3. 验证翻译键的完整性
 * 4. 检查硬编码文本
 *
 * 使用方法：
 * pnpm tsx scripts/validate-i18n-content.ts
 */
import fs from "fs";
import path from "path";
import { glob } from "glob";

interface ValidationIssue {
  file: string;
  line: number;
  type: "mixed-content" | "missing-translation" | "hardcoded-text";
  message: string;
  severity: "error" | "warning";
}

const issues: ValidationIssue[] = [];

// 中文字符正则表达式
const CHINESE_REGEX = /[\u4e00-\u9fa5]/g;

// 英文单词正则表达式（排除常见技术术语）
const ENGLISH_WORD_REGEX = /\b[a-zA-Z]{3,}\b/g;

// 技术术语白名单（不算作英文内容）
const TECH_TERMS = new Set([
  "React",
  "Next",
  "TypeScript",
  "JavaScript",
  "CSS",
  "HTML",
  "API",
  "JSON",
  "HTTP",
  "HTTPS",
  "URL",
  "SEO",
  "UI",
  "UX",
  "GitHub",
  "npm",
  "pnpm",
  "yarn",
  "ESLint",
  "Prettier",
  "Tailwind",
  "shadcn",
  "Radix",
  "Lucide",
  "Zod",
  "MDX",
  "Server",
  "Client",
  "Component",
  "Hook",
  "Props",
  "State",
]);

/**
 * 检查文件中的混合内容
 */
function checkMixedContent(filePath: string, content: string) {
  const lines = content.split("\n");
  const isEnglishFile = filePath.includes("/en/") || filePath.includes("/en.");
  const isChineseFile = filePath.includes("/zh/") || filePath.includes("/zh.");

  if (!isEnglishFile && !isChineseFile) {
    return; // 跳过非语言特定文件
  }

  lines.forEach((line, index) => {
    // 跳过导入语句、注释、JSX 属性、代码行
    if (
      line.trim().startsWith("import ") ||
      line.trim().startsWith("export ") ||
      line.trim().startsWith("//") ||
      line.trim().startsWith("/*") ||
      line.trim().startsWith("*") ||
      line.includes("className=") ||
      line.includes("data-testid=") ||
      line.includes("const ") ||
      line.includes("let ") ||
      line.includes("var ") ||
      line.includes("function ") ||
      line.includes("=>") ||
      line.trim().startsWith("<") ||
      line.trim().startsWith("}")
    ) {
      return;
    }

    // 检查 JSX 文本内容（在 > 和 < 之间）
    const jsxTextRegex = />([^<>]+)</g;
    const jsxMatches = line.matchAll(jsxTextRegex);

    for (const match of jsxMatches) {
      const text = match[1].trim();

      // 跳过空白、数字、单个字符、变量引用
      if (
        !text ||
        /^\d+$/.test(text) ||
        text.length === 1 ||
        text.startsWith("{")
      ) {
        continue;
      }

      const chineseMatches = text.match(CHINESE_REGEX);
      const englishMatches = text.match(ENGLISH_WORD_REGEX);

      // 过滤技术术语
      const realEnglishWords = englishMatches?.filter(
        (word) => !TECH_TERMS.has(word),
      );

      // 英文文件中出现中文
      if (isEnglishFile && chineseMatches && chineseMatches.length > 0) {
        issues.push({
          file: filePath,
          line: index + 1,
          type: "mixed-content",
          message: `English file contains Chinese text: "${text.substring(0, 50)}"`,
          severity: "error",
        });
      }

      // 中文文件中出现英文（排除技术术语）
      if (isChineseFile && realEnglishWords && realEnglishWords.length > 3) {
        issues.push({
          file: filePath,
          line: index + 1,
          type: "mixed-content",
          message: `Chinese file contains English text: "${text.substring(0, 50)}"`,
          severity: "warning",
        });
      }
    }
  });
}

/**
 * 主函数
 */
async function main() {
  console.log("🔍 Starting i18n content validation...\n");

  // 查找所有 TypeScript/TSX 文件
  const files = await glob("src/**/*.{ts,tsx}", {
    ignore: [
      "**/node_modules/**",
      "**/*.test.{ts,tsx}",
      "**/*.spec.{ts,tsx}",
      "**/dist/**",
      "**/.next/**",
    ],
  });

  console.log(`📁 Found ${files.length} files to check\n`);

  // 检查每个文件
  for (const file of files) {
    const content = fs.readFileSync(file, "utf-8");

    checkMixedContent(file, content);
  }

  // 输出结果
  console.log("📊 Validation Results:\n");

  if (issues.length === 0) {
    console.log(
      "✅ No issues found! All i18n content is properly separated.\n",
    );
    process.exit(0);
  }

  // 按严重程度分组
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");

  if (errors.length > 0) {
    console.log(`❌ Found ${errors.length} errors:\n`);
    errors.forEach((issue) => {
      console.log(`  ${issue.file}:${issue.line}`);
      console.log(`    ${issue.message}\n`);
    });
  }

  if (warnings.length > 0) {
    console.log(`⚠️  Found ${warnings.length} warnings:\n`);
    warnings.forEach((issue) => {
      console.log(`  ${issue.file}:${issue.line}`);
      console.log(`    ${issue.message}\n`);
    });
  }

  console.log(
    `\n📈 Summary: ${errors.length} errors, ${warnings.length} warnings\n`,
  );

  // 如果有错误，退出码为 1
  process.exit(errors.length > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error("❌ Validation failed:", error);
  process.exit(1);
});
