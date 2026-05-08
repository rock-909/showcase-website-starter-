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
        name: "vite",
        current: "7.3.2",
        latest: "8.0.11",
        dependencyType: "devDependencies",
      },
      {
        name: "some-new-package",
        current: "1.0.0",
        latest: "1.0.1",
        dependencyType: "devDependencies",
      },
      {
        name: "another-new-package",
        current: "2.0.0",
        latest: "2.0.1",
        dependencyType: "dependencies",
      },
    ];

    const result = partitionDependencyUpdates(candidates);

    expect(result.heldUpdates.map((item) => item.name)).toEqual([
      "@types/node",
      "vite",
    ]);
    expect(result.actionableUpdates).toEqual([candidates[2], candidates[3]]);
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
      {
        name: "@types/node",
        current: "24.12.2",
        latest: "25.6.2",
        dependencyType: "devDependencies",
      },
      {
        name: "vite",
        current: "7.3.2",
        latest: "8.0.11",
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
        name: "eslint-plugin-react-you-might-not-need-an-effect",
        current: "0.10.1",
        latest: "0.10.2",
        dependencyType: "devDependencies",
      },
    ];

    expect(canTreatOutdatedResultAsReviewed(result, candidates)).toBe(false);
  });
});
