import { spawn } from "child_process";
import { createHash } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { dirname } from "path";
import { pathToFileURL } from "url";

export type InlineScript = {
  attrs: string;
  body: string;
};

type ScriptClassification = {
  category: string;
  count: number;
};

type ScriptSample = {
  category: string;
  attrs: string;
  sha256: string;
  preview: string;
};

const NON_EXECUTABLE_SCRIPT_TYPES = new Set([
  "application/json",
  "application/ld+json",
  "application/manifest+json",
  "application/schema+json",
  "text/plain",
]);

function extractInlineScripts(html: string): InlineScript[] {
  const scripts: InlineScript[] = [];
  const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const attrs = (match[1] ?? "").trim();
    if (/(^|\s)src=/.test(attrs)) continue;
    scripts.push({ attrs, body: match[2] ?? "" });
  }
  return scripts;
}

function hasNonceAttr(attrs: string): boolean {
  return /(^|\s)nonce=/.test(attrs);
}

function extractNonceAttr(attrs: string): string | null {
  const match = attrs.match(/(?:^|\s)nonce=(?:"([^"]+)"|'([^']+)'|([^\s>]+))/);
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? null;
}

export function extractScriptTypeAttr(attrs: string): string | null {
  const match = attrs.match(
    /(?:^|\s)type\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i,
  );
  const scriptType = match?.[1] ?? match?.[2] ?? match?.[3];
  return scriptType ? scriptType.toLowerCase() : null;
}

export function hasExecutableScriptType(script: InlineScript): boolean {
  const type = extractScriptTypeAttr(script.attrs);
  if (!type) return true;
  if (type === "module") return true;
  if (type.includes("javascript") || type.includes("ecmascript")) return true;

  // Known data-block scripts, such as JSON-LD, are not the reason an
  // element-level inline execution exception is needed.
  return !NON_EXECUTABLE_SCRIPT_TYPES.has(type);
}

