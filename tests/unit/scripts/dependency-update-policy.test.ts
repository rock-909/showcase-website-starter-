import { describe, expect, it } from "vitest";

import {
  canTreatOutdatedResultAsReviewed,
  getHeldDependencyUpdate,
  partitionDependencyUpdates,
} from "../../../scripts/dependency-update-policy.mjs";

interface UpdateCandidate {
  name: string;
  current: string;
  latest: string;
  dependencyType: string;
  vulnerability?: {
    severity: string;
  };
}

describe("dependency update policy", () => {
  it("keeps reviewed hold packages out of actionable updates", () => {
    const candidates: UpdateCandidate[] = [
      {
        name: "@types/node",
        current: "22.19.17",
        latest: "25.6.0",
        dependencyType: "devDependencies",
      },
      {
        name: "some-new-package",
        current: "1.0.0",
        latest: "1.0.1",
        dependencyType: "dependencies",
      },
    ];

    const result = partitionDependencyUpdates(candidates);

    expect(result.heldUpdates).toHaveLength(1);
    expect(result.heldUpdates[0]?.name).toBe("@types/node");
    expect(result.actionableUpdates).toEqual([candidates[1]]);
  });

  it("does not suppress a held package when it has a vulnerability", () => {
    const candidate: UpdateCandidate = {
      name: "@types/node",
      current: "22.19.17",
      latest: "25.6.0",
      dependencyType: "devDependencies",
      vulnerability: {
        severity: "high",
      },
    };

    expect(getHeldDependencyUpdate(candidate)).toBeNull();
    expect(partitionDependencyUpdates([candidate]).actionableUpdates).toEqual([
      candidate,
    ]);
  });

  it("treats a non-zero outdated exit as reviewed when all updates are held", () => {
    const result = {
      ok: false,
    };
    const candidates: UpdateCandidate[] = [
      {
        name: "@types/node",
        current: "22.19.17",
        latest: "25.6.0",
        dependencyType: "devDependencies",
      },
    ];

    expect(canTreatOutdatedResultAsReviewed(result, candidates)).toBe(true);
  });

  it("keeps a non-zero outdated exit failing when an actionable update remains", () => {
    const result = {
      ok: false,
    };
    const candidates: UpdateCandidate[] = [
      {
        name: "some-new-package",
        current: "1.0.0",
        latest: "1.0.1",
        dependencyType: "dependencies",
      },
    ];

    expect(canTreatOutdatedResultAsReviewed(result, candidates)).toBe(false);
  });
});
