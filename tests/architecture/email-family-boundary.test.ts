import { existsSync, readdirSync, readFileSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs"]);
const SCAN_ROOTS = ["src", "tests"];
const SELF = "tests/architecture/email-family-boundary.test.ts";

const EMAIL_RUNTIME_FILES = [
  "src/lib/email/email-data-schema.ts",
  "src/lib/email/resend-core.tsx",
  "src/lib/email/resend-instance.ts",
  "src/lib/email/resend-utils.ts",
];

const LEGACY_RESEND_FACADES = [
  {
    path: "src/lib/resend-core.tsx",
    expected: 'export { ResendService } from "@/lib/email/resend-core";',
  },
  {
    path: "src/lib/resend-instance.ts",
    expected: 'export { resendService } from "@/lib/email/resend-instance";',
  },
  {
    path: "src/lib/resend-utils.ts",
    expected:
      'export { EMAIL_CONFIG, ResendUtils } from "@/lib/email/resend-utils";',
  },
];

const FORBIDDEN_LEGACY_IMPORTS = [
  "@/lib/resend-core",
  "@/lib/resend-instance",
  "@/lib/resend-utils",
  "../resend-core",
  "../resend-instance",
  "../resend-utils",
];

const IMPORT_SPECIFIER_PATTERN =
  /\b(?:from\s+|import\s*\(\s*|vi\.mock\(\s*)(["'])(?<specifier>[^"']+)\1/gu;

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

describe("email family boundaries", () => {
  it("keeps email integration runtime under src/lib/email", () => {
    expect(
      EMAIL_RUNTIME_FILES.filter((repoPath) => {
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- architecture test checks fixed repo-local paths
        return !existsSync(repoPath);
      }),
    ).toEqual([]);
  });

  it("keeps legacy Resend entrypoints as thin named-export facades", () => {
    for (const facade of LEGACY_RESEND_FACADES) {
      expect(read(facade.path).trim()).toBe(facade.expected);
    }
  });

  it("moves source and tests to concrete email imports", () => {
    const offenders = SCAN_ROOTS.flatMap((root) => walkSourceFiles(root))
      .filter((repoPath) => {
        return repoPath !== SELF && !repoPath.startsWith("src/lib/resend-");
      })
      .flatMap((repoPath) => {
        return importSpecifiersFor(repoPath)
          .filter((specifier) => FORBIDDEN_LEGACY_IMPORTS.includes(specifier))
          .map((specifier) => `${repoPath} -> ${specifier}`);
      });

    expect(offenders).toEqual([]);
  });

  it("keeps React email templates outside lib email runtime", () => {
    const misplacedTemplates = walkSourceFiles("src/lib/email").filter(
      (repoPath) => {
        return /(?:^|\/)(?:ConfirmationEmail|ContactFormEmail|ProductInquiryEmail|EmailLayout|EmailField)\.tsx$/u.test(
          repoPath,
        );
      },
    );

    expect(misplacedTemplates).toEqual([]);
    expect(existsSync("src/emails/ConfirmationEmail.tsx")).toBe(true);
    expect(existsSync("src/emails/ContactFormEmail.tsx")).toBe(true);
    expect(existsSync("src/emails/ProductInquiryEmail.tsx")).toBe(true);
  });
});
