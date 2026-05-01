const heldDependencyUpdates = [
  {
    name: "@types/node",
    status: "runtime-baseline-held",
    rationale:
      "The project engine is >=24 <25, so Node 25 types would describe APIs outside the supported runtime range.",
  },
];

export const HELD_DEPENDENCY_UPDATES = heldDependencyUpdates;

const heldDependencyUpdateByName = new Map(
  heldDependencyUpdates.map((item) => [item.name, item]),
);

export function getHeldDependencyUpdate(pkg) {
  if (pkg?.vulnerability) {
    return null;
  }

  return heldDependencyUpdateByName.get(pkg?.name) ?? null;
}

export function partitionDependencyUpdates(packages) {
  const actionableUpdates = [];
  const heldUpdates = [];

  for (const pkg of packages) {
    const hold = getHeldDependencyUpdate(pkg);
    if (hold) {
      heldUpdates.push({
        ...pkg,
        hold,
      });
      continue;
    }

    actionableUpdates.push(pkg);
  }

  return {
    actionableUpdates,
    heldUpdates,
  };
}

export function canTreatOutdatedResultAsReviewed(result, parsedPackages) {
  if (result.ok) {
    return true;
  }

  if (parsedPackages.length === 0) {
    return false;
  }

  const { actionableUpdates } = partitionDependencyUpdates(parsedPackages);
  return actionableUpdates.length === 0;
}
