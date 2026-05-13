import { existsSync, readdirSync, readFileSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs"]);
const SCAN_ROOTS = ["src", "tests"];
const SELF = "tests/architecture/content-family-boundary.test.ts";

const CONTENT_IMPLEMENTATION_FILES = [
  "src/lib/content/manifest.ts",
  "src/lib/content/manifest.generated.ts",
  "src/lib/content/mdx-importers.generated.ts",
  "src/lib/content/mdx-loader.ts",
  "src/lib/content/parser.ts",
  "src/lib/content/utils.ts",
  "src/lib/content/validation.ts",
  "src/lib/content/queries.ts",
] as const;

const CONTENT_FACADE_FILES = [
  {
    path: "src/lib/content-manifest.ts",
    requiredSpecifiers: ['"@/lib/content/manifest"'],
  },
  {
    path: "src/lib/content-manifest.generated.ts",
    requiredSpecifiers: ['"@/lib/content/manifest.generated"'],
  },
  {
    path: "src/lib/mdx-importers.generated.ts",
    requiredSpecifiers: ['"@/lib/content/mdx-importers.generated"'],
  },
  {
    path: "src/lib/mdx-loader.ts",
    requiredSpecifiers: ['"@/lib/content/mdx-loader"'],
  },
  {
    path: "src/lib/content-parser.ts",
    requiredSpecifiers: ['"@/lib/content/parser"'],
  },
  {
    path: "src/lib/content-utils.ts",
    requiredSpecifiers: ['"@/lib/content/utils"'],
  },
  {
    path: "src/lib/content-validation.ts",
    requiredSpecifiers: ['"@/lib/content/validation"'],
  },
  {
    path: "src/lib/content-query/queries.ts",
    requiredSpecifiers: ['"@/lib/content/queries"'],
  },
] as const;

const FORBIDDEN_FACADE_TOKENS = [
  'from "node:fs"',
  "from 'node:fs'",
  'from "fs"',
  "from 'fs'",
  'from "node:path"',
  "from 'node:path'",
  'from "path"',
  "from 'path'",
  'from "gray-matter"',
  "from 'gray-matter'",
  'from "js-yaml"',
  "from 'js-yaml'",
  "export *",
] as const;

const LEGACY_INTERNAL_IMPORTS = [
  "@/lib/content-manifest",
  "@/lib/content-manifest.generated",
  "@/lib/mdx-importers.generated",
  "@/lib/mdx-loader",
  "@/lib/content-parser",
  "@/lib/content-utils",
  "@/lib/content-validation",
  "@/lib/content-query/queries",
] as const;

const IMPORT_SPECIFIER_PATTERN =
  /\b(?:from\s+|import\s*\(\s*|vi\.mock\(\s*)(["'])(?<specifier>[^"']+)\1/gu;

function read(repoPath: string): string {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- architecture test reads fixed repo-local files
  return readFileSync(repoPath, "utf8");
}

function walkSourceFiles(dir: string, results: string[] = []): string[] {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- architecture test scans fixed repo-local roots
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".git", ".next"].includes(entry.name)) {
      continue;
    }

    const absolutePath = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkSourceFiles(absolutePath, results);
      continue;
    }

    if (entry.isFile() && SOURCE_EXTENSIONS.has(extname(entry.name))) {
      results.push(relative(process.cwd(), absolutePath).split(sep).join("/"));
    }
  }

  return results;
}

function isAllowedCompatibilityFile(repoPath: string): boolean {
  return CONTENT_FACADE_FILES.some((facade) => facade.path === repoPath);
}

describe("content family boundary", () => {
  it("keeps content implementation inside src/lib/content", () => {
    const missing = CONTENT_IMPLEMENTATION_FILES.filter(
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- architecture test checks fixed repo-local content family paths from the allowlist above
      (repoPath) => !existsSync(repoPath),
    );

    expect(missing).toEqual([]);
  });

  it("keeps old content paths as thin named-export facades", () => {
    for (const facade of CONTENT_FACADE_FILES) {
      const source = read(facade.path);

      for (const token of FORBIDDEN_FACADE_TOKENS) {
        expect(
          source,
          `${facade.path} should not contain ${token}`,
        ).not.toContain(token);
      }

      for (const specifier of facade.requiredSpecifiers) {
        expect(
          source,
          `${facade.path} should re-export ${specifier}`,
        ).toContain(specifier);
      }
    }
  });

  it("keeps internal source and tests on concrete content family modules", () => {
    const offenders = SCAN_ROOTS.flatMap((root) => walkSourceFiles(root))
      .filter((repoPath) => repoPath !== SELF)
      .filter((repoPath) => !isAllowedCompatibilityFile(repoPath))
      .flatMap((repoPath) => {
        const source = read(repoPath);
        return [...source.matchAll(IMPORT_SPECIFIER_PATTERN)]
          .map((match) => match.groups?.specifier ?? "")
          .filter((specifier) => LEGACY_INTERNAL_IMPORTS.includes(specifier))
          .map((specifier) => `${repoPath} -> ${specifier}`);
      });

    expect(offenders).toEqual([]);
  });
});
