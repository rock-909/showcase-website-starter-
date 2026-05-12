import { randomUUID } from "crypto";
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * Content Slug Sync CLI Integration Tests
 *
 * Tests for the CLI wrapper in scripts/starter-checks.js content-slugs
 * Focuses on CLI behavior that doesn't require content files:
 * - Help flag behavior
 * - Argument validation errors
 *
 * Note: Exit code and content validation tests are covered by the
 * core exports in starter-checks.js. This file focuses on
 * CLI-specific behavior that can be tested without setting up content.
 */

const CLI_PATH = path.resolve(__dirname, "../../../scripts/starter-checks.js");
const REPORT_PATH = path.resolve(
  __dirname,
  "../../../reports/content-slug-sync-report.json",
);
const REPORT_TRASH_ROOT = path.resolve(
  __dirname,
  "../../../reports/.trash/content-slug-sync-test",
);

let preservedReportPath: string | null = null;

function createTrashReportPath(prefix: string): string {
  return path.join(
    REPORT_TRASH_ROOT,
    `${prefix}-${process.pid}-${randomUUID()}.json`,
  );
}

function moveReportToTrash(prefix: string): string | null {
  if (!fs.existsSync(REPORT_PATH)) {
    return null;
  }

  fs.mkdirSync(REPORT_TRASH_ROOT, { recursive: true });
  const targetPath = createTrashReportPath(prefix);

  // eslint-disable-next-line security/detect-non-literal-fs-filename -- generated and preserved test reports are moved, never permanently deleted
  fs.renameSync(REPORT_PATH, targetPath);

  return targetPath;
}

function restorePreservedReport(): void {
  if (preservedReportPath === null) {
    return;
  }

  if (fs.existsSync(REPORT_PATH)) {
    moveReportToTrash("generated-before-restore");
  }

  // eslint-disable-next-line security/detect-non-literal-fs-filename -- restores the pre-test report path after moving generated output aside
  fs.renameSync(preservedReportPath, REPORT_PATH);
  preservedReportPath = null;
}

beforeEach(() => {
  preservedReportPath = moveReportToTrash("pre-existing");
});

afterEach(() => {
  try {
    moveReportToTrash("generated");
  } finally {
    restorePreservedReport();
  }
});

interface SpawnResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

/**
 * Execute CLI command and return result
 */
function runCLI(args: string[]): Promise<SpawnResult> {
  return new Promise((resolve) => {
    const proc = spawn("node", [CLI_PATH, "content-slugs", ...args], {
      env: { ...process.env },
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

describe("content-slug-sync CLI", () => {
  describe("help flag", () => {
    it("should display help with --help", async () => {
      const result = await runCLI(["--help"]);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain("MDX Content Slug Sync Validator");
      expect(result.stdout).toContain("--json");
      expect(result.stdout).toContain("--collections");
      expect(result.stdout).toContain("--locales");
      expect(result.stdout).toContain("--strict-frontmatter");
    });

    it("should display help with -h", async () => {
      const result = await runCLI(["-h"]);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain("MDX Content Slug Sync Validator");
    });

    it("should show usage examples", async () => {
      const result = await runCLI(["--help"]);

      expect(result.stdout).toContain(
        "node scripts/starter-checks.js content-slugs",
      );
      expect(result.stdout).toContain("--quiet");
    });
  });

  describe("argument validation", () => {
    it("should error when less than 2 locales specified", async () => {
      const result = await runCLI(["--locales=en"]);

      expect(result.code).toBe(1);
      // Error goes to stderr via console.error
      expect(result.stderr).toContain("At least 2 locales are required");
    });

    it("should error when no collections specified", async () => {
      const result = await runCLI(["--collections="]);

      expect(result.code).toBe(1);
      expect(result.stderr).toContain("No collections specified");
    });

    it("should parse multiple collections", async () => {
      // This test verifies CLI runs with multiple collections
      // (will validate against real content, so we just check it doesn't error on parsing)
      const result = await runCLI(["--collections=posts,pages", "--help"]);

      expect(result.code).toBe(0);
    });

    it("should parse multiple locales", async () => {
      // Verify CLI doesn't error when multiple locales are specified
      const result = await runCLI(["--locales=en,zh,ja", "--help"]);

      expect(result.code).toBe(0);
    });
  });

  describe("runs against real content", () => {
    it("should run validation on project content", async () => {
      // This test runs against the actual project content
      // It's an integration test that verifies the full pipeline works
      const result = await runCLI([]);

      // The CLI should complete (either pass or fail based on content state)
      expect(result.code).toBeDefined();
      // Should produce MDX Slug Sync output header
      expect(result.stdout).toContain("MDX Slug Sync Validation");
    });

    it("should keep default validation independent from strict frontmatter failures", async () => {
      const result = await runCLI([]);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain("MDX Slug Sync Validation");
      expect(result.stdout).not.toContain("Frontmatter/SEO Contract");
    });

    it("should fail strict frontmatter validation on current starter OG images", async () => {
      const result = await runCLI(["--strict-frontmatter"]);

      expect(result.code).toBe(1);
      expect(result.stdout).toContain("Frontmatter/SEO Contract Validation");
      expect(result.stdout).toContain("Starter OG Images");
    });

    it("should preserve --json report output path and payload", async () => {
      const result = await runCLI(["--json"]);

      expect(result.stdout).toContain("JSON report saved to:");
      expect(result.stdout).toContain("reports/content-slug-sync-report.json");
      expect(fs.existsSync(REPORT_PATH)).toBe(true);

      const report = JSON.parse(fs.readFileSync(REPORT_PATH, "utf8")) as {
        ok: boolean;
        timestamp: string;
        tool: string;
        version: string;
        checkedCollections: string[];
        checkedLocales: string[];
        issues: unknown[];
      };

      expect(report.tool).toBe("content-slug-sync");
      expect(report.version).toBe("1.0.0");
      expect(Number.isNaN(Date.parse(report.timestamp))).toBe(false);
      expect(report.checkedCollections).toEqual(["posts", "pages", "products"]);
      expect(report.checkedLocales).toEqual(["en", "zh"]);
      expect(typeof report.ok).toBe("boolean");
      expect(Array.isArray(report.issues)).toBe(true);
      expect(result.code).toBe(report.ok ? 0 : 1);
    });

    it("should support quiet mode", async () => {
      const normalResult = await runCLI([]);
      const quietResult = await runCLI(["--quiet"]);

      // Both should complete
      expect(normalResult.code).toBeDefined();
      expect(quietResult.code).toBeDefined();

      // Quiet mode should have less or equal output
      expect(quietResult.stdout.length).toBeLessThanOrEqual(
        normalResult.stdout.length,
      );
    });
  });
});
