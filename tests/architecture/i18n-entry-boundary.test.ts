import { existsSync, readdirSync, readFileSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs"]);
const SOURCE_ROOTS = ["src", "tests", "scripts"];

const IMPORT_SPECIFIER_PATTERN =
  /\b(?:from\s+|import\s*\(\s*|vi\.mock\(\s*)(["'])(?<specifier>[^"']+)\1/gu;

const EDGE_SAFE_FILES = ["src/middleware.ts"];

function read(repoPath: string): string {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- architecture test reads fixed repo-local paths
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

function importSpecifiersFor(repoPath: string): string[] {
  return [...read(repoPath).matchAll(IMPORT_SPECIFIER_PATTERN)].map((match) => {
    return match.groups?.specifier ?? "";
  });
}

describe("i18n entry boundaries", () => {
  it("keeps i18n.json as tool config outside runtime imports", () => {
    const offenders = SOURCE_ROOTS.flatMap((root) =>
      walkSourceFiles(root),
    ).flatMap((repoPath) => {
      return importSpecifiersFor(repoPath)
        .filter((specifier) => {
          return (
            specifier === "@/../i18n.json" || specifier.endsWith("i18n.json")
          );
        })
        .map((specifier) => `${repoPath} -> ${specifier}`);
    });

    expect(offenders).toEqual([]);
  });

  it("keeps edge-sensitive runtime files off the UI navigation facade", () => {
    const offenders = EDGE_SAFE_FILES.flatMap((repoPath) => {
      return importSpecifiersFor(repoPath)
        .filter((specifier) => specifier === "@/i18n/routing")
        .map((specifier) => `${repoPath} -> ${specifier}`);
    });

    expect(offenders).toEqual([]);
  });

  it("keeps i18n message loaders off the UI navigation facade", () => {
    const checkedFiles = [
      "src/lib/i18n/load-messages.ts",
      "src/lib/i18n/client-messages.ts",
    ];

    const offenders = checkedFiles.flatMap((repoPath) => {
      return importSpecifiersFor(repoPath)
        .filter((specifier) => specifier === "@/i18n/routing")
        .map((specifier) => `${repoPath} -> ${specifier}`);
    });

    expect(offenders).toEqual([]);
  });

  it("keeps src/i18n/routing.ts focused on navigation exports", () => {
    const source = read("src/i18n/routing.ts");

    expect(source).toContain("createNavigation(routing)");
    expect(source).not.toContain("validatePathsConfig");
  });

  it("does not document a missing locale presentation module", () => {
    expect(existsSync("src/i18n/locale-presentation.ts")).toBe(false);
    expect(read("docs/guides/STRUCTURAL-CHANGE-CLUSTERS.md")).not.toContain(
      "src/i18n/locale-presentation.ts",
    );
  });

  it("keeps i18n performance instrumentation to runtime-used metrics", () => {
    const source = read("src/lib/i18n/performance.ts");

    expect(source).toContain("recordLoadTime");
    expect(source).toContain("recordError");
    expect(source).not.toContain("recordCacheHit");
    expect(source).not.toContain("recordCacheMiss");
    expect(source).not.toContain("evaluatePerformance");
  });
});
