import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

const mutationCheck =
  await import("../../../scripts/check-mutation-required.js");

describe("check-mutation-required", () => {
  describe("suggested mutation commands", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts: Record<string, string>;
    };

    function extractPnpmScripts(command: string): string[] {
      return command
        .split("&&")
        .map((part) => part.trim())
        .map((part) => part.match(/^pnpm (?<script>[^\s]+)$/)?.groups?.script)
        .filter((script): script is string => Boolean(script));
    }

    it.each([
      [["src/lib/lead-pipeline/"], "lead only"],
      [["src/lib/security/"], "security only"],
      [["src/lib/form-schema/"], "form schema"],
      [["src/lib/lead-pipeline/", "src/lib/security/"], "lead and security"],
    ])("only suggests package scripts that exist for %s", (directories) => {
      const command = mutationCheck.getSuggestedMutationCommand(directories);
      const scripts = extractPnpmScripts(command);

      expect(scripts).not.toHaveLength(0);
      expect(scripts).toEqual(
        scripts.filter((script) => script in packageJson.scripts),
      );
    });

    it("uses one comma-separated mutate scope for the combined lead-security script", () => {
      expect(packageJson.scripts["test:mutation:lead-security"]).toBe(
        "stryker run --mutate 'src/lib/lead-pipeline/**/*.ts,src/lib/security/**/*.ts'",
      );
    });
  });

  describe("getLatestRelevantChangeTimestampMs", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("uses the latest committed timestamp for touched protected files", () => {
      const latest = mutationCheck.getLatestRelevantChangeTimestampMs(
        [
          "src/lib/security/rate-limit.ts",
          "src/lib/lead-pipeline/submit.ts",
          "src/components/hero.tsx",
        ],
        {
          getLatestCommittedChangeTimestampMsFn: (filePath: string) =>
            filePath.includes("submit") ? 4_500 : 2_500,
        },
      );

      expect(latest).toBe(4_500);
    });

    it("returns the latest committed timestamp for deleted protected files too", () => {
      const latest = mutationCheck.getLatestRelevantChangeTimestampMs(
        ["src/lib/security/deleted-guard.ts"],
        {
          getLatestCommittedChangeTimestampMsFn: () => 1_710_000_000_000,
        },
      );

      expect(latest).toBe(1_710_000_000_000);
    });
  });

  describe("main freshness enforcement", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("rejects reports older than the latest protected change even if they are newer than branch start", () => {
      const isReportFreshEnoughFn = vi.fn(() => false);

      expect(() =>
        mutationCheck.main({
          getChangedFilesFn: () => ["src/lib/security/rate-limit.ts"],
          getTouchedTargetDirectoriesFn:
            mutationCheck.getTouchedTargetDirectories,
          getMergeBaseTimestampMsFn: () => 1_700_000_000_000,
          getLatestRelevantChangeTimestampMsFn: () => 1_700_000_000_900,
          loadMutationReportFn: () => ({
            config: {
              mutate: ["src/lib/security/**/*.ts"],
            },
          }),
          isReportFreshEnoughFn,
        }),
      ).toThrow(
        "变异测试报告早于本次受保护改动的最新变更，请重新运行对应的局部变异测试命令",
      );
      expect(isReportFreshEnoughFn).toHaveBeenCalledWith(
        mutationCheck.REPORT_PATH,
        1_700_000_000_900,
      );
    });

    it("accepts reports generated after the latest protected change", () => {
      const isReportFreshEnoughFn = vi.fn(() => true);

      expect(() =>
        mutationCheck.main({
          getChangedFilesFn: () => ["src/lib/security/rate-limit.ts"],
          getTouchedTargetDirectoriesFn:
            mutationCheck.getTouchedTargetDirectories,
          getMergeBaseTimestampMsFn: () => 1_700_000_000_000,
          getLatestRelevantChangeTimestampMsFn: () => 1_700_000_000_900,
          loadMutationReportFn: () => ({
            config: {
              mutate: ["src/lib/security/**/*.ts"],
            },
          }),
          isReportFreshEnoughFn,
        }),
      ).not.toThrow();
      expect(isReportFreshEnoughFn).toHaveBeenCalledWith(
        mutationCheck.REPORT_PATH,
        1_700_000_000_900,
      );
    });

    it("rejects a fresh report when mutate scope misses the touched protected directory", () => {
      const isReportFreshEnoughFn = vi.fn(() => true);

      expect(() =>
        mutationCheck.main({
          getChangedFilesFn: () => ["src/lib/security/rate-limit.ts"],
          getTouchedTargetDirectoriesFn:
            mutationCheck.getTouchedTargetDirectories,
          getMergeBaseTimestampMsFn: () => 1_700_000_000_000,
          getLatestRelevantChangeTimestampMsFn: () => 1_700_000_000_900,
          loadMutationReportFn: () => ({
            config: {
              mutate: ["src/lib/lead-pipeline/**/*.ts"],
            },
          }),
          isReportFreshEnoughFn,
        }),
      ).toThrow(
        [
          "变异测试报告 scope 不覆盖本次改动。",
          "命中目录: src/lib/security/",
          "报告 mutate scope: src/lib/lead-pipeline/**/*.ts",
          "未覆盖目录: src/lib/security/",
          "请运行 pnpm test:mutation:security 并更新 reports/mutation/mutation-report.json",
        ].join("\n"),
      );
      expect(isReportFreshEnoughFn).toHaveBeenCalledWith(
        mutationCheck.REPORT_PATH,
        1_700_000_000_900,
      );
    });

    it("suggests lead-scoped mutation when only lead-pipeline is touched", () => {
      const isReportFreshEnoughFn = vi.fn(() => true);

      expect(() =>
        mutationCheck.main({
          getChangedFilesFn: () => ["src/lib/lead-pipeline/process-lead.ts"],
          getTouchedTargetDirectoriesFn:
            mutationCheck.getTouchedTargetDirectories,
          getMergeBaseTimestampMsFn: () => 1_700_000_000_000,
          getLatestRelevantChangeTimestampMsFn: () => 1_700_000_000_900,
          loadMutationReportFn: () => ({
            config: {
              mutate: ["src/lib/security/**/*.ts"],
            },
          }),
          isReportFreshEnoughFn,
        }),
      ).toThrow(
        [
          "变异测试报告 scope 不覆盖本次改动。",
          "命中目录: src/lib/lead-pipeline/",
          "报告 mutate scope: src/lib/security/**/*.ts",
          "未覆盖目录: src/lib/lead-pipeline/",
          "请运行 pnpm test:mutation:lead 并更新 reports/mutation/mutation-report.json",
        ].join("\n"),
      );
    });

    it("suggests combined scoped mutation when both lead and security change", () => {
      const isReportFreshEnoughFn = vi.fn(() => true);

      expect(() =>
        mutationCheck.main({
          getChangedFilesFn: () => [
            "src/lib/lead-pipeline/process-lead.ts",
            "src/lib/security/distributed-rate-limit.ts",
          ],
          getTouchedTargetDirectoriesFn:
            mutationCheck.getTouchedTargetDirectories,
          getMergeBaseTimestampMsFn: () => 1_700_000_000_000,
          getLatestRelevantChangeTimestampMsFn: () => 1_700_000_000_900,
          loadMutationReportFn: () => ({
            config: {
              mutate: ["src/lib/security/**/*.ts"],
            },
          }),
          isReportFreshEnoughFn,
        }),
      ).toThrow(
        [
          "变异测试报告 scope 不覆盖本次改动。",
          "命中目录: src/lib/lead-pipeline/, src/lib/security/",
          "报告 mutate scope: src/lib/security/**/*.ts",
          "未覆盖目录: src/lib/lead-pipeline/",
          "请运行 pnpm test:mutation:lead-security 并更新 reports/mutation/mutation-report.json",
        ].join("\n"),
      );
    });
  });
});
