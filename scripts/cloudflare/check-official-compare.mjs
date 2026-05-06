#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { getPhase6ApiSourceRoutes } from "./phase6-topology-contract.mjs";

const ROOT = process.cwd();
const PHASE6_CONFIG_DIR = path.join(ROOT, ".open-next", "wrangler", "phase6");
const SOURCE_ONLY = process.argv.includes("--source-only");
const GENERATED_ONLY = process.argv.includes("--generated-only");
const REQUIRE_GENERATED_CONFIG =
  GENERATED_ONLY ||
  process.argv.includes("--require-generated") ||
  !SOURCE_ONLY;

if (SOURCE_ONLY && GENERATED_ONLY) {
  console.error(
    "cf-official-compare: use either --source-only or --generated-only, not both.",
  );
  process.exit(1);
}

if (SOURCE_ONLY && process.argv.includes("--require-generated")) {
  console.error(
    "cf-official-compare: --source-only cannot be combined with --require-generated.",
  );
  process.exit(1);
}

const generatedConfigForbiddenSnippets = [
  '"WORKER_SELF_REFERENCE"',
  '"NEXT_INC_CACHE_R2_BUCKET"',
  '"NEXT_TAG_CACHE_D1"',
  '"NEXT_CACHE_DO_QUEUE"',
  '"durable_objects"',
  '"r2_buckets"',
  '"d1_databases"',
  '"migrations"',
];

const checks = [
  {
    file: "open-next.config.ts",
    label:
      "OpenNext config stays anchored to the Cloudflare adapter and lead split",
    requiredSnippets: [
      "defineCloudflareConfig",
      "getPhase6ApiSourceRoutes",
      "getPhase6ApiPathnames",
      "apiLead",
    ],
    forbiddenSnippets: [
      "r2IncrementalCache",
      "doQueue",
      "d1NextTagCache",
      { match: "apiOps", type: "quoted" },
      "/api/cache/invalidate",
    ],
  },
  {
    file: "wrangler.jsonc",
    label: "Wrangler config keeps the static-generation Cloudflare baseline",
    requiredSnippets: ['".open-next/worker.js"', '"ASSETS"'],
    forbiddenSnippets: [
      '"WORKER_SELF_REFERENCE"',
      '"NEXT_INC_CACHE_R2_BUCKET"',
      '"NEXT_TAG_CACHE_D1"',
      '"NEXT_CACHE_DO_QUEUE"',
      '"durable_objects"',
      '"r2_buckets"',
      '"d1_databases"',
      '"migrations"',
    ],
  },
];

const packageJson = JSON.parse(read("package.json"));
const scripts = packageJson.scripts ?? {};

const deployScriptChecks = [
  {
    name: "deploy:cf",
    expected: "node scripts/cloudflare/deploy.mjs --env production",
  },
  {
    name: "deploy:cf:preview",
    expected: "node scripts/cloudflare/deploy.mjs --env preview",
  },
  {
    name: "deploy:cf:dry-run",
    expected: "node scripts/cloudflare/deploy.mjs --env preview --dry-run",
  },
  {
    name: "preview:cf:wrangler",
    expected:
      "node scripts/cloudflare/legacy-entrypoint-guard.mjs preview:cf:wrangler",
  },
];

const destructiveDeployScriptSnippets = [
  "wrangler delete",
  "deleted_classes",
  "new_sqlite_classes",
];

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function normalizeForbiddenCheck(snippet) {
  if (typeof snippet === "string") {
    return { match: snippet, type: "substring" };
  }

  return snippet;
}

function hasForbiddenContent(content, snippet) {
  const check = normalizeForbiddenCheck(snippet);

  if (check.type === "quoted") {
    return (
      content.includes(`"${check.match}"`) ||
      content.includes(`'${check.match}'`)
    );
  }

  if (check.type === "regex") {
    return check.match.test(content);
  }

  return content.includes(check.match);
}

function findForbiddenSnippets(content, snippets) {
  return snippets.filter((snippet) => hasForbiddenContent(content, snippet));
}

function formatForbiddenSnippet(snippet) {
  const check = normalizeForbiddenCheck(snippet);
  return check.type === "regex" ? check.match.toString() : check.match;
}

function getDeclaredSplitRoutes() {
  return getPhase6ApiSourceRoutes("apiLead");
}

const failures = [];

