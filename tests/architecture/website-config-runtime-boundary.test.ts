import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);
const RUNTIME_SOURCE_ROOTS = [
  "src/app",
  "src/components",
  "src/hooks",
  "src/lib",
  "src/services",
  "src/templates",
];

const WEBSITE_CONFIG_PREFIX = "@/config/website";
const IMPORT_MARKERS = [
  'from "',
  "from '",
  'import "',
  "import '",
  'import("',
  "import('",
  'require("',
  "require('",
];

function read(repoPath: string) {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- architecture test reads repo-local files from fixed scan roots
  return readFileSync(repoPath, "utf8");
}

function walkSourceFiles(dir: string, results: string[] = []) {
  let entries: ReturnType<typeof readdirSync>;

  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- architecture test recursively scans fixed repo-local runtime roots
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return results;
    }

    throw error;
  }

  for (const entry of entries) {
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

function findWebsiteConfigImports(source: string) {
  const specifiers: string[] = [];

  for (const marker of IMPORT_MARKERS) {
    let searchFrom = 0;

    while (searchFrom < source.length) {
      const markerIndex = source.indexOf(marker, searchFrom);

      if (markerIndex === -1) {
        break;
      }

      const specifierStart = markerIndex + marker.length;
      const quote = marker.at(-1);

      if (quote === undefined) {
        searchFrom = specifierStart;
        continue;
      }

      const specifierEnd = source.indexOf(quote, specifierStart);

      if (specifierEnd === -1) {
        searchFrom = specifierStart;
        continue;
      }

      const specifier = source.slice(specifierStart, specifierEnd);

      if (
        specifier === WEBSITE_CONFIG_PREFIX ||
        specifier.startsWith(`${WEBSITE_CONFIG_PREFIX}/`)
      ) {
        specifiers.push(specifier);
      }

      searchFrom = specifierEnd + 1;
    }
  }

  return specifiers;
}

describe("website config runtime boundary", () => {
  it("keeps replacement website config out of runtime app dependencies", () => {
    const offenders = RUNTIME_SOURCE_ROOTS.flatMap((root) =>
      walkSourceFiles(root),
    ).flatMap((repoPath) => {
      const source = read(repoPath);
      const imports = findWebsiteConfigImports(source);

      return imports.map((specifier) => `${repoPath} -> ${specifier}`);
    });

    expect(offenders).toEqual([]);
  });

  it("catches direct, nested, dynamic, and require imports", () => {
    const examples = [
      'import { websiteProfile } from "@/config/website";',
      'import { websiteProfile } from "@/config/website/profile";',
      'export { websiteProfile } from "@/config/website/profile";',
      'await import("@/config/website/profile");',
      'require("@/config/website/profile");',
    ];

    for (const source of examples) {
      const matches = findWebsiteConfigImports(source);

      expect(matches).toHaveLength(1);
    }
  });
});
