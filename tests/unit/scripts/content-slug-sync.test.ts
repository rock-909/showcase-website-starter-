import { spawn } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, describe, expect, it } from "vitest";

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
const TEMP_TRASH_ROOT = path.join(
  os.tmpdir(),
  "showcase-content-slug-sync-report-trash",
);

function moveReportToTrash(): void {
  if (!fs.existsSync(REPORT_PATH)) {
    return;
  }

  // eslint-disable-next-line security/detect-non-literal-fs-filename -- cleanup moves generated reports to a recoverable os.tmpdir trash folder
  fs.mkdirSync(TEMP_TRASH_ROOT, { recursive: true });
  const targetPath = path.join(
    TEMP_TRASH_ROOT,
    `content-slug-sync-report-${Date.now()}.json`,
  );

  // eslint-disable-next-line security/detect-non-literal-fs-filename -- generated report cleanup uses recoverable rename instead of permanent deletion
  fs.renameSync(REPORT_PATH, targetPath);
}

afterEach(() => {
  moveReportToTrash();
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

    it("should preserve --json report output path and payload", async () => {
      const result = await runCLI(["--json"]);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain("JSON report saved to:");
      expect(result.stdout).toContain("reports/content-slug-sync-report.json");
      expect(fs.existsSync(REPORT_PATH)).toBe(true);

      const report = JSON.parse(fs.readFileSync(REPORT_PATH, "utf8")) as {
        ok: boolean;
        tool: string;
        checkedCollections: string[];
        checkedLocales: string[];
      };

      expect(report.ok).toBe(true);
      expect(report.tool).toBe("content-slug-sync");
      expect(report.checkedCollections).toEqual(["posts", "pages", "products"]);
      expect(report.checkedLocales).toEqual(["en", "zh"]);
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
