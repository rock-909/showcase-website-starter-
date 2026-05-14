import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("repair artifact closeout", () => {
  it("keeps backlog and next-wave artifacts aligned with completed repair status", () => {
    const backlog = readFileSync("REPAIR-BACKLOG.md", "utf8");
    const nextWave = readFileSync("NEXT-WAVE.md", "utf8");
    const progress = readFileSync(".context/goal-repair/PROGRESS.md", "utf8");

    for (const finding of [
      "F-01",
      "F-02",
      "F-03",
      "F-04",
      "F-05",
      "F-06",
      "F-07",
      "F-08",
    ]) {
      expect(progress).toContain(`| ${finding} | Done |`);
    }

    expect(backlog).toContain("## Execution status - 2026-05-13");
    expect(backlog).toContain("Wave 1: completed");
    expect(backlog).toContain("Wave 2: completed");
    expect(backlog).toContain("Do not treat the original wave list as pending");

    expect(nextWave).toContain("## Current status - 2026-05-13");
    expect(nextWave).toContain("Wave 1 and Wave 2 are already completed");
    expect(nextWave).toContain("Do not restart the first-wave checklist");
    expect(nextWave).toContain("Dedicated lanes only");
  });
});
