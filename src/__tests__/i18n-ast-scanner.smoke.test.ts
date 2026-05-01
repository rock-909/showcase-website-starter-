import { spawnSync } from "child_process";

/**
 * Smoke test to ensure the i18n AST scanner passes.
 * Fails if object-as-string-key misuse or other scanner errors are detected.
 */
describe("i18n AST scanner", () => {
  it("should pass (no object-key misuse, no scanner errors)", () => {
    const res = spawnSync(
      process.execPath,
      ["scripts/translation-scanner.js"],
      {
        encoding: "utf8",
        stdio: "pipe",
      },
    );

    // When scanner finds issues, it exits with non-zero status
    if (res.status !== 0) {
      // Print stdout/stderr for easier diagnosis in CI logs
      console.error(res.stdout || "");
      console.error(res.stderr || "");
    }

    expect(res.status).toBe(0);
  });
});
