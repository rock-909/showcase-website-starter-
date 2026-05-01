import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();
const OUTPUT_PATH = path.join(
  ROOT_DIR,
  "reports",
  "deploy",
  "cloudflare-preview-proof.json",
);
const DEPLOY_COMMAND = ["deploy:cf:phase6:preview"];
const URL_PATTERN = new RegExp("https://[^\\s\\\"']+\\.workers\\.dev", "gi");
const DEPLOY_URL_PATTERN = new RegExp(
  "^\\[phase6\\] deployed-url (?<worker>\\S+) (?<url>https://[^\\s]+)$",
  "gm",
);

function runPnpm(scriptArgs) {
  return spawnSync("pnpm", scriptArgs, {
    cwd: ROOT_DIR,
    stdio: "pipe",
    encoding: "utf8",
    env: process.env,
  });
}

function extractDeploymentUrls(output) {
  const urls = [];
  for (const match of output.matchAll(DEPLOY_URL_PATTERN)) {
    urls.push({
      worker: match.groups?.worker ?? "unknown",
      url: match.groups?.url ?? "",
    });
  }
  if (urls.length > 0) return urls;

  return [...new Set(output.match(URL_PATTERN) ?? [])].map((url) => ({
    worker: "unknown",
    url,
  }));
}

function chooseGatewayUrl(urls) {
  const explicitGateway = urls.find((item) => item.worker === "gateway");
  if (explicitGateway) return explicitGateway.url;
  return urls.at(-1)?.url ?? null;
}

function writeResult(result) {
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2));
}

function printCapturedOutput(label, result) {
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  console.log(
    `[proof:cf:preview-deployed] ${label} exit=${result.status ?? 1}`,
  );
}

function main() {
  const deployResult = runPnpm(DEPLOY_COMMAND);
  const deployOutput = `${deployResult.stdout ?? ""}\n${deployResult.stderr ?? ""}`;
  printCapturedOutput("deploy", deployResult);

  if (/MISSING_MESSAGE/i.test(deployOutput)) {
    const result = {
      status: "fail",
      stage: "deploy-log",
      generatedAt: new Date().toISOString(),
      command: `pnpm ${DEPLOY_COMMAND.join(" ")}`,
      reason: "next-intl MISSING_MESSAGE detected during preview proof",
    };
    writeResult(result);
    console.log(JSON.stringify(result, null, 2));
    process.exit(1);
  }

  if (deployResult.status !== 0) {
    const result = {
      status: "blocked",
      stage: "deploy",
      generatedAt: new Date().toISOString(),
      command: `pnpm ${DEPLOY_COMMAND.join(" ")}`,
      reason: "preview deploy failed or credentials are unavailable",
    };
    writeResult(result);
    console.log(JSON.stringify(result, null, 2));
    process.exit(2);
  }

  const urls = extractDeploymentUrls(deployOutput);
  const baseUrl = chooseGatewayUrl(urls);

  if (!baseUrl) {
    const result = {
      status: "blocked",
      stage: "deploy-output-parse",
      generatedAt: new Date().toISOString(),
      command: `pnpm ${DEPLOY_COMMAND.join(" ")}`,
      reason:
        "preview deploy completed but no workers.dev URL was found in output",
      discoveredUrls: urls,
    };
    writeResult(result);
    console.log(JSON.stringify(result, null, 2));
    process.exit(2);
  }

  const smokeArgs = ["smoke:cf:deploy", "--", "--base-url", baseUrl];
  const smokeResult = runPnpm(smokeArgs);
  printCapturedOutput("smoke", smokeResult);

  const result = {
    status: smokeResult.status === 0 ? "pass" : "fail",
    stage: smokeResult.status === 0 ? "complete" : "smoke",
    generatedAt: new Date().toISOString(),
    baseUrl,
    discoveredUrls: urls,
    deployCommand: `pnpm ${DEPLOY_COMMAND.join(" ")}`,
    smokeCommand: `pnpm ${smokeArgs.join(" ")}`,
  };
  writeResult(result);
  console.log(JSON.stringify(result, null, 2));

  if (smokeResult.status !== 0) {
    process.exit(smokeResult.status ?? 1);
  }
}

main();
