const PHASE6_WORKER_CATALOG = [
  {
    key: "gateway",
    suffix: "gateway",
    kind: "gateway",
    deployOrder: 40,
    includeInServerActionsKeySync: true,
    patchPrefetchManifest: false,
  },
  {
    key: "web",
    suffix: "web",
    kind: "web",
    deployOrder: 10,
    includeInServerActionsKeySync: true,
    patchPrefetchManifest: false,
  },
  {
    key: "apiLead",
    suffix: "api-lead",
    kind: "api",
    binding: "WORKER_API_LEAD",
    deployOrder: 20,
    includeInServerActionsKeySync: true,
    patchPrefetchManifest: true,
  },
];

const PHASE6_WORKERS_BY_KEY = Object.freeze(
  Object.fromEntries(
    PHASE6_WORKER_CATALOG.map((worker) => [worker.key, worker]),
  ),
);

const PHASE6_API_WORKERS = Object.freeze(
  PHASE6_WORKER_CATALOG.filter((worker) => worker.kind === "api"),
);

const PHASE6_API_ROUTE_RULES = Object.freeze([
  {
    sourceRoute: "app/api/inquiry/route",
    pathname: "/api/inquiry",
    workerKey: "apiLead",
  },
  {
    sourceRoute: "app/api/subscribe/route",
    pathname: "/api/subscribe",
    workerKey: "apiLead",
  },
  {
    sourceRoute: "app/api/verify-turnstile/route",
    pathname: "/api/verify-turnstile",
    workerKey: "apiLead",
  },
  {
    sourceRoute: "app/api/health/route",
    pathname: "/api/health",
    workerKey: "apiLead",
  },
]);

function getPhase6WorkerDescriptor(workerKey) {
  const worker = PHASE6_WORKERS_BY_KEY[workerKey];
  if (!worker) {
    throw new Error(`[phase6-topology] unknown worker key: ${workerKey}`);
  }
  return worker;
}

function getPhase6WorkerName(baseWorkerName, workerKey) {
  return `${baseWorkerName}-${getPhase6WorkerDescriptor(workerKey).suffix}`;
}

function getPhase6WorkerNames(baseWorkerName) {
  return Object.fromEntries(
    PHASE6_WORKER_CATALOG.map((worker) => [
      worker.key,
      getPhase6WorkerName(baseWorkerName, worker.key),
    ]),
  );
}

function getPhase6ConfigFileName(workerKey) {
  return `${getPhase6WorkerDescriptor(workerKey).suffix}.jsonc`;
}

function getPhase6DeploymentOrder() {
  return [...PHASE6_WORKER_CATALOG]
    .sort((left, right) => left.deployOrder - right.deployOrder)
    .map((worker) => getPhase6ConfigFileName(worker.key));
}

function getPhase6ServerActionsKeyWorkerNames(baseWorkerName) {
  return PHASE6_WORKER_CATALOG.filter(
    (worker) => worker.includeInServerActionsKeySync,
  ).map((worker) => getPhase6WorkerName(baseWorkerName, worker.key));
}

function getPhase6PatchPrefetchWorkerKeys() {
  return PHASE6_WORKER_CATALOG.filter(
    (worker) => worker.patchPrefetchManifest,
  ).map((worker) => worker.key);
}

function getPhase6ApiRouteRules(workerKey) {
  const rules = workerKey
    ? PHASE6_API_ROUTE_RULES.filter((rule) => rule.workerKey === workerKey)
    : PHASE6_API_ROUTE_RULES;

  return rules.map((rule) => ({ ...rule }));
}

function getPhase6ApiSourceRoutes(workerKey) {
  return getPhase6ApiRouteRules(workerKey).map((rule) => rule.sourceRoute);
}

function getPhase6ApiPathnames(workerKey) {
  return getPhase6ApiRouteRules(workerKey).map((rule) => rule.pathname);
}

export {
  PHASE6_API_ROUTE_RULES,
  PHASE6_API_WORKERS,
  PHASE6_WORKER_CATALOG,
  PHASE6_WORKERS_BY_KEY,
  getPhase6ApiPathnames,
  getPhase6ApiRouteRules,
  getPhase6ApiSourceRoutes,
  getPhase6ConfigFileName,
  getPhase6DeploymentOrder,
  getPhase6PatchPrefetchWorkerKeys,
  getPhase6WorkerDescriptor,
  getPhase6WorkerName,
  getPhase6WorkerNames,
  getPhase6ServerActionsKeyWorkerNames,
};
