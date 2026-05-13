import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = process.cwd();

const SEO_IMPLEMENTATION_FILES = [
  "src/lib/seo/metadata.ts",
  "src/lib/seo/sitemap-utils.ts",
  "src/lib/seo/page-structured-data.ts",
  "src/lib/seo/structured-data.ts",
  "src/lib/seo/structured-data-generators.ts",
  "src/lib/seo/structured-data-helpers.ts",
  "src/lib/seo/structured-data-types.ts",
] as const;

const SEO_FACADES = {
  "src/lib/seo-metadata.ts": [
    "@/lib/seo/metadata",
    "createPageSEOConfig",
    "generateLocalizedMetadata",
    "generateMetadataForPath",
  ],
  "src/lib/sitemap-utils.ts": [
    "@/lib/seo/sitemap-utils",
    "getContentLastModified",
    "getProductLastModified",
    "getStaticPageLastModified",
  ],
  "src/lib/page-structured-data.ts": [
    "@/lib/seo/page-structured-data",
    "generatePageStructuredData",
    "PageStructuredData",
  ],
  "src/lib/structured-data.ts": [
    "@/lib/seo/structured-data",
    "generateJSONLD",
    "generateStructuredData",
    "Locale",
  ],
  "src/lib/structured-data-generators.ts": [
    "@/lib/seo/structured-data-generators",
    "buildSchemaFallback",
    "generateOrganizationData",
    "generateWebSiteData",
  ],
  "src/lib/structured-data-helpers.ts": [
    "@/lib/seo/structured-data-helpers",
    "generateLocalizedStructuredData",
    "generateProductSchema",
  ],
  "src/lib/structured-data-types.ts": [
    "@/lib/seo/structured-data-types",
    "StructuredDataType",
    "Locale",
  ],
} as const;

const INTERNAL_SCAN_ROOTS = ["src/app", "src/components", "src/lib"] as const;
const FORBIDDEN_INTERNAL_IMPORTS = Object.keys(SEO_FACADES).map((file) => {
  const basename = file.replace("src/lib/", "").replace(/\.ts$/u, "");
  return `@/lib/${basename}`;
});

function readSource(relativePath: string): string {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- architecture test reads repo-local files from fixed allowlists
  return readFileSync(join(REPO_ROOT, relativePath), "utf8");
}

function collectSourceFiles(root: string): string[] {
  const absoluteRoot = join(REPO_ROOT, root);
  const result: string[] = [];
  const stack = [absoluteRoot];

  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined) continue;

    // eslint-disable-next-line security/detect-non-literal-fs-filename -- architecture test recursively scans fixed repo-local source roots only
    for (const entry of readdirSync(current)) {
      const absolutePath = join(current, entry);
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- architecture test checks fixed repo-local source paths only
      const stats = statSync(absolutePath);

      if (stats.isDirectory()) {
        if (entry === "__tests__" || entry === "stories") continue;
        stack.push(absolutePath);
        continue;
      }

      if (!/\.(ts|tsx)$/u.test(entry)) continue;
      if (entry.endsWith(".test.ts") || entry.endsWith(".test.tsx")) continue;
      if (entry.endsWith(".stories.tsx")) continue;

      result.push(relative(REPO_ROOT, absolutePath));
    }
  }

  return result.sort();
}

describe("SEO family boundary", () => {
  it("keeps SEO implementation files under src/lib/seo", () => {
    for (const file of SEO_IMPLEMENTATION_FILES) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- architecture test checks fixed repo-local implementation paths
      expect(existsSync(join(REPO_ROOT, file)), file).toBe(true);
    }
  });

  it("keeps old top-level SEO files as named-export facades", () => {
    for (const [facade, [target, ...expectedNames]] of Object.entries(
      SEO_FACADES,
    )) {
      const source = readSource(facade).trim();

      expect(source).toContain(`from "${target}"`);
      expect(source).not.toContain("export *");

      for (const expectedName of expectedNames) {
        expect(source).toContain(expectedName);
      }
    }
  });

  it("keeps internal production imports on src/lib/seo paths", () => {
    const offenders: string[] = [];

    for (const root of INTERNAL_SCAN_ROOTS) {
      for (const file of collectSourceFiles(root)) {
        if (Object.keys(SEO_FACADES).includes(file)) continue;

        const source = readSource(file);

        for (const forbidden of FORBIDDEN_INTERNAL_IMPORTS) {
          if (
            source.includes(`from "${forbidden}"`) ||
            source.includes(`from '${forbidden}'`) ||
            source.includes(`require("${forbidden}")`) ||
            source.includes(`require('${forbidden}')`)
          ) {
            offenders.push(`${file} imports ${forbidden}`);
          }
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