async function waitForReady(url: string, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { redirect: "manual" });
      if (res.status >= 200 && res.status < 500) return;
    } catch {
      // ignore
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Server not ready after ${timeoutMs}ms: ${url}`);
}

function parseCspNonce(csp: string): string | null {
  const m = csp.match(/'nonce-([^']+)'/);
  return m?.[1] ?? null;
}

function parseCspDirectives(csp: string): Map<string, Set<string>> {
  const directives = new Map<string, Set<string>>();
  for (const part of csp.split(";")) {
    const tokens = part.trim().split(/\s+/).filter(Boolean);
    const [name, ...values] = tokens;
    if (name) {
      directives.set(name, new Set(values));
    }
  }
  return directives;
}

type ParsedDirectives = Map<string, Set<string>>;

function getScriptSrcNonces(directives: ParsedDirectives): Set<string> {
  const scriptSrc = directives.get("script-src");
  const nonces = new Set<string>();

  for (const value of scriptSrc ?? []) {
    const match = value.match(/^'nonce-([^']+)'$/);
    if (match?.[1]) {
      nonces.add(match[1]);
    }
  }

  return nonces;
}

function allowsUnnoncedInlineScriptElements(
  directives: ParsedDirectives,
): boolean {
  return directives.get("script-src-elem")?.has("'unsafe-inline'") ?? false;
}

function assertScriptPolicyMatchesRuntime(
  directives: ParsedDirectives,
  scripts: InlineScript[],
  url: string,
): void {
  const scriptSrc = directives.get("script-src");

  if (!scriptSrc) {
    throw new Error(`Missing script-src directive for ${url}`);
  }

  if (scriptSrc.has("'unsafe-inline'")) {
    throw new Error(`script-src must not contain 'unsafe-inline' for ${url}`);
  }

  const unnoncedInlineScripts = getUnnoncedExecutableInlineScripts(scripts);
  const allowsUnsafeInlineElements =
    allowsUnnoncedInlineScriptElements(directives);

  if (unnoncedInlineScripts.length > 0 && !allowsUnsafeInlineElements) {
    throw new Error(
      [
        `Unnonced inline script elements exist for ${url}.`,
        "script-src-elem must explicitly allow 'unsafe-inline' unless these scripts receive a valid nonce.",
      ].join("\n"),
    );
  }

  if (unnoncedInlineScripts.length === 0 && allowsUnsafeInlineElements) {
    throw new Error(
      [
        `script-src-elem allows 'unsafe-inline' for ${url}, but no unnonced inline scripts were found.`,
        "The CSP exception is no longer proven necessary for this route.",
      ].join("\n"),
    );
  }
}

function getUnnoncedInlineScripts(scripts: InlineScript[]): InlineScript[] {
  return scripts.filter(
    (script) => !hasNonceAttr(script.attrs) && script.body.trim().length > 0,
  );
}

function getUnnoncedExecutableInlineScripts(
  scripts: InlineScript[],
): InlineScript[] {
  return getUnnoncedInlineScripts(scripts).filter(hasExecutableScriptType);
}

function getUnnoncedNonExecutableInlineScripts(
  scripts: InlineScript[],
): InlineScript[] {
  return getUnnoncedInlineScripts(scripts).filter(
    (script) => !hasExecutableScriptType(script),
  );
}

function assertScriptNonceConsistency(
  directives: ParsedDirectives,
  scripts: InlineScript[],
): void {
  const cspNonces = getScriptSrcNonces(directives);
  if (cspNonces.size === 0) {
    throw new Error("script-src must contain at least one nonce source");
  }

  const noncedInlineScripts = scripts.filter((script) =>
    hasNonceAttr(script.attrs),
  );
  const unnoncedInlineScripts = getUnnoncedExecutableInlineScripts(scripts);

  for (const script of noncedInlineScripts) {
    const nonce = extractNonceAttr(script.attrs);
    if (!nonce || !cspNonces.has(nonce)) {
      throw new Error(
        `Inline script nonce "${nonce ?? "<missing>"}" does not match CSP`,
      );
    }
  }

  if (
    unnoncedInlineScripts.length > 0 &&
    !allowsUnnoncedInlineScriptElements(directives)
  ) {
    throw new Error(
      "Unnonced inline scripts require script-src-elem 'unsafe-inline'",
    );
  }
}

async function fetchHtml(
  url: string,
): Promise<{ html: string; csp: string; status: number }> {
  const res = await fetch(url, { redirect: "follow" });
  const html = await res.text();
  const csp =
    res.headers.get("content-security-policy") ??
    res.headers.get("Content-Security-Policy") ??
    "";
  if (!csp) {
    throw new Error(`Missing Content-Security-Policy header for ${url}`);
  }
  return { html, csp, status: res.status };
}

export function classifyInlineScript(script: InlineScript): string {
  const attrs = script.attrs.toLowerCase();
  const body = script.body.trim();

  if (extractScriptTypeAttr(script.attrs) === "application/ld+json") {
    return "project-json-ld";
  }

  if (
    body.startsWith("self.__next_f.push(") ||
    body.startsWith("(self.__next_f=self.__next_f||[]).push(")
  ) {
    return "next-rsc-flight-payload";
  }

  if (
    body.includes("document.documentElement") &&
    body.includes("localStorage.getItem")
  ) {
    return "next-themes-init";
  }

  if (
    body.includes("__next_set_public_path__") ||
    body.includes("__next_require__") ||
    body.includes("__next_chunk_load__")
  ) {
    return "next-runtime-bootstrap";
  }

  if (body.includes("__next_s") || attrs.includes("data-nscript")) {
    return "next-script-loader";
  }

  if (body.includes("webpack") || body.includes("__webpack_require__")) {
    return "next-webpack-runtime";
  }

  return "unknown-inline-script";
}

function createScriptFingerprint(body: string): string {
  return createHash("sha256").update(body).digest("base64");
}

function createPreview(body: string): string {
  return body.trim().replace(/\s+/gu, " ").slice(0, 120);
}

function summarizeClassifications(
  scripts: InlineScript[],
): ScriptClassification[] {
  const counts = new Map<string, number>();

  for (const script of scripts) {
    const category = classifyInlineScript(script);
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(
      ([category, count]) =>
        ({ category, count }) satisfies ScriptClassification,
    )
    .sort((a, b) =>
      a.category === b.category ? 0 : a.category < b.category ? -1 : 1,
    );
}

function collectSamples(scripts: InlineScript[]): ScriptSample[] {
  const firstByCategory = new Map<string, InlineScript>();

  for (const script of scripts) {
    const category = classifyInlineScript(script);
    if (!firstByCategory.has(category)) {
      firstByCategory.set(category, script);
    }
  }

  return Array.from(firstByCategory.entries())
    .map(
      ([category, script]) =>
        ({
          category,
          attrs: script.attrs || "<none>",
          sha256: createScriptFingerprint(script.body),
          preview: createPreview(script.body),
        }) satisfies ScriptSample,
    )
    .sort((a, b) =>
      a.category === b.category ? 0 : a.category < b.category ? -1 : 1,
    );
}

function formatRouteProof(
  url: string,
  status: number,
  csp: string,
  scripts: InlineScript[],
  directives: ParsedDirectives,
): string[] {
  const scriptSrc = directives.get("script-src");
  const scriptSrcElem = directives.get("script-src-elem");
  const noncedInlineScripts = scripts.filter((s) => hasNonceAttr(s.attrs));
  const unnoncedInlineScripts = getUnnoncedInlineScripts(scripts);
  const unnoncedExecutableInlineScripts =
    getUnnoncedExecutableInlineScripts(scripts);
  const unnoncedNonExecutableInlineScripts =
    getUnnoncedNonExecutableInlineScripts(scripts);
  const cspNonce = parseCspNonce(csp);
  const lines = [
    `route=${url}`,
    `status=${status}`,
    `csp=present`,
    `script-src nonce=${cspNonce ? "present" : "missing"} unsafe-inline=${String(scriptSrc?.has("'unsafe-inline'") ?? false)}`,
    `script-src-elem unsafe-inline=${String(scriptSrcElem?.has("'unsafe-inline'") ?? false)}`,
    `inline total=${scripts.length} nonced=${noncedInlineScripts.length} unnonced=${unnoncedInlineScripts.length} unnonced-executable=${unnoncedExecutableInlineScripts.length} unnonced-non-executable=${unnoncedNonExecutableInlineScripts.length}`,
    "unnonced executable categories:",
  ];

  for (const item of summarizeClassifications(
    unnoncedExecutableInlineScripts,
  )) {
    lines.push(`  - ${item.category}: ${item.count}`);
  }

  lines.push("unnonced executable samples:");
  for (const sample of collectSamples(unnoncedExecutableInlineScripts)) {
    lines.push(
      `  - category=${sample.category} sha256=${sample.sha256} attrs=${JSON.stringify(sample.attrs)} preview=${JSON.stringify(sample.preview)}`,
    );
  }

  lines.push("unnonced non-executable categories:");
  for (const item of summarizeClassifications(
    unnoncedNonExecutableInlineScripts,
  )) {
    lines.push(`  - ${item.category}: ${item.count}`);
  }

  lines.push("unnonced non-executable samples:");
  for (const sample of collectSamples(unnoncedNonExecutableInlineScripts)) {
    lines.push(
      `  - category=${sample.category} sha256=${sample.sha256} attrs=${JSON.stringify(sample.attrs)} preview=${JSON.stringify(sample.preview)}`,
    );
  }

  const result =
    unnoncedExecutableInlineScripts.length > 0
      ? "pass: unnonced executable inline script elements exist and are covered by script-src-elem 'unsafe-inline'; script-src itself remains nonce-scoped."
      : "pass: no unnonced executable inline script elements were found, so no element-level inline exception is required.";
  lines.push(`result=${result}`);

  return lines;
}

async function writeProofArtifact(lines: string[]): Promise<void> {
  const outputPath = process.env.CSP_CHECK_OUTPUT_PATH;
  if (!outputPath) return;

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${lines.join("\n")}\n`, "utf8");
}

