import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const CORE_UI_COMPONENTS = [
  "button",
  "badge",
  "card",
  "input",
  "textarea",
  "label",
] as const;

const SOURCE_ROOT = "src";
const STORY_EXPLORATION_ROOT = "src/stories";
const UI_WRAPPER_ROOT = "src/components/ui";
const STORY_OR_TEST_FILE_PATTERN =
  /(?:\.stories\.(?:ts|tsx|js|jsx|mdx)|\.(?:test|spec)\.(?:ts|tsx|js|jsx)|\/__tests__\/)/;
const SOURCE_FILE_PATTERN = /\.(?:ts|tsx)$/;
const RADIX_IMPORT_PATTERN = /from\s+["']@radix-ui\//;

function walkFiles(root: string): string[] {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixed architecture test root
  return readdirSync(root).flatMap((entry) => {
    const fullPath = join(root, entry);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixed architecture test traversal
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      return walkFiles(fullPath);
    }

    return fullPath;
  });
}

function normalizePath(filePath: string): string {
  return relative(process.cwd(), filePath).replaceAll("\\", "/");
}

function isStoryModulePath(importPath: string, importerDirectory: string) {
  if (importPath === "@/stories" || importPath.startsWith("@/stories/")) {
    return true;
  }

  if (!importPath.startsWith(".")) {
    return false;
  }

  const normalizedImportPath = join(importerDirectory, importPath).replaceAll(
    "\\",
    "/",
  );

  return (
    normalizedImportPath === STORY_EXPLORATION_ROOT ||
    normalizedImportPath.startsWith(`${STORY_EXPLORATION_ROOT}/`)
  );
}

function hasStoryImport(source: string, filePath: string): boolean {
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    false,
    ts.ScriptKind.TSX,
  );

  const importerDirectory = filePath.split("/").slice(0, -1).join("/");

  return sourceFile.statements.some((statement) => {
    if (
      !ts.isImportDeclaration(statement) &&
      !ts.isExportDeclaration(statement)
    ) {
      return false;
    }

    const moduleSpecifier = statement.moduleSpecifier;

    if (!moduleSpecifier || !ts.isStringLiteral(moduleSpecifier)) {
      return false;
    }

    const importPath = moduleSpecifier.text;
    return isStoryModulePath(importPath, importerDirectory);
  });
}

describe("component governance", () => {
  it("keeps Storybook coverage for core UI primitives", () => {
    for (const componentName of CORE_UI_COMPONENTS) {
      const componentPath = `${UI_WRAPPER_ROOT}/${componentName}.tsx`;
      const storyPath = `${UI_WRAPPER_ROOT}/${componentName}.stories.tsx`;

      expect(
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- component paths are built from fixed governance inventory
        existsSync(componentPath),
        `${componentPath} should exist before checking Storybook coverage`,
      ).toBe(true);
      expect(
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- story paths are built from fixed governance inventory
        existsSync(storyPath),
        `${storyPath} should document reviewable states for ${componentName}`,
      ).toBe(true);
    }
  });

  it("keeps direct Radix imports inside the UI wrapper layer", () => {
    const violations = walkFiles(SOURCE_ROOT)
      .map(normalizePath)
      .filter((filePath) => SOURCE_FILE_PATTERN.test(filePath))
      .filter((filePath) => !filePath.startsWith(`${UI_WRAPPER_ROOT}/`))
      .filter((filePath) => !STORY_OR_TEST_FILE_PATTERN.test(filePath))
      .filter((filePath) => {
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- architecture test reads source files
        const source = readFileSync(filePath, "utf8");
        return RADIX_IMPORT_PATTERN.test(source);
      });

    expect(violations).toEqual([]);
  });

  it("keeps Storybook exploration out of production imports", () => {
    const violations = walkFiles(SOURCE_ROOT)
      .map(normalizePath)
      .filter((filePath) => SOURCE_FILE_PATTERN.test(filePath))
      .filter((filePath) => !filePath.startsWith(`${STORY_EXPLORATION_ROOT}/`))
      .filter((filePath) => !STORY_OR_TEST_FILE_PATTERN.test(filePath))
      .filter((filePath) => {
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- architecture test reads source files
        const source = readFileSync(filePath, "utf8");
        return hasStoryImport(source, filePath);
      });

    expect(violations).toEqual([]);
  });

  it("detects Storybook exploration imports without matching similarly named modules", () => {
    const importerPath = "src/components/example.ts";

    expect(hasStoryImport('import "@/stories";', importerPath)).toBe(true);
    expect(
      hasStoryImport(
        'export { Example } from "@/stories/example";',
        importerPath,
      ),
    ).toBe(true);
    expect(hasStoryImport('import "../stories/example";', importerPath)).toBe(
      true,
    );
    expect(hasStoryImport('import "@/stories-utils";', importerPath)).toBe(
      false,
    );
    expect(hasStoryImport("export { Example };", importerPath)).toBe(false);
  });
});