if (!GENERATED_ONLY) {
  for (const check of checks) {
    const content = read(check.file);
    const missing = check.requiredSnippets.filter(
      (snippet) => !content.includes(snippet),
    );
    const forbidden = findForbiddenSnippets(content, check.forbiddenSnippets);

    if (missing.length > 0 || forbidden.length > 0) {
      failures.push({
        file: check.file,
        label: check.label,
        missing,
        forbidden,
      });
    }
  }

  for (const route of getDeclaredSplitRoutes()) {
    const sourcePath = path.join(ROOT, "src", `${route}.ts`);
    if (!fs.existsSync(sourcePath)) {
      failures.push({
        file: "open-next.config.ts",
        label: "split function route must resolve to a real source file",
        missing: [route],
        forbidden: [],
      });
    }
  }

  for (const check of deployScriptChecks) {
    const script = scripts[check.name];
    const matches = script === check.expected;

    if (!matches) {
      failures.push({
        file: "package.json",
        label: "stable Cloudflare deploy entrypoints must use the deploy wrapper",
        missing: [`${check.name}: ${check.expected}`],
        forbidden: [],
      });
    }

    if (typeof script === "string") {
      const forbidden = findForbiddenSnippets(script, [
        ...destructiveDeployScriptSnippets,
        "&&",
        "||",
        ";",
      ]);

      if (forbidden.length > 0) {
        failures.push({
          file: "package.json",
          label:
            "Cloudflare deploy aliases must stay exact and must not chain destructive actions",
          missing: [],
          forbidden,
        });
      }
    }
  }

  for (const [name, script] of Object.entries(scripts)) {
    if (
      !["deploy:cf", "deploy:cf:preview", "deploy:cf:dry-run"].includes(name) ||
      typeof script !== "string"
    ) {
      continue;
    }

    const forbidden = findForbiddenSnippets(
      script,
      destructiveDeployScriptSnippets,
    );

    if (forbidden.length > 0) {
      failures.push({
        file: "package.json",
        label:
          "Cloudflare deploy scripts must not include destructive actions",
        missing: [],
        forbidden,
      });
    }
  }
}

if (!SOURCE_ONLY) {
  if (fs.existsSync(PHASE6_CONFIG_DIR)) {
    const phase6ConfigFiles = fs
      .readdirSync(PHASE6_CONFIG_DIR)
      .filter((fileName) => fileName.endsWith(".jsonc"));

    if (phase6ConfigFiles.length === 0 && REQUIRE_GENERATED_CONFIG) {
      failures.push({
        file: path.relative(ROOT, PHASE6_CONFIG_DIR),
        label: "phase6 generated deploy config must exist for strict compare",
        missing: ["run pnpm deploy:cf:dry-run before strict compare"],
        forbidden: [],
      });
    } else if (phase6ConfigFiles.length === 0) {
      console.warn(
        "cf-official-compare: phase6 generated config directory is empty; run with --require-generated after pnpm deploy:cf:dry-run for deploy-artifact proof.",
      );
    }

    for (const fileName of phase6ConfigFiles) {
      const relPath = path.join(".open-next", "wrangler", "phase6", fileName);
      const content = read(relPath);
      const forbidden = findForbiddenSnippets(
        content,
        generatedConfigForbiddenSnippets,
      );

      if (forbidden.length > 0) {
        failures.push({
          file: relPath,
          label:
            "phase6 generated deploy config must not reintroduce runtime cache bindings",
          missing: [],
          forbidden,
        });
      }
    }
  } else if (REQUIRE_GENERATED_CONFIG) {
    failures.push({
      file: path.relative(ROOT, PHASE6_CONFIG_DIR),
      label: "phase6 generated deploy config must exist for strict compare",
      missing: ["run pnpm deploy:cf:dry-run before strict compare"],
      forbidden: [],
    });
  } else {
    console.warn(
      "cf-official-compare: phase6 generated config absent; run with --require-generated after pnpm deploy:cf:dry-run for deploy-artifact proof.",
    );
  }
}

if (failures.length > 0) {
  console.error("cf-official-compare: failed");
  for (const failure of failures) {
    console.error(`- ${failure.file}: ${failure.label}`);
    for (const snippet of failure.missing) {
      console.error(`  - missing snippet: ${snippet}`);
    }
    for (const snippet of failure.forbidden) {
      console.error(
        `  - forbidden snippet still present: ${formatForbiddenSnippet(snippet)}`,
      );
    }
  }
  process.exit(1);
}

console.log("cf-official-compare: passed");
if (GENERATED_ONLY) {
  console.log("Verified phase6 generated deploy configs.");
} else if (SOURCE_ONLY) {
  console.log(
    "Verified static-generation Cloudflare source baseline against open-next.config.ts, wrangler.jsonc, and package deploy aliases.",
  );
} else {
  console.log(
    "Verified static-generation Cloudflare source baseline and phase6 generated deploy configs.",
  );
}