async function run(): Promise<void> {
  const port = process.env.CSP_CHECK_PORT ?? "3210";
  const baseUrl = `http://localhost:${port}`;
  const serverLogs: string[] = [];

  const child = spawn("pnpm", ["start"], {
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      PORT: port,
      SECURITY_HEADERS_ENABLED: "true",
      NEXT_PUBLIC_SECURITY_MODE: "strict",
    },
  });

  child.stdout?.on("data", (chunk: Buffer) => {
    serverLogs.push(chunk.toString());
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    serverLogs.push(chunk.toString());
  });

  const shutdown = async () => {
    if (child.exitCode !== null) return;
    child.kill("SIGTERM");
    await new Promise((r) => setTimeout(r, 500));
    if (child.exitCode === null) child.kill("SIGKILL");
  };

  try {
    await waitForReady(`${baseUrl}/en`, 30_000);

    const proofLines = [
      "CSP inline script runtime proof",
      `generatedAt=${new Date().toISOString()}`,
      `baseUrl=${baseUrl}`,
      "",
    ];
    const urls = [`${baseUrl}/en`, `${baseUrl}/zh`];
    for (const url of urls) {
      const { html, csp, status } = await fetchHtml(url);
      const nonce = parseCspNonce(csp);
      if (!nonce) {
        throw new Error(`CSP nonce not found for ${url}`);
      }
      const directives = parseCspDirectives(csp);

      const scripts = extractInlineScripts(html);
      assertScriptPolicyMatchesRuntime(directives, scripts, url);
      assertScriptNonceConsistency(directives, scripts);
      const noncedInlineScripts = scripts.filter((s) => hasNonceAttr(s.attrs));
      const unnoncedInlineScripts = getUnnoncedExecutableInlineScripts(scripts);

      if (scripts.length === 0) {
        throw new Error(`No inline scripts found for ${url}`);
      }

      if (
        noncedInlineScripts.length === 0 &&
        unnoncedInlineScripts.length === 0
      ) {
        throw new Error(
          `Inline script extraction returned no executable bodies for ${url}`,
        );
      }

      proofLines.push(
        ...formatRouteProof(url, status, csp, scripts, directives),
        "",
      );
    }

    proofLines.push(
      "overall=pass: runtime HTML still contains unnonced executable inline script elements while script-src remains nonce-scoped.",
    );
    console.log(proofLines.join("\n"));
    await writeProofArtifact(proofLines);
  } catch (error) {
    if (serverLogs.length > 0) {
      console.error("next start output before failure:");
      console.error(serverLogs.join(""));
    }
    throw error;
  } finally {
    await shutdown();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  run().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
