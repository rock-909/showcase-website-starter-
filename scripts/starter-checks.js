#!/usr/bin/env node

const { execSync, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const {
  access,
  lstat,
  mkdir,
  readFile,
  rename,
  symlink,
  writeFile,
} = require("node:fs/promises");
const path = require("node:path");
const { parse } = require("@babel/parser");
const matter = require("gray-matter");
const { config: loadDotenv } = require("dotenv");
const yaml = require("js-yaml");
const ts = require("typescript");
const {
  buildKey,
  collectPairs,
  parseContentSlugArgs,
  parseFrontmatter,
  runContentSlugCheck,
  validateContentFrontmatterContract,
  validateCollectionPair,
  validateMdxSlugSync,
} = require("./quality/checks/content-slugs");

const ROOT = process.cwd();

function ensureTypeScriptRequireRuntime() {
  if (require.extensions[".ts"]) return;
  if (process.env.VITEST === "true" || process.env.VITEST_WORKER_ID) return;
  require("tsx/cjs");
}

function isVitestRuntime() {
  return process.env.VITEST === "true" || Boolean(process.env.VITEST_WORKER_ID);
}

function loadContactFormConfigModule() {
  if (isVitestRuntime()) {
    return {
      CONTACT_FORM_CONFIG: {
        features: {
          enableTurnstile: true,
        },
      },
    };
  }

  ensureTypeScriptRequireRuntime();
  return require("../src/config/contact-form-config");
}

function loadPublicTrustModule() {
  if (isVitestRuntime()) {
    return {
      getPublicContactPhone: (phone) =>
        phone && !/(?:^|[-\s])0{3,}(?:[-\s]|$)/u.test(phone)
          ? phone.trim()
          : undefined,
      getPublicLogoPath: (logo) =>
        logo?.status === "ready" ? logo.horizontal : undefined,
    };
  }

  ensureTypeScriptRequireRuntime();
  return require("../src/config/public-trust");
}

function loadSingleSiteModule() {
  if (isVitestRuntime()) {
    const config = {
      baseUrl: "https://example.com",
      name: "Showcase Website Starter",
      description:
        "Public demo starter for launching a showcase website foundation",
      seo: {
        titleTemplate: "%s | Showcase Website Starter",
        defaultTitle: "Showcase Website Starter - Public Demo Starter Site",
        defaultDescription:
          "A public demo starter site for teams that need a deployable showcase website foundation before they have a real website.",
      },
      social: {
        twitter: "https://x.com/example",
        linkedin: "https://www.linkedin.com/company/example",
      },
      contact: {
        phone: "+86-518-0000-0000",
        email: "starter-contact@example.com",
      },
    };

    return {
      SINGLE_SITE_DEFINITION: { config },
      SINGLE_SITE_FACTS: {
        company: {
          name: "Showcase Website Starter",
          location: {
            city: "Replace before launch",
            address: "Replace before launch",
          },
        },
        contact: config.contact,
        brandAssets: {
          logo: {
            status: "pending",
          },
          productPhotos: {
            status: "pending",
          },
        },
      },
    };
  }

  ensureTypeScriptRequireRuntime();
  return require("../src/config/single-site");
}

function loadSiteConfigValidatorModule() {
  if (isVitestRuntime()) {
    return {
      validateSiteConfig: () => ({
        valid: true,
        warnings: [],
        errors: [],
      }),
    };
  }

  ensureTypeScriptRequireRuntime();
  return require("../src/config/paths/site-config");
}

function parseJsoncText(filePath, content) {
  const parsed = ts.parseConfigFileTextToJson(filePath, content);
  if (parsed.error) {
    throw new Error(
      ts.flattenDiagnosticMessageText(parsed.error.messageText, "\n"),
    );
  }
  return parsed.config;
}

// ---------------------------------------------------------------------------
// brand
// ---------------------------------------------------------------------------

const BRAND_SCAN_ROOTS = [
  "README.md",
  "AGENTS.md",
  "CLAUDE.md",
  "CLAUDE.local.md",
  "PRODUCT.md",
  "DESIGN.md",
  "HANDOFF.md",
  "package.json",
  "src",
  "content",
  "messages",
  "public",
  "tests",
  "scripts",
  "docs",
];
const BRAND_SOURCE_EXTENSIONS = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mdx",
  ".mjs",
  ".svg",
  ".ts",
  ".tsx",
  ".txt",
  ".yml",
  ".yaml",
]);
const COMMON_EXCLUDED_DIRS = new Set([
  ".git",
  ".next",
  ".open-next",
  ".wrangler",
  "coverage",
  "node_modules",
  "reports",
  "storybook-static",
]);
const FORBIDDEN_BRAND_MARKERS = [
  "Tianze",
  "天泽",
  "tianze-pipe",
  "Lianyungang Tianze",
  "TIANZE-DESIGN",
  "b2b-web-template",
  "PVC conduit",
  "PETG pneumatic",
];
const SELF_PATH = "scripts/starter-checks.js";

function toRepoPath(rootDir, absolutePath) {
  return path.relative(rootDir, absolutePath).split(path.sep).join("/");
}

function isBrandSourceFile(filePath) {
  return BRAND_SOURCE_EXTENSIONS.has(path.extname(filePath));
}

function collectBrandFiles(targetPath, results = []) {
  if (!fs.existsSync(targetPath)) return results;

  const stats = fs
    .readdirSync(path.dirname(targetPath), { withFileTypes: true })
    .find((entry) => entry.name === path.basename(targetPath));

  if (stats?.isFile()) {
    if (isBrandSourceFile(targetPath)) results.push(targetPath);
    return results;
  }

  for (const entry of fs.readdirSync(targetPath, { withFileTypes: true })) {
    if (COMMON_EXCLUDED_DIRS.has(entry.name)) continue;

    const absolutePath = path.join(targetPath, entry.name);
    if (entry.isDirectory()) {
      collectBrandFiles(absolutePath, results);
      continue;
    }

    if (entry.isFile() && isBrandSourceFile(absolutePath)) {
      results.push(absolutePath);
    }
  }

  return results;
}

function getLineNumber(content, index) {
  return content.slice(0, index).split("\n").length;
}

function scanBrandFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  if (toRepoPath(ROOT, filePath) === SELF_PATH) return [];

  const findings = [];
  for (const marker of FORBIDDEN_BRAND_MARKERS) {
    const haystack =
      marker === marker.toLowerCase() ? content.toLowerCase() : content;
    const needle =
      marker === marker.toLowerCase() ? marker.toLowerCase() : marker;
    let searchIndex = 0;

    while (true) {
      const index = haystack.indexOf(needle, searchIndex);
      if (index === -1) break;
      findings.push({
        file: toRepoPath(ROOT, filePath),
        line: getLineNumber(content, index),
        marker,
      });
      searchIndex = index + needle.length;
    }
  }

  return findings;
}

function runBrandCheck() {
  const files = BRAND_SCAN_ROOTS.flatMap((scanRoot) =>
    collectBrandFiles(path.join(ROOT, scanRoot)),
  );
  const findings = files.flatMap(scanBrandFile);

  if (findings.length === 0) {
    console.log("brand:check passed");
    return true;
  }

  console.error("brand:check failed: old project brand markers remain");
  for (const finding of findings) {
    console.error(
      `- ${finding.file}:${finding.line} forbidden marker "${finding.marker}"`,
    );
  }
  return false;
}

// ---------------------------------------------------------------------------
// translations
// ---------------------------------------------------------------------------

const I18N_LOCALES = require("../i18n-locales.config").locales;
const MESSAGES_DIR = path.join(ROOT, "messages");

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function collectLeafPaths(obj, prefix = "") {
  const paths = [];

  if (!isPlainObject(obj)) return paths;

  for (const [key, value] of Object.entries(obj)) {
    const currentPath = prefix ? `${prefix}.${key}` : key;
    if (isPlainObject(value)) {
      paths.push(...collectLeafPaths(value, currentPath));
    } else {
      paths.push(currentPath);
    }
  }

  return paths;
}

function getLocaleSplitPaths(locale) {
  return {
    critical: path.join(MESSAGES_DIR, locale, "critical.json"),
    deferred: path.join(MESSAGES_DIR, locale, "deferred.json"),
  };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function validateLocale(locale) {
  console.log(`\nValidating split canonical locale: ${locale}`);

  const { critical: criticalPath, deferred: deferredPath } =
    getLocaleSplitPaths(locale);

  if (!fs.existsSync(criticalPath)) {
    console.error(`   Error: critical.json not found: ${criticalPath}`);
    return false;
  }

  if (!fs.existsSync(deferredPath)) {
    console.error(`   Error: deferred.json not found: ${deferredPath}`);
    return false;
  }

  const critical = readJson(criticalPath);
  const deferred = readJson(deferredPath);
  const criticalKeys = collectLeafPaths(critical);
  const deferredKeys = collectLeafPaths(deferred);
  const criticalSet = new Set(criticalKeys);
  const deferredSet = new Set(deferredKeys);

  console.log(`   Critical keys: ${criticalKeys.length}`);
  console.log(`   Deferred keys: ${deferredKeys.length}`);
  console.log(`   Total keys: ${criticalKeys.length + deferredKeys.length}`);

  const deferredDuplicates = criticalKeys.filter((key) => deferredSet.has(key));
  if (deferredDuplicates.length > 0) {
    console.error(
      `   Error: Found ${deferredDuplicates.length} duplicate keys:`,
    );
    deferredDuplicates
      .slice(0, 10)
      .forEach((key) => console.error(`      - ${key}`));
    return false;
  }

  console.log("   No duplicate keys found");

  return {
    locale,
    criticalKeys: criticalSet,
    deferredKeys: deferredSet,
    totalKeys: criticalKeys.length + deferredKeys.length,
  };
}

function compareLocales(localeData) {
  console.log("\nComparing locales...");
  const locales = Object.keys(localeData);
  if (locales.length < 2) {
    console.log("   Only one locale found, skipping comparison");
    return true;
  }

  const [firstLocale, ...otherLocales] = locales;
  const firstData = localeData[firstLocale];
  let allMatch = true;

  for (const locale of otherLocales) {
    const data = localeData[locale];

    if (data.totalKeys !== firstData.totalKeys) {
      console.error(
        `   Error: ${locale} has ${data.totalKeys} keys, but ${firstLocale} has ${firstData.totalKeys} keys`,
      );
      allMatch = false;
      continue;
    }

    const allKeys = new Set([...data.criticalKeys, ...data.deferredKeys]);
    const firstAllKeys = new Set([
      ...firstData.criticalKeys,
      ...firstData.deferredKeys,
    ]);
    const missingInLocale = [...firstAllKeys].filter(
      (key) => !allKeys.has(key),
    );
    const extraInLocale = [...allKeys].filter((key) => !firstAllKeys.has(key));

    if (missingInLocale.length > 0) {
      console.error(
        `   Error: ${locale} is missing ${missingInLocale.length} keys:`,
      );
      missingInLocale
        .slice(0, 5)
        .forEach((key) => console.error(`      - ${key}`));
      allMatch = false;
    }

    if (extraInLocale.length > 0) {
      console.error(
        `   Error: ${locale} has ${extraInLocale.length} extra keys:`,
      );
      extraInLocale
        .slice(0, 5)
        .forEach((key) => console.error(`      - ${key}`));
      allMatch = false;
    }

    if (missingInLocale.length === 0 && extraInLocale.length === 0) {
      console.log(`   ${locale} matches ${firstLocale}`);
    }
  }

  return allMatch;
}

function runTranslationCheck() {
  console.log("Translation Validation (split canonical)");
  console.log("========================================");

  const localeData = {};
  let allValid = true;

  for (const locale of I18N_LOCALES) {
    const result = validateLocale(locale);
    if (!result) {
      allValid = false;
    } else {
      localeData[locale] = result;
    }
  }

  if (!allValid) {
    console.error("\nValidation failed.\n");
    return false;
  }

  if (!compareLocales(localeData)) {
    console.error("\nLocales do not match.\n");
    return false;
  }

  console.log("\nAll validations passed.");
  for (const [locale, data] of Object.entries(localeData)) {
    console.log(
      `${locale.toUpperCase()}: ${data.totalKeys} total keys (${data.criticalKeys.size} critical + ${data.deferredKeys.size} deferred)`,
    );
  }

  return true;
}

// ---------------------------------------------------------------------------
// content manifest
// ---------------------------------------------------------------------------

const CONTENT_DIR = path.join(ROOT, "content");
const CONTENT_MANIFEST_OUTPUT = path.join(
  ROOT,
  "reports",
  "content-manifest.json",
);
const CONTENT_IMPORTERS_OUTPUT = path.join(
  ROOT,
  "src",
  "lib",
  "mdx-importers.generated.ts",
);
const CONTENT_MANIFEST_TS_OUTPUT = path.join(
  ROOT,
  "src",
  "lib",
  "content-manifest.generated.ts",
);
const CONTENT_TYPES = ["posts", "pages", "products"];
const CONTENT_MANIFEST_LOCALES = ["en", "zh"];
const VALID_CONTENT_EXTENSIONS = new Set([".mdx", ".md"]);

function scanContentManifestDirectory(contentType, locale) {
  const dirPath = path.join(CONTENT_DIR, contentType, locale);
  const entries = [];

  if (!fs.existsSync(dirPath)) {
    return entries;
  }

  const files = fs.readdirSync(dirPath).sort();

  for (const file of files) {
    const ext = path.extname(file);
    if (!VALID_CONTENT_EXTENSIONS.has(ext)) {
      continue;
    }

    const slug = path.basename(file, ext);
    const filePath = path.join(dirPath, file);
    const fileContent = fs.readFileSync(filePath, "utf8");
    const { data: metadata, content } = matter(fileContent, {
      engines: {
        yaml: (source) => yaml.load(source),
      },
    });
    const relativePath = path
      .relative(ROOT, filePath)
      .split(path.sep)
      .join("/");
    const stableFilePath = `/${relativePath}`;

    entries.push({
      type: contentType,
      locale,
      slug,
      extension: ext,
      filePath: stableFilePath,
      relativePath,
      metadata,
      content,
    });
  }

  return entries;
}

function buildContentManifestKey(type, locale, slug) {
  return `${type}/${locale}/${slug}`;
}

function generateContentManifest() {
  const entries = [];

  for (const contentType of CONTENT_TYPES) {
    for (const locale of CONTENT_MANIFEST_LOCALES) {
      entries.push(...scanContentManifestDirectory(contentType, locale));
    }
  }

  const byKey = {};
  for (const entry of entries) {
    const key = buildContentManifestKey(entry.type, entry.locale, entry.slug);
    if (byKey[key]) {
      throw new Error(
        `Duplicate slug "${key}": found in both "${byKey[key].filePath}" and "${entry.filePath}"`,
      );
    }
    byKey[key] = entry;
  }

  return {
    entries,
    byKey,
  };
}

function ensureOutputDir(outputPath) {
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
}

function generateImportersCode(entries) {
  const entriesByType = new Map();

  for (const entry of entries) {
    let typeMap = entriesByType.get(entry.type);
    if (typeMap === undefined) {
      typeMap = new Map();
      entriesByType.set(entry.type, typeMap);
    }
    let localeEntries = typeMap.get(entry.locale);
    if (localeEntries === undefined) {
      localeEntries = [];
      typeMap.set(entry.locale, localeEntries);
    }
    localeEntries.push(entry);
  }

  const lines = [
    "/**",
    " * AUTO-GENERATED FILE - DO NOT EDIT",
    " *",
    " * Generated by: node scripts/starter-checks.js content-manifest",
    " *",
    " * This file provides static import maps for MDX content.",
    " * To update, add/remove/rename content files and re-run the generator.",
    " */",
    "",
    "import type { ComponentType } from 'react';",
    "",
    "export interface MDXContentModule {",
    "  default: ComponentType;",
    "  frontmatter?: Record<string, unknown>;",
    "}",
    "",
    "type ContentImporter = () => Promise<MDXContentModule>;",
    "",
  ];

  const typeToExportName = {
    posts: "postImporters",
    pages: "pageImporters",
    products: "productImporters",
  };

  for (const contentType of CONTENT_TYPES) {
    const typeMap = entriesByType.get(contentType);
    const exportName = typeToExportName[contentType];

    lines.push(
      `export const ${exportName}: Record<string, Record<string, ContentImporter>> = {`,
    );

    for (const locale of CONTENT_MANIFEST_LOCALES) {
      const localeEntries = typeMap?.get(locale) ?? [];
      lines.push(`  ${locale}: {`);

      for (const entry of localeEntries) {
        const importPath = `@content/${contentType}/${locale}/${entry.slug}${entry.extension}`;
        lines.push(`    '${entry.slug}': () => import('${importPath}'),`);
      }

      lines.push("  },");
    }

    lines.push("};");
    lines.push("");
  }

  return lines.join("\n");
}

function generateManifestTsCode(manifest) {
  const entriesJson = JSON.stringify(manifest.entries, null, 2);
  const entryIndexes = new Map(
    manifest.entries.map((entry, index) => [entry, index]),
  );
  const byKeyIndex = {};

  for (const [key, entry] of Object.entries(manifest.byKey)) {
    byKeyIndex[key] = entryIndexes.get(entry);
  }

  const byKeyIndexJson = JSON.stringify(byKeyIndex, null, 2);

  return `/**
 * AUTO-GENERATED FILE - DO NOT EDIT
 *
 * Generated by: node scripts/starter-checks.js content-manifest
 *
 * This file provides statically bundled content manifest data.
 * No runtime fs dependency - works in dev and production builds.
 */

import type { ContentType, Locale } from '@/types/content.types';

export interface ContentEntry {
  type: ContentType;
  locale: Locale;
  slug: string;
  extension: string;
  filePath: string;
  relativePath: string;
  metadata: Record<string, unknown>;
  content: string;
}

export interface ContentManifest {
  entries: ContentEntry[];
  byKey: Record<string, ContentEntry>;
}

const _entries: ContentEntry[] = ${entriesJson};

const _byKeyIndex: Record<string, number> = ${byKeyIndexJson};

const _byKey: Record<string, ContentEntry> = Object.fromEntries(
  Object.entries(_byKeyIndex).map(([key, idx]) => [key, _entries[idx]!]),
);

export const CONTENT_MANIFEST: ContentManifest = {
  entries: _entries,
  byKey: _byKey,
} as const;
`;
}

function runContentManifestGenerator() {
  console.log("Generating content manifest and import map...");

  const manifest = generateContentManifest();

  ensureOutputDir(CONTENT_MANIFEST_OUTPUT);
  fs.writeFileSync(CONTENT_MANIFEST_OUTPUT, JSON.stringify(manifest, null, 2));

  ensureOutputDir(CONTENT_IMPORTERS_OUTPUT);
  fs.writeFileSync(
    CONTENT_IMPORTERS_OUTPUT,
    generateImportersCode(manifest.entries),
  );

  ensureOutputDir(CONTENT_MANIFEST_TS_OUTPUT);
  fs.writeFileSync(
    CONTENT_MANIFEST_TS_OUTPUT,
    generateManifestTsCode(manifest),
  );

  console.log(`Generated manifest with ${manifest.entries.length} entries`);
  console.log(`Output 1: ${CONTENT_MANIFEST_OUTPUT}`);
  console.log(`Output 2: ${CONTENT_IMPORTERS_OUTPUT}`);
  console.log(`Output 3: ${CONTENT_MANIFEST_TS_OUTPUT}`);

  const summary = {};
  for (const entry of manifest.entries) {
    const key = `${entry.type}/${entry.locale}`;
    summary[key] = (summary[key] ?? 0) + 1;
  }

  console.log("\nSummary:");
  for (const [key, count] of Object.entries(summary)) {
    console.log(`  ${key}: ${count} files`);
  }

  return true;
}

// ---------------------------------------------------------------------------
// production config
// ---------------------------------------------------------------------------

const MIN_SECRET_LENGTH = 32;

function readEnv(env, key) {
  const value = env[key];
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function hasPair(env, firstKey, secondKey) {
  return Boolean(readEnv(env, firstKey) && readEnv(env, secondKey));
}

function hasAny(env, ...keys) {
  return keys.some((key) => Boolean(readEnv(env, key)));
}

function isTrue(env, key) {
  return readEnv(env, key) === "true";
}

function containsStarterMarker(value) {
  if (!value) return true;

  return /Example Showcase Company|Showcase Website Starter|example\.com|localhost|127\.0\.0\.1|sales@example\.com|starter-contact@example\.com|showcase website example|showcase website starter|public demo starter|replaceable showcase website example|Public Demo Starter Site|Example Business Park|Example City|Replace before launch|x\.com\/example|linkedin\.com\/company\/example/iu.test(
    value,
  );
}

function validateNoStarterMarker(target, markerPath, value, reason) {
  if (containsStarterMarker(value)) {
    target.push(`${markerPath} is not public-launch ready (${reason}).`);
  }
}

function validateLaunchSignoff(target, env, key, surface, reason) {
  if (!isTrue(env, key)) {
    target.push(
      `${key} must be true after owner review of ${surface} (${reason}).`,
    );
  }
}

function validateRequiredEnv(target, env, key, reason) {
  if (!readEnv(env, key)) {
    target.push(`${key} is required (${reason}).`);
  }
}

function validateMinLengthEnv(target, env, key, minLength, reason) {
  const value = readEnv(env, key);
  if (!value) {
    target.push(`${key} is required (${reason}).`);
  } else if (value.length < minLength) {
    target.push(
      `${key} must be at least ${minLength} characters long (${reason}). Current length: ${value.length}`,
    );
  }
}

function shouldValidateProductionRuntimeContract(env) {
  const appEnv = readEnv(env, "APP_ENV")?.toLowerCase();

  if (appEnv === "preview") {
    return false;
  }

  if (appEnv === "production") {
    return true;
  }

  const nodeEnv = readEnv(env, "NODE_ENV")?.toLowerCase();
  const isProduction = nodeEnv === "production";
  const isCloudflareProduction =
    isProduction &&
    hasAny(env, "CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN");

  return isProduction || isCloudflareProduction;
}

function validateProductionRuntimeContract(env) {
  const warnings = [];
  const errors = [];
  const { CONTACT_FORM_CONFIG } = loadContactFormConfigModule();
  const hasUpstash = hasPair(
    env,
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
  );
  const hasKv = hasPair(env, "KV_REST_API_URL", "KV_REST_API_TOKEN");

  if (!hasUpstash && !hasKv) {
    errors.push(
      "Production rate limiting requires Upstash Redis. Configure UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.",
    );
  } else if (!hasUpstash && hasKv) {
    errors.push(
      "KV-only rate limiting is not allowed in production. Configure Upstash Redis for the shared security stores or remove the KV-only setup.",
    );
  }

  validateMinLengthEnv(
    errors,
    env,
    "RATE_LIMIT_PEPPER",
    MIN_SECRET_LENGTH,
    "production rate-limit keys rely on it and runtime already throws when it is missing or weak",
  );
  validateMinLengthEnv(
    errors,
    env,
    "NEXT_SERVER_ACTIONS_ENCRYPTION_KEY",
    MIN_SECRET_LENGTH,
    "Server Actions deployment requires a stable encryption key",
  );

  if (CONTACT_FORM_CONFIG.features.enableTurnstile) {
    validateRequiredEnv(
      errors,
      env,
      "TURNSTILE_SECRET_KEY",
      "Contact form verification depends on server-side Turnstile validation",
    );
    validateRequiredEnv(
      errors,
      env,
      "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
      "the live Contact form widget depends on a public Turnstile site key",
    );
  }

  validateRequiredEnv(
    errors,
    env,
    "RESEND_API_KEY",
    "the shipped lead pipeline sends admin notification email through Resend",
  );
  validateRequiredEnv(
    errors,
    env,
    "AIRTABLE_API_KEY",
    "the shipped lead pipeline persists lead records in Airtable",
  );
  validateRequiredEnv(
    errors,
    env,
    "AIRTABLE_BASE_ID",
    "the shipped lead pipeline persists lead records in Airtable",
  );

  if (hasAny(env, "ALLOW_MEMORY_RATE_LIMIT")) {
    errors.push(
      "Degraded in-memory rate-limit store flag (ALLOW_MEMORY_RATE_LIMIT) cannot be used in production. Configure a durable Redis-compatible store for production deployments.",
    );
  }

  return { warnings, errors };
}

function validatePublicLaunchTrustContent(env) {
  const warnings = [];
  const errors = [];
  const { getPublicContactPhone, getPublicLogoPath } = loadPublicTrustModule();
  const { SINGLE_SITE_DEFINITION, SINGLE_SITE_FACTS } = loadSingleSiteModule();
  const target = isTrue(env, "PUBLIC_LAUNCH_STRICT") ? errors : warnings;
  const shouldCheck =
    isTrue(env, "PUBLIC_LAUNCH_STRICT") ||
    isTrue(env, "VALIDATE_PUBLIC_LAUNCH_CONTENT");

  if (!shouldCheck) {
    return { warnings, errors };
  }

  validateNoStarterMarker(
    target,
    "SITE_CONFIG.name",
    SINGLE_SITE_DEFINITION.config.name,
    "replace the starter company identity before client launch",
  );
  validateNoStarterMarker(
    target,
    "SITE_CONFIG.baseUrl",
    SINGLE_SITE_DEFINITION.config.baseUrl,
    "configure the real public domain before client launch",
  );
  validateNoStarterMarker(
    target,
    "SITE_CONFIG.contact.email",
    SINGLE_SITE_DEFINITION.config.contact.email,
    "replace the starter contact email before client launch",
  );
  validateNoStarterMarker(
    target,
    "SITE_CONFIG.seo.defaultTitle",
    SINGLE_SITE_DEFINITION.config.seo.defaultTitle,
    "replace starter SEO title defaults before client launch",
  );
  validateNoStarterMarker(
    target,
    "SITE_CONFIG.seo.defaultDescription",
    SINGLE_SITE_DEFINITION.config.seo.defaultDescription,
    "replace starter SEO description defaults before client launch",
  );
  validateNoStarterMarker(
    target,
    "SITE_CONFIG.social.twitter",
    SINGLE_SITE_DEFINITION.config.social.twitter,
    "replace the starter social profile before client launch",
  );
  validateNoStarterMarker(
    target,
    "SITE_CONFIG.social.linkedin",
    SINGLE_SITE_DEFINITION.config.social.linkedin,
    "replace the starter social profile before client launch",
  );
  validateNoStarterMarker(
    target,
    "SITE_CONFIG.seo.titleTemplate",
    SINGLE_SITE_DEFINITION.config.seo.titleTemplate,
    "replace the starter SEO title template before client launch",
  );
  validateNoStarterMarker(
    target,
    "SITE_CONFIG.description",
    SINGLE_SITE_DEFINITION.config.description,
    "replace the starter company description before client launch",
  );
  validateNoStarterMarker(
    target,
    "SITE_CONFIG.facts.company.name",
    SINGLE_SITE_FACTS.company.name,
    "replace the starter legal/company name before client launch",
  );
  validateNoStarterMarker(
    target,
    "SITE_CONFIG.facts.company.location",
    `${SINGLE_SITE_FACTS.company.location.city} ${SINGLE_SITE_FACTS.company.location.address ?? ""}`,
    "replace starter city/address before client launch",
  );
  validateLaunchSignoff(
    target,
    env,
    "PUBLIC_LAUNCH_LEGAL_CONTENT_REVIEWED",
    "content/pages/{locale}/{about,contact,privacy,terms}.mdx",
    "confirm legal/contact page truth before client launch",
  );
  validateRequiredEnv(
    target,
    env,
    "CLOUDFLARE_ANALYTICS_HOSTNAME",
    "the owner traffic dashboard must point at the public hostname before client launch",
  );
  validateRequiredEnv(
    target,
    env,
    "CLOUDFLARE_ZONE_ID",
    "the owner traffic dashboard needs the real Cloudflare zone before client launch",
  );
  validateRequiredEnv(
    target,
    env,
    "OPS_DASHBOARD_ACCESS_KEY",
    "the owner traffic dashboard must be protected before client launch",
  );

  if (!getPublicContactPhone(SINGLE_SITE_FACTS.contact.phone)) {
    target.push(
      "SITE_CONFIG.contact.phone is not public-launch ready. Hide it from runtime now and replace it with the owner-confirmed public phone before launch.",
    );
  }

  if (!getPublicLogoPath(SINGLE_SITE_FACTS.brandAssets.logo)) {
    target.push(
      "brandAssets.logo.status is pending. Header falls back to text-only now; owner-confirmed logo files must be supplied before launch.",
    );
  }

  if (SINGLE_SITE_FACTS.brandAssets.productPhotos.status !== "ready") {
    target.push(
      "brandAssets.productPhotos.status is pending. Neutral product illustrations are allowed for preview, but owner-confirmed product photos must be supplied before launch.",
    );
  }

  return { warnings, errors };
}

function validateProductionConfig(env = process.env) {
  const { validateSiteConfig } = loadSiteConfigValidatorModule();
  const siteConfig = validateSiteConfig();
  const runtimeContractChecked = shouldValidateProductionRuntimeContract(env);
  const runtimeContract = runtimeContractChecked
    ? validateProductionRuntimeContract(env)
    : { warnings: [], errors: [] };
  const publicLaunchTrust = validatePublicLaunchTrustContent(env);

  return {
    warnings: [
      ...siteConfig.warnings,
      ...runtimeContract.warnings,
      ...publicLaunchTrust.warnings,
    ],
    errors: [
      ...siteConfig.errors,
      ...runtimeContract.errors,
      ...publicLaunchTrust.errors,
    ],
    runtimeContractChecked,
  };
}

function runValidateProductionConfigCli() {
  const report = validateProductionConfig(process.env);

  if (report.warnings.length > 0) {
    console.warn("Warnings:");
    for (const warning of report.warnings) {
      console.warn(`  - ${warning}`);
    }
  }

  if (report.errors.length > 0) {
    console.error("Errors:");
    for (const error of report.errors) {
      console.error(`  - ${error}`);
    }
    return false;
  }

  console.log("Production configuration validated successfully.");
  if (report.runtimeContractChecked) {
    console.log("Runtime contract enforced.");
  }
  return true;
}

// ---------------------------------------------------------------------------
// eslint-disable guard
// ---------------------------------------------------------------------------

const GUARDRAIL_REGISTER_PATH = "docs/guides/GUARDRAIL-SIDE-EFFECTS.md";
const GUARDRAIL_EXCEPTION_PATTERN =
  /\bguardrail-exception\s+(GSE-\d{8}-[a-z0-9-]+):\s*(\S.+)$/i;
const ACTIVE_GUARDRAIL_EXCEPTION_HEADING =
  /^## Active production structural exceptions\s*$/im;
const CONFIG_FILE_PATTERN = /(?:^|\/)[^/]+\.config\.(?:js|ts|mjs|mts)$/i;
const STRUCTURAL_GUARDRAIL_RULES = new Set([
  "complexity",
  "max-depth",
  "max-lines",
  "max-lines-per-function",
  "max-nested-callbacks",
  "max-params",
  "max-statements",
]);

function getRepoFiles() {
  try {
    const output = execSync(
      "git ls-files --cached --others --exclude-standard",
      {
        encoding: "utf8",
        cwd: ROOT,
        stdio: ["ignore", "pipe", "ignore"],
      },
    );
    return output.split("\n").flatMap((line) => {
      const trimmed = line.trim();
      return trimmed ? [trimmed] : [];
    });
  } catch (error) {
    console.error("[eslint-disable-check] Failed to list git files:", error);
    process.exit(1);
  }
}

function isLintSourceFile(filePath) {
  if (
    !(
      filePath.startsWith("src/") ||
      filePath.startsWith("tests/") ||
      filePath.startsWith("scripts/")
    )
  ) {
    return false;
  }

  return [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"].includes(
    path.extname(filePath),
  );
}

function isTestFile(filePath) {
  if (filePath.startsWith("tests/")) return true;
  if (filePath.startsWith("src/test/")) return true;
  if (filePath.includes("/__tests__/")) return true;
  if (/\.(test|spec)\.(ts|tsx|js|jsx)$/.test(filePath)) return true;
  if (filePath.startsWith("src/types/test-")) return true;
  if (filePath.startsWith("src/constants/test-")) return true;

  return false;
}

function isStructuralGuardrailExemptPath(filePath) {
  if (CONFIG_FILE_PATTERN.test(filePath)) return true;
  if (filePath.startsWith("src/components/dev-tools/")) return true;
  if (/^src\/app\/.+\/dev-tools\//.test(filePath)) return true;

  return false;
}

function isProductionFile(filePath) {
  if (!filePath.startsWith("src/")) return false;
  if (isTestFile(filePath)) return false;
  if (filePath.startsWith("src/scripts/")) return false;
  if (isStructuralGuardrailExemptPath(filePath)) return false;

  return true;
}

function isValidRuleName(rule) {
  return /^[@\w/-]+$/.test(rule);
}

function stripTrailingCommentEnd(text) {
  return text.replace(/\*\/\s*\}?$/, "").trim();
}

function getActiveGuardrailExceptionSection(registerContent) {
  const headingMatch = registerContent.match(
    ACTIVE_GUARDRAIL_EXCEPTION_HEADING,
  );
  if (!headingMatch || headingMatch.index === undefined) return "";

  const sectionStart = headingMatch.index + headingMatch[0].length;
  const sectionContent = registerContent.slice(sectionStart);
  const nextHeadingIndex = sectionContent.search(/^##\s+/m);

  return nextHeadingIndex === -1
    ? sectionContent
    : sectionContent.slice(0, nextHeadingIndex);
}

function collectRegisteredGuardrailExceptionIds(registerContent) {
  const ids = new Set();
  const activeSection = getActiveGuardrailExceptionSection(registerContent);
  if (activeSection.length === 0) return ids;

  const idPattern = /\|\s*(GSE-\d{8}-[a-z0-9-]+)\s*\|/gi;
  let match = idPattern.exec(activeSection);

  while (match) {
    ids.add(match[1].toLowerCase());
    match = idPattern.exec(activeSection);
  }

  return ids;
}

function readRegisteredGuardrailExceptionIds() {
  const registerPath = path.join(ROOT, GUARDRAIL_REGISTER_PATH);

  try {
    return collectRegisteredGuardrailExceptionIds(
      fs.readFileSync(registerPath, "utf8"),
    );
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return new Set();
    }
    throw error;
  }
}

function parseGuardrailException(reason) {
  const match = reason.match(GUARDRAIL_EXCEPTION_PATTERN);
  if (!match) return null;

  return {
    id: match[1].toLowerCase(),
    detail: match[2].trim(),
  };
}

function parseDisableDirective(line, directive) {
  const idx = line.indexOf(directive);
  if (idx === -1) return null;

  const rawRest = stripTrailingCommentEnd(line.slice(idx + directive.length));
  const rest = rawRest.trim();
  const reasonIdx = rest.indexOf("--");
  const rulesText = (reasonIdx === -1 ? rest : rest.slice(0, reasonIdx)).trim();
  const reason = (reasonIdx === -1 ? "" : rest.slice(reasonIdx + 2)).trim();
  const rules = rulesText.split(",").flatMap((rule) => {
    const trimmed = rule.trim();
    return trimmed ? [trimmed] : [];
  });

  return { rules, reason };
}

function analyzeSource(filePath, content, options = {}) {
  const registeredGuardrailExceptionIds =
    options.registeredGuardrailExceptionIds ?? new Set();
  const lines = content.split("\n");
  const findings = [];
  const testFile = isTestFile(filePath);
  const productionFile = isProductionFile(filePath);

  function extractDirectiveText(trimmed) {
    if (trimmed.startsWith("//")) return trimmed.slice(2).trim();
    if (trimmed.startsWith("/*")) return trimmed.slice(2).trim();
    if (trimmed.startsWith("*")) return trimmed.slice(1).trim();

    const jsxBlockIdx = trimmed.indexOf("{/*");
    if (jsxBlockIdx !== -1) {
      return trimmed.slice(jsxBlockIdx + 3).trim();
    }

    return null;
  }

  for (let i = 0; i < lines.length; i += 1) {
    const rawLine = lines[i] ?? "";
    if (!rawLine.includes("eslint-disable")) continue;
    if (rawLine.includes("eslint-enable")) continue;

    const trimmed = rawLine.trim();
    const directiveText = extractDirectiveText(trimmed);
    if (!directiveText) continue;

    const directiveMatch = directiveText.match(
      /^eslint-disable(?:-next-line|-line)?\b/,
    );
    if (!directiveMatch) continue;

    const directive = directiveMatch[0];
    const parsed = parseDisableDirective(directiveText, directive);
    if (!parsed) continue;

    const violations = [];
    if (parsed.rules.length === 0) {
      violations.push("missing explicit rule name");
    }

    for (const rule of parsed.rules) {
      if (!isValidRuleName(rule)) {
        violations.push(`invalid rule name: ${rule}`);
      }
    }

    if (productionFile && parsed.reason.length === 0) {
      violations.push("missing production-code reason");
    }

    const structuralRules = parsed.rules.filter((rule) =>
      STRUCTURAL_GUARDRAIL_RULES.has(rule),
    );
    if (
      structuralRules.length > 0 &&
      productionFile &&
      !testFile &&
      !isStructuralGuardrailExemptPath(filePath)
    ) {
      const exception = parseGuardrailException(parsed.reason);
      if (!exception) {
        violations.push(
          "missing guardrail exception id (use `-- guardrail-exception GSE-YYYYMMDD-short-slug: real boundary ...`)",
        );
      } else if (!registeredGuardrailExceptionIds.has(exception.id)) {
        violations.push(`unregistered guardrail exception id: ${exception.id}`);
      }
    }

    if (violations.length > 0) {
      findings.push({
        filePath,
        line: i + 1,
        directive,
        content: trimmed,
        violations,
      });
    }
  }

  return findings;
}

function analyzeFile(filePath, options = {}) {
  const absolute = path.join(ROOT, filePath);
  let content;
  try {
    content = fs.readFileSync(absolute, "utf8");
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }

  return analyzeSource(filePath, content, options);
}

function runEslintDisableCheck() {
  const files = getRepoFiles().filter(isLintSourceFile);
  const registeredGuardrailExceptionIds = readRegisteredGuardrailExceptionIds();
  const allFindings = [];

  for (const file of files) {
    allFindings.push(...analyzeFile(file, { registeredGuardrailExceptionIds }));
  }

  if (allFindings.length === 0) {
    console.log("[eslint-disable-check] OK (no violations)");
    return true;
  }

  console.log(`[eslint-disable-check] Violations: ${allFindings.length}\n`);
  for (const finding of allFindings) {
    console.log(
      `- ${finding.filePath}:${finding.line} ${finding.directive}: ${finding.violations.join(
        "; ",
      )}`,
    );
    console.log(`  ${finding.content}`);
  }

  return false;
}

// ---------------------------------------------------------------------------
// component governance
// ---------------------------------------------------------------------------

const COMPONENT_GOVERNANCE_REGISTRY_PATH =
  "src/components/component-governance.registry.json";
const COMPONENT_GOVERNANCE_COMPONENTS_ROOT = "src/components";
const COMPONENT_GOVERNANCE_APP_ROOT = "src/app";
const COMPONENT_GOVERNANCE_UI_ROOT = "src/components/ui";
const COMPONENT_GOVERNANCE_REQUIRED_STORY_VALUE = "required";
const COMPONENT_GOVERNANCE_SOURCE_FILE_PATTERN = /\.(?:ts|tsx|js|jsx)$/;
const COMPONENT_GOVERNANCE_UI_PRIMITIVE_FILE_PATTERN = /\.(?:tsx|jsx)$/;
const COMPONENT_GOVERNANCE_EXCLUDED_FILE_PATTERN =
  /(?:\.stories\.[^.]+|\.(?:test|spec)\.[^.]+|\/__tests__\/)/;
const COMPONENT_GOVERNANCE_RADIX_IMPORT_PATTERN = /from\s+["']@radix-ui\//;
const COMPONENT_GOVERNANCE_STATIC_THEME_COLORS_MODULE_PATTERN =
  "(?:@/config/static-theme-colors|(?:\\.\\.?/)+config/static-theme-colors)";
const COMPONENT_GOVERNANCE_STATIC_THEME_COLORS_IMPORT_PATTERN = new RegExp(
  `(?:from\\s+["']${COMPONENT_GOVERNANCE_STATIC_THEME_COLORS_MODULE_PATTERN}["']|import\\s*\\(\\s*["']${COMPONENT_GOVERNANCE_STATIC_THEME_COLORS_MODULE_PATTERN}["']\\s*\\)|require\\s*\\(\\s*["']${COMPONENT_GOVERNANCE_STATIC_THEME_COLORS_MODULE_PATTERN}["']\\s*\\))`,
);
const COMPONENT_GOVERNANCE_RAW_TAILWIND_PALETTE_CLASS_PATTERN =
  /(?:^|[\s"'`])(?:[a-z-]+:)*(?:bg|text|border|ring|outline|divide|from|via|to|stroke|fill)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}(?:\/\d{1,3})?(?=$|[\s"'`])/;

function toRelativePath(rootDir, filePath) {
  return path.relative(rootDir, filePath).replaceAll("\\", "/");
}

function exists(rootDir, relativePath) {
  return fs.existsSync(path.join(rootDir, relativePath));
}

function readText(rootDir, relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

function getPatternLineNumber(source, pattern) {
  const lines = source.split("\n");
  const index = lines.findIndex((line) => pattern.test(line));
  return index === -1 ? 1 : index + 1;
}

function walkFiles(rootDir, relativeRoot) {
  const absoluteRoot = path.join(rootDir, relativeRoot);
  if (!fs.existsSync(absoluteRoot)) return [];

  const files = [];
  const pending = [absoluteRoot];

  while (pending.length > 0) {
    const currentDir = pending.pop();
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const absolutePath = path.join(currentDir, entry.name);
      const relativePath = toRelativePath(rootDir, absolutePath);

      if (entry.isDirectory()) {
        if (entry.name === "__tests__") continue;
        pending.push(absolutePath);
        continue;
      }

      if (entry.isFile()) {
        files.push(relativePath);
      }
    }
  }

  return files.sort();
}

function getScannedSourceFiles(rootDir) {
  const files = [];

  for (const root of [
    COMPONENT_GOVERNANCE_COMPONENTS_ROOT,
    COMPONENT_GOVERNANCE_APP_ROOT,
  ]) {
    for (const file of walkFiles(rootDir, root)) {
      if (!COMPONENT_GOVERNANCE_SOURCE_FILE_PATTERN.test(file)) continue;
      if (COMPONENT_GOVERNANCE_EXCLUDED_FILE_PATTERN.test(file)) continue;
      files.push(file);
    }
  }

  return files;
}

function getUiPrimitiveNames(rootDir) {
  const primitiveNames = [];

  for (const file of walkFiles(rootDir, COMPONENT_GOVERNANCE_UI_ROOT)) {
    if (path.dirname(file) !== COMPONENT_GOVERNANCE_UI_ROOT) continue;
    if (!COMPONENT_GOVERNANCE_UI_PRIMITIVE_FILE_PATTERN.test(file)) continue;
    if (COMPONENT_GOVERNANCE_EXCLUDED_FILE_PATTERN.test(file)) continue;
    primitiveNames.push(
      path
        .basename(file)
        .replace(COMPONENT_GOVERNANCE_UI_PRIMITIVE_FILE_PATTERN, ""),
    );
  }

  return primitiveNames.sort();
}

function createFinding(file, kind, detail, line = 1) {
  return { file, line, kind, detail };
}

function readRegistry(rootDir, errors) {
  if (!exists(rootDir, COMPONENT_GOVERNANCE_REGISTRY_PATH)) {
    errors.push(
      createFinding(
        COMPONENT_GOVERNANCE_REGISTRY_PATH,
        "registry-missing",
        "Component governance registry is missing.",
      ),
    );
    return null;
  }

  try {
    return JSON.parse(readText(rootDir, COMPONENT_GOVERNANCE_REGISTRY_PATH));
  } catch (error) {
    errors.push(
      createFinding(
        COMPONENT_GOVERNANCE_REGISTRY_PATH,
        "registry-invalid-json",
        `Component governance registry is not valid JSON: ${error.message}`,
      ),
    );
    return null;
  }
}

function collectRegistryFindings(rootDir, registry, errors) {
  if (!registry || typeof registry !== "object") return;

  const components = registry.components;
  if (!components || typeof components !== "object") {
    errors.push(
      createFinding(
        COMPONENT_GOVERNANCE_REGISTRY_PATH,
        "registry-components-missing",
        "Registry must define a components object.",
      ),
    );
    return;
  }

  const primitiveNames = getUiPrimitiveNames(rootDir);
  const primitiveNameSet = new Set(primitiveNames);
  const registeredNames = Object.keys(components).sort();
  const registeredNameSet = new Set(registeredNames);

  for (const primitiveName of primitiveNames) {
    if (!registeredNameSet.has(primitiveName)) {
      errors.push(
        createFinding(
          `${COMPONENT_GOVERNANCE_UI_ROOT}/${primitiveName}.tsx`,
          "ui-primitive-missing-from-registry",
          `UI primitive "${primitiveName}" is missing from the governance registry.`,
        ),
      );
    }
  }

  for (const componentName of registeredNames) {
    const component = components[componentName];

    if (!primitiveNameSet.has(componentName)) {
      errors.push(
        createFinding(
          `${COMPONENT_GOVERNANCE_UI_ROOT}/${componentName}.tsx`,
          "registry-primitive-missing-source",
          `Registry lists "${componentName}", but the UI primitive file does not exist.`,
        ),
      );
    }

    if (
      !component ||
      typeof component !== "object" ||
      !Object.prototype.hasOwnProperty.call(component, "story")
    ) {
      errors.push(
        createFinding(
          COMPONENT_GOVERNANCE_REGISTRY_PATH,
          "registry-story-missing",
          `Registry item "${componentName}" must define story governance.`,
        ),
      );
      continue;
    }

    if (component.story !== COMPONENT_GOVERNANCE_REQUIRED_STORY_VALUE) {
      errors.push(
        createFinding(
          COMPONENT_GOVERNANCE_REGISTRY_PATH,
          "registry-story-invalid",
          `Registry item "${componentName}" story must be "required".`,
        ),
      );
      continue;
    }

    const storyPath = `${COMPONENT_GOVERNANCE_UI_ROOT}/${componentName}.stories.tsx`;
    if (!exists(rootDir, storyPath)) {
      errors.push(
        createFinding(
          storyPath,
          "required-story-missing",
          `Required story for UI primitive "${componentName}" is missing.`,
        ),
      );
    }
  }
}

function collectTextScanFindings(rootDir, errors) {
  for (const file of getScannedSourceFiles(rootDir)) {
    const source = readText(rootDir, file);

    if (
      !file.startsWith(`${COMPONENT_GOVERNANCE_UI_ROOT}/`) &&
      COMPONENT_GOVERNANCE_RADIX_IMPORT_PATTERN.test(source)
    ) {
      errors.push(
        createFinding(
          file,
          "radix-import-outside-ui",
          "Production UI must import Radix through src/components/ui wrappers.",
          getPatternLineNumber(
            source,
            COMPONENT_GOVERNANCE_RADIX_IMPORT_PATTERN,
          ),
        ),
      );
    }

    if (COMPONENT_GOVERNANCE_RAW_TAILWIND_PALETTE_CLASS_PATTERN.test(source)) {
      errors.push(
        createFinding(
          file,
          "raw-tailwind-palette-class",
          "Production UI must use design tokens instead of obvious raw Tailwind palette classes.",
          getPatternLineNumber(
            source,
            COMPONENT_GOVERNANCE_RAW_TAILWIND_PALETTE_CLASS_PATTERN,
          ),
        ),
      );
    }

    if (COMPONENT_GOVERNANCE_STATIC_THEME_COLORS_IMPORT_PATTERN.test(source)) {
      errors.push(
        createFinding(
          file,
          "static-theme-colors-browser-import",
          "Browser UI must not import static theme color config directly.",
          getPatternLineNumber(
            source,
            COMPONENT_GOVERNANCE_STATIC_THEME_COLORS_IMPORT_PATTERN,
          ),
        ),
      );
    }
  }
}

function collectComponentGovernanceFindings(rootDir = process.cwd()) {
  const errors = [];
  const warnings = [];
  const registry = readRegistry(rootDir, errors);

  collectRegistryFindings(rootDir, registry, errors);
  collectTextScanFindings(rootDir, errors);

  return {
    status: errors.length === 0 ? "passed" : "failed",
    errors,
    warnings,
  };
}

function runComponentGovernanceCli() {
  const payload = collectComponentGovernanceFindings(process.cwd());

  console.log(
    `[component-governance] ${payload.status}: ${payload.errors.length} error(s), ${payload.warnings.length} warning(s)`,
  );

  for (const error of payload.errors) {
    console.log(
      `- ERROR ${error.file}:${error.line} ${error.kind}: ${error.detail}`,
    );
  }

  for (const warning of payload.warnings) {
    console.log(
      `- WARN ${warning.file}:${warning.line} ${warning.kind}: ${warning.detail}`,
    );
  }

  if (payload.status === "failed") {
    return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// content readiness
// ---------------------------------------------------------------------------

const LOGO_REFERENCE = "/images/logo.svg";
const LOGO_ASSET_PATH = "public/images/logo.svg";
const MARKDOWN_LOGO_REFERENCE_PATTERN =
  /!?\[[^\]]*\]\(\s*<?\/images\/logo\.svg>?(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)/iu;
const ATTRIBUTE_LOGO_REFERENCE_PATTERN =
  /\b(?:href|src)\s*=\s*(?:"\/images\/logo\.svg"|'\/images\/logo\.svg'|\{\s*(?:"\/images\/logo\.svg"|'\/images\/logo\.svg'|`\/images\/logo\.svg`)\s*\})/iu;
const READINESS_SCAN_TARGETS = [
  {
    root: "content/pages",
    extensions: new Set([".md", ".mdx"]),
    scanTextRules: true,
  },
  {
    root: "messages",
    extensions: new Set([".json"]),
    allowedPathPattern: /^messages\/[^/]+\/(?:critical|deferred)\.json$/u,
    scanTextRules: true,
  },
  {
    root: "public/images",
    extensions: new Set([".svg"]),
    scanTextRules: false,
    scanPathRules: true,
  },
  {
    root: "src/config/website",
    extensions: new Set([".js", ".json", ".mjs", ".ts", ".tsx"]),
    scanTextRules: true,
  },
  {
    root: "src/constants/product-specs",
    extensions: new Set([".js", ".json", ".mjs", ".ts", ".tsx"]),
    scanTextRules: true,
  },
  {
    root: "src/config",
    extensions: new Set([".ts"]),
    allowedPathPattern:
      /^src\/config\/(?:single-site|single-site-seo|single-site-product-catalog)\.ts$/u,
    scanTextRules: true,
  },
];
const GENERATED_DIR_NAMES = new Set([
  ".git",
  ".next",
  ".open-next",
  ".wrangler",
  "coverage",
  "dist",
  "generated",
  "node_modules",
  "reports",
  "storybook-static",
]);
const EXCLUDED_FILE_PATTERN =
  /(?:^|\/)(?:__tests__|__mocks__)(?:\/|$)|\.(?:test|spec)\.[^.]+$/u;
const TEXT_RULES = [
  {
    ruleId: "fake-phone",
    severity: "error",
    pattern:
      /(?:\+?1[\s.-]?)?(?:\(?555\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b|\b123[\s.-]?456[\s.-]?7890\b/giu,
    message: "Fake phone marker is present in buyer-visible content.",
  },
  {
    ruleId: "sample-product",
    severity: "warning",
    pattern: /\bsample(?:[\s_-]+)product\b/giu,
    message:
      "Starter sample product text is still present. Replace it before launch.",
  },
  {
    ruleId: "replaceable-content",
    severity: "warning",
    pattern: /\breplaceable\b|\breplace with real\b/giu,
    message:
      "Replaceable starter catalog content is still present. Replace it before client launch.",
  },
  {
    ruleId: "example-standard",
    severity: "warning",
    pattern: /\bExample Standard [A-Z]\b/gu,
    message:
      "Example standard marker is still present in catalog truth. Replace it before client launch.",
  },
  {
    ruleId: "example-offer",
    severity: "warning",
    pattern:
      /\b(?:Primary|Secondary|Regional|Platform|Specialty) Offer Example\b/gu,
    message:
      "Example offer marker is still present in catalog truth. Replace it before client launch.",
  },
  {
    ruleId: "replace-this-image",
    severity: "warning",
    pattern: /\breplace this image\b/giu,
    message:
      "Image replacement placeholder is still present. Replace it before launch.",
  },
  {
    ruleId: "todo-marker",
    severity: "error",
    pattern: /\bTODO\b/gu,
    message: "TODO marker is present in buyer-visible content.",
  },
  {
    ruleId: "lorem-ipsum",
    severity: "error",
    pattern: /\blorem ipsum\b/giu,
    message: "Lorem ipsum filler text is still present.",
  },
  {
    ruleId: "your-company",
    severity: "warning",
    pattern: /\byour company\b/giu,
    message:
      "Generic company placeholder text is still present. Replace it before launch.",
  },
  {
    ruleId: "your-email",
    severity: "warning",
    pattern: /\byour@email\b/giu,
    message:
      "Generic email placeholder text is still present. Replace it before launch.",
  },
  {
    ruleId: "placeholder",
    severity: "warning",
    pattern: /\bplaceholder\b/giu,
    message:
      "Placeholder marker is present. Confirm it is intentional before launch.",
  },
  {
    ruleId: "example-domain",
    severity: "warning",
    pattern: /\bexample\.com\b/giu,
    message:
      "example.com appears in buyer-visible input. Confirm it is intentional before launch.",
  },
];
const CONFIG_SOURCE_EXTENSIONS = new Set([".js", ".mjs", ".ts", ".tsx"]);
const TS_TYPE_ONLY_NODE_TYPES = new Set([
  "TSArrayType",
  "TSConditionalType",
  "TSConstructorType",
  "TSDeclareFunction",
  "TSExportAssignment",
  "TSExpressionWithTypeArguments",
  "TSFunctionType",
  "TSImportEqualsDeclaration",
  "TSIndexSignature",
  "TSIndexedAccessType",
  "TSInferType",
  "TSInstantiationExpression",
  "TSInterfaceBody",
  "TSInterfaceDeclaration",
  "TSIntersectionType",
  "TSLiteralType",
  "TSMappedType",
  "TSMethodSignature",
  "TSModuleBlock",
  "TSModuleDeclaration",
  "TSNamedTupleMember",
  "TSOptionalType",
  "TSParameterProperty",
  "TSParenthesizedType",
  "TSPropertySignature",
  "TSQualifiedName",
  "TSRestType",
  "TSThisType",
  "TSTupleType",
  "TSTypeAliasDeclaration",
  "TSTypeAnnotation",
  "TSTypeAssertion",
  "TSTypeLiteral",
  "TSTypeOperator",
  "TSTypeParameter",
  "TSTypeParameterDeclaration",
  "TSTypeParameterInstantiation",
  "TSTypePredicate",
  "TSTypeQuery",
  "TSTypeReference",
  "TSUnionType",
]);

function isReadinessExcludedPath(repoPath) {
  return (
    repoPath.startsWith("docs/") ||
    repoPath.startsWith("reports/") ||
    repoPath.startsWith("generated/") ||
    EXCLUDED_FILE_PATTERN.test(repoPath)
  );
}

function isReadinessSourceFile(repoPath, filePath, target) {
  if (!target.extensions.has(path.extname(filePath))) return false;
  return target.allowedPathPattern
    ? target.allowedPathPattern.test(repoPath)
    : true;
}

function collectReadinessFiles(rootDir, target) {
  const results = [];
  const startPath = path.join(rootDir, target.root);
  if (!fs.existsSync(startPath)) return results;

  function walk(currentPath) {
    const repoPath = toRepoPath(rootDir, currentPath);
    if (isReadinessExcludedPath(repoPath)) return;

    const stats = fs.statSync(currentPath);
    if (stats.isDirectory()) {
      if (GENERATED_DIR_NAMES.has(path.basename(currentPath))) return;

      const entries = fs
        .readdirSync(currentPath, { withFileTypes: true })
        .sort((left, right) => left.name.localeCompare(right.name));
      for (const entry of entries) walk(path.join(currentPath, entry.name));
      return;
    }

    if (
      stats.isFile() &&
      isReadinessSourceFile(repoPath, currentPath, target)
    ) {
      results.push({
        absolutePath: currentPath,
        repoPath,
        scanTextRules: target.scanTextRules,
        scanPathRules: target.scanPathRules ?? false,
      });
    }
  }

  walk(startPath);
  return results;
}

function getLineText(content, index) {
  const lineStart = content.lastIndexOf("\n", index - 1) + 1;
  const lineEnd = content.indexOf("\n", index);
  return content.slice(lineStart, lineEnd === -1 ? content.length : lineEnd);
}

function getEffectiveSeverity(rule, scanUnit, index) {
  if (rule.ruleId !== "fake-phone") return rule.severity;
  if (/placeholder/iu.test(scanUnit.context ?? "")) return "warning";
  if (/placeholder/iu.test(getLineText(scanUnit.value, index))) {
    return "warning";
  }
  return rule.severity;
}

function toJsonStringLiteral(value) {
  return JSON.stringify(value);
}

function getNextNonWhitespaceCharacter(content, index) {
  for (
    let currentIndex = index;
    currentIndex < content.length;
    currentIndex += 1
  ) {
    const character = content[currentIndex];
    if (!/\s/u.test(character)) return character;
  }
  return "";
}

function findJsonValueLiteralIndex(content, literal, startIndex) {
  let searchIndex = startIndex;

  while (searchIndex < content.length) {
    const literalIndex = content.indexOf(literal, searchIndex);
    if (literalIndex === -1) return -1;

    const nextCharacter = getNextNonWhitespaceCharacter(
      content,
      literalIndex + literal.length,
    );
    if (nextCharacter !== ":") return literalIndex;

    searchIndex = literalIndex + literal.length;
  }

  return -1;
}

function collectJsonStringValues(value, content, state, pointer = "") {
  if (typeof value === "string") {
    const literal = toJsonStringLiteral(value);
    const literalIndex = findJsonValueLiteralIndex(
      content,
      literal,
      state.searchIndex,
    );
    if (literalIndex !== -1) state.searchIndex = literalIndex + literal.length;

    return [
      {
        value,
        line:
          literalIndex === -1 ? 1 : getLineNumber(content, literalIndex + 1),
        context: pointer,
      },
    ];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      collectJsonStringValues(item, content, state, `${pointer}.${index}`),
    );
  }

  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) =>
      collectJsonStringValues(item, content, state, `${pointer}.${key}`),
    );
  }

  return [];
}

function collectJsonScanUnits(content) {
  try {
    return collectJsonStringValues(JSON.parse(content), content, {
      searchIndex: 0,
    });
  } catch {
    return [{ value: content, line: 1 }];
  }
}

function isSkippableConfigString(value) {
  return (
    value.startsWith("/") ||
    value.startsWith("./") ||
    value.startsWith("../") ||
    /^https?:\/\/\S+\.(?:avif|gif|jpe?g|png|svg|webp)(?:[?#].*)?$/iu.test(value)
  );
}

function pushConfigStringUnit(units, value, content, node) {
  if (!value) return;

  units.push({
    value,
    line: node.loc?.start.line ?? getLineNumber(content, node.start ?? 0),
    skipTextRules: isSkippableConfigString(value),
  });
}

function collectStringLiteralsFromNode(node, units, content) {
  if (!node || typeof node !== "object") return;
  if (TS_TYPE_ONLY_NODE_TYPES.has(node.type)) return;
  if (node.type === "ImportDeclaration") return;
  if (node.type === "ExportAllDeclaration") return;

  if (
    node.type === "ExportNamedDeclaration" ||
    node.type === "ExportDefaultDeclaration"
  ) {
    collectStringLiteralsFromNode(node.declaration, units, content);
    return;
  }

  if (
    (node.type === "StringLiteral" || node.type === "DirectiveLiteral") &&
    typeof node.value === "string"
  ) {
    pushConfigStringUnit(units, node.value, content, node);
    return;
  }

  if (node.type === "TemplateElement") {
    const value = node.value?.cooked ?? node.value?.raw;
    pushConfigStringUnit(units, value, content, node);
    return;
  }

  if (node.type === "ObjectProperty" || node.type === "ObjectMethod") {
    if (node.computed) collectStringLiteralsFromNode(node.key, units, content);
    collectStringLiteralsFromNode(node.value ?? node.body, units, content);
    return;
  }

  for (const [key, value] of Object.entries(node)) {
    if (
      key === "comments" ||
      key === "leadingComments" ||
      key === "innerComments" ||
      key === "trailingComments" ||
      key === "loc" ||
      key === "start" ||
      key === "end"
    ) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value)
        collectStringLiteralsFromNode(item, units, content);
      continue;
    }

    collectStringLiteralsFromNode(value, units, content);
  }
}

function collectConfigStringScanUnits(content) {
  const units = [];

  try {
    const ast = parse(content, {
      sourceType: "module",
      plugins: ["jsx", "typescript"],
    });
    collectStringLiteralsFromNode(ast.program, units, content);
  } catch {
    return [];
  }

  return units;
}

function collectPathScanUnits(repoPath) {
  return [{ value: repoPath, line: 1 }];
}

function stripMdxComments(content) {
  return content.replaceAll(/\{\/\*[\s\S]*?\*\/\}|<!--[\s\S]*?-->/gu, (match) =>
    "\n".repeat(match.split("\n").length - 1),
  );
}

function collectScanUnits(content, filePath) {
  const extension = path.extname(filePath);
  if (extension === ".json") return collectJsonScanUnits(content);
  if (CONFIG_SOURCE_EXTENSIONS.has(extension)) {
    return collectConfigStringScanUnits(content);
  }

  const scanContent =
    extension === ".md" || extension === ".mdx"
      ? stripMdxComments(content)
      : content;

  return scanContent.split("\n").map((line, index) => ({
    value: line,
    line: index + 1,
  }));
}

function isConfigRuntimeLogoReference(file, unit) {
  return (
    file.repoPath.startsWith("src/config/website/") &&
    unit.value.trim() === LOGO_REFERENCE
  );
}

function isContentRuntimeLogoReference(file, unit) {
  return (
    file.repoPath.startsWith("content/pages/") &&
    (MARKDOWN_LOGO_REFERENCE_PATTERN.test(unit.value) ||
      ATTRIBUTE_LOGO_REFERENCE_PATTERN.test(unit.value))
  );
}

function findRuntimeLogoReferenceUnit(file, scanUnits) {
  if (file.scanPathRules) return undefined;

  return scanUnits.find(
    (unit) =>
      isConfigRuntimeLogoReference(file, unit) ||
      isContentRuntimeLogoReference(file, unit),
  );
}

function scanReadinessFile(rootDir, file) {
  const content = fs.readFileSync(file.absolutePath, "utf8");
  const scanUnits = file.scanPathRules
    ? collectPathScanUnits(file.repoPath)
    : collectScanUnits(content, file.absolutePath);
  const findings = [];

  for (const unit of scanUnits) {
    if (unit.skipTextRules) continue;

    for (const rule of TEXT_RULES) {
      rule.pattern.lastIndex = 0;

      for (const match of unit.value.matchAll(rule.pattern)) {
        const index = match.index ?? 0;
        findings.push({
          file: file.repoPath,
          line: unit.line,
          ruleId: rule.ruleId,
          severity: getEffectiveSeverity(rule, unit, index),
          message: rule.message,
          match: match[0],
        });
      }
    }
  }

  const logoReferenceUnit = findRuntimeLogoReferenceUnit(file, scanUnits);
  const hasLogoReference = Boolean(logoReferenceUnit);
  const hasLogoAsset = fs.existsSync(path.join(rootDir, LOGO_ASSET_PATH));
  if (hasLogoReference && !hasLogoAsset) {
    findings.push({
      file: file.repoPath,
      line: logoReferenceUnit.line,
      ruleId: "missing-logo-asset",
      severity: "error",
      message:
        "Runtime reference to /images/logo.svg exists, but public/images/logo.svg is missing.",
      match: LOGO_REFERENCE,
    });
  }

  return findings;
}

function collectContentReadinessFindings(rootDir = ROOT) {
  const files = READINESS_SCAN_TARGETS.flatMap((target) =>
    collectReadinessFiles(rootDir, target),
  );
  return files.flatMap((file) =>
    file.scanTextRules || file.scanPathRules
      ? scanReadinessFile(rootDir, file)
      : [],
  );
}

function runContentReadinessCheck(rootDir = ROOT) {
  const findings = collectContentReadinessFindings(rootDir);
  const errors = findings.filter((finding) => finding.severity === "error");
  const warnings = findings.filter((finding) => finding.severity === "warning");

  return {
    status: errors.length > 0 ? "failed" : "passed",
    findings,
    errors,
    warnings,
  };
}

function printReadinessFinding(finding) {
  const suffix = finding.match ? ` (${finding.match})` : "";
  console.error(
    `- [${finding.severity}] ${finding.file}:${finding.line} ${finding.ruleId}: ${finding.message}${suffix}`,
  );
}

function runContentReadinessCli() {
  const result = runContentReadinessCheck(ROOT);

  if (result.findings.length === 0) {
    console.log("content readiness passed: no buyer-visible residue found");
    return true;
  }

  const summary = `content readiness ${result.status}: ${result.errors.length} error(s), ${result.warnings.length} warning(s)`;
  const log = result.status === "failed" ? console.error : console.log;
  log(summary);
  for (const finding of result.findings) printReadinessFinding(finding);

  return result.status !== "failed";
}

// ---------------------------------------------------------------------------
// client boundary
// ---------------------------------------------------------------------------

const BUDGET_PATH = "docs/quality/client-boundary-budget.json";
const CLIENT_BOUNDARY_REPORT_PATH =
  "reports/quality/client-boundary-budget.json";
const SOURCE_ROOT = "src";
const BUDGET_VERSION = 1;
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);
const CLIENT_BOUNDARY_EXCLUDED_DIR_NAMES = new Set([
  "__fixtures__",
  "__mocks__",
  "__tests__",
  "mock",
  "mocks",
  "spec",
  "specs",
  "stories",
  "storybook",
  ".storybook",
]);
const CLIENT_BOUNDARY_EXCLUDED_FILE_PATTERN =
  /\.(?:mock|spec|stories|story|test)\.[cm]?(?:ts|tsx)$/u;

function isClientBoundaryExcludedPath(repoPath) {
  if (repoPath.startsWith("src/test/")) return true;
  if (repoPath.startsWith("src/testing/")) return true;
  if (CLIENT_BOUNDARY_EXCLUDED_FILE_PATTERN.test(repoPath)) return true;

  return repoPath
    .split("/")
    .some((part) => CLIENT_BOUNDARY_EXCLUDED_DIR_NAMES.has(part));
}

function collectSourceFiles(rootDir) {
  const srcDir = path.join(rootDir, SOURCE_ROOT);
  const results = [];
  if (!fs.existsSync(srcDir)) return results;

  function walk(currentPath) {
    const repoPath = toRepoPath(rootDir, currentPath);
    if (isClientBoundaryExcludedPath(repoPath)) return;

    const stats = fs.statSync(currentPath);
    if (stats.isDirectory()) {
      for (const entry of fs.readdirSync(currentPath, {
        withFileTypes: true,
      })) {
        walk(path.join(currentPath, entry.name));
      }
      return;
    }

    if (stats.isFile() && SOURCE_EXTENSIONS.has(path.extname(currentPath))) {
      results.push(currentPath);
    }
  }

  walk(srcDir);
  return results.sort((left, right) => left.localeCompare(right));
}

function hasTopLevelUseClientDirective(source) {
  const ast = parse(source, {
    sourceType: "module",
    plugins: ["jsx", "typescript"],
  });

  return ast.program.directives.some(
    (directive) => directive.value.value === "use client",
  );
}

function collectClientBoundaryFiles(rootDir = ROOT) {
  const clientBoundaries = [];

  for (const filePath of collectSourceFiles(rootDir)) {
    if (!hasTopLevelUseClientDirective(fs.readFileSync(filePath, "utf8"))) {
      continue;
    }
    clientBoundaries.push(toRepoPath(rootDir, filePath));
  }

  return clientBoundaries.sort((left, right) => left.localeCompare(right));
}

function createBudgetError(kind, message) {
  return {
    kind,
    file: BUDGET_PATH,
    message,
  };
}

function isValidBudgetShape(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    value.version === BUDGET_VERSION &&
    Number.isInteger(value.maxClientBoundaries) &&
    value.maxClientBoundaries >= 0 &&
    Array.isArray(value.allowedClientBoundaries) &&
    value.allowedClientBoundaries.every((item) => typeof item === "string")
  );
}

function readBudget(rootDir) {
  const budgetFile = path.join(rootDir, BUDGET_PATH);
  if (!fs.existsSync(budgetFile)) {
    return {
      budget: null,
      errors: [
        createBudgetError(
          "budget-missing",
          "Client boundary budget file is missing.",
        ),
      ],
    };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(budgetFile, "utf8"));
    if (!isValidBudgetShape(parsed)) {
      return {
        budget: null,
        errors: [
          createBudgetError(
            "budget-invalid",
            "Client boundary budget must define version 1, maxClientBoundaries, and allowedClientBoundaries.",
          ),
        ],
      };
    }

    return {
      budget: {
        version: parsed.version,
        maxClientBoundaries: parsed.maxClientBoundaries,
        allowedClientBoundaries: parsed.allowedClientBoundaries.toSorted(
          (left, right) => left.localeCompare(right),
        ),
      },
      errors: [],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      budget: null,
      errors: [createBudgetError("budget-invalid-json", message)],
    };
  }
}

function writeClientBoundaryReport(rootDir, payload) {
  const reportFile = path.join(rootDir, CLIENT_BOUNDARY_REPORT_PATH);
  fs.mkdirSync(path.dirname(reportFile), { recursive: true });
  fs.writeFileSync(reportFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function createUnexpectedBoundaryErrors(clientBoundaries, budget) {
  const allowed = new Set(budget.allowedClientBoundaries);

  const errors = [];
  for (const file of clientBoundaries) {
    if (allowed.has(file)) continue;
    errors.push({
      kind: "unexpected-client-boundary",
      file,
      message: "Client boundary is not listed in the committed budget.",
    });
  }

  return errors;
}

function createStaleBoundaryErrors(clientBoundaries, budget) {
  const actual = new Set(clientBoundaries);

  const errors = [];
  for (const file of budget.allowedClientBoundaries) {
    if (actual.has(file)) continue;
    errors.push({
      kind: "stale-client-boundary",
      file,
      message:
        "Client boundary is listed in the committed budget but is not detected in src.",
    });
  }

  return errors;
}

function createBudgetExceededError(clientBoundaries, budget) {
  if (clientBoundaries.length <= budget.maxClientBoundaries) return null;

  return createBudgetError(
    "budget-exceeded",
    `Detected ${clientBoundaries.length} client boundaries, but the budget allows ${budget.maxClientBoundaries}.`,
  );
}

function runClientBoundaryBudgetCheck(rootDir = ROOT) {
  const clientBoundaries = collectClientBoundaryFiles(rootDir);
  const { budget, errors: budgetErrors } = readBudget(rootDir);
  const errors = [...budgetErrors];
  let unexpectedClientBoundaries = [];
  let staleClientBoundaries = [];

  if (budget) {
    const unexpectedErrors = createUnexpectedBoundaryErrors(
      clientBoundaries,
      budget,
    );
    unexpectedClientBoundaries = unexpectedErrors.map((error) => error.file);
    errors.push(...unexpectedErrors);

    const staleErrors = createStaleBoundaryErrors(clientBoundaries, budget);
    staleClientBoundaries = staleErrors.map((error) => error.file);
    errors.push(...staleErrors);

    const budgetExceededError = createBudgetExceededError(
      clientBoundaries,
      budget,
    );
    if (budgetExceededError) errors.push(budgetExceededError);
  }

  const result = {
    status: errors.length === 0 ? "passed" : "failed",
    budgetPath: BUDGET_PATH,
    reportPath: CLIENT_BOUNDARY_REPORT_PATH,
    clientBoundaries,
    unexpectedClientBoundaries,
    staleClientBoundaries,
    maxClientBoundaries: budget?.maxClientBoundaries ?? null,
    errors,
  };

  writeClientBoundaryReport(rootDir, {
    createdAt: new Date().toISOString(),
    ...result,
  });

  return result;
}

function runClientBoundaryCli() {
  const result = runClientBoundaryBudgetCheck(ROOT);

  console.log(
    `[client-boundary-budget] ${result.status}: ${result.clientBoundaries.length} client boundary file(s)`,
  );
  for (const error of result.errors) {
    console.log(`- ERROR ${error.file} ${error.kind}: ${error.message}`);
  }

  return result.status !== "failed";
}

// ---------------------------------------------------------------------------
// truth docs
// ---------------------------------------------------------------------------

const TRUTH_DOC_CHECKS = [
  {
    file: "docs/guides/CANONICAL-TRUTH-REGISTRY.md",
    required: [
      "src/config/single-site-page-expression.ts",
      "src/config/single-site-seo.ts",
      "messages/en/critical.json",
      "messages/en/deferred.json",
      "Browser contact route handler",
    ],
    forbidden: [
      "Canonical site registry:",
      "Canonical site definitions:",
      "Canonical site-specific overlay sources:",
      "Contact page Server Action",
    ],
  },
  {
    file: "docs/guides/DERIVATIVE-PROJECT-REPLACEMENT-CHECKLIST.md",
    required: [
      "src/config/single-site-page-expression.ts",
      "src/config/single-site-seo.ts",
      "Do not replace first",
      "Minimum proof after replacement",
    ],
    forbidden: ["pnpm ci:local", "pnpm review:translation-quartet"],
  },
  {
    file: "docs/guides/TIER-A-OWNER-MAP.md",
    forbidden: [
      "src/sites/message-overrides.ts",
      "src/sites/**/messages/**",
      "src/lib/lead-pipeline/**",
      "messages/en.json",
      "messages/zh.json",
      "scripts/cloudflare/**",
    ],
  },
  {
    file: "docs/guides/RELEASE-PROOF-RUNBOOK.md",
    required: [
      "src/config/single-site-page-expression.ts",
      "src/config/single-site-seo.ts",
      "dirty worktree",
      "targeted proof",
      "clean branch",
    ],
    forbidden: [
      "`src/sites/**` or `src/sites/**/messages/**`",
      "pnpm ci:local",
      "pnpm review:tier-a:staged",
      "pnpm review:clusters",
      "CF_APPLY_GENERATED_PATCH=true pnpm build:cf",
      "node scripts/clean-next-build-artifacts.mjs",
      "CI=1 pnpm exec playwright test --all-projects",
      "pnpm review:translation-quartet",
      "pnpm review:translate-compat",
    ],
  },
  {
    file: "docs/guides/QUALITY-PROOF-LEVELS.md",
    required: [
      "src/config/single-site-page-expression.ts",
      "src/config/single-site-seo.ts",
      "dirty worktree",
      "targeted proof",
      "clean branch",
    ],
    forbidden: [
      "src/sites/**",
      "site-specific message overlays",
      "pnpm ci:local",
      "pnpm quality:gate",
      "security 通过",
      "performance 通过",
    ],
  },
  {
    file: "docs/guides/STRUCTURAL-CHANGE-CLUSTERS.md",
    forbidden: [
      "src/sites/message-overrides.ts",
      "src/sites/**/messages/**",
      "messages/en.json",
      "messages/zh.json",
      "pnpm review:tier-a:staged",
      "pnpm review:lead-family",
      "pnpm review:homepage-sections",
      "pnpm review:locale-runtime",
      "pnpm review:clusters",
      "pnpm review:cluster",
    ],
  },
  {
    file: "docs/guides/GUARDRAIL-SIDE-EFFECTS.md",
    forbidden: [
      "pnpm quality:gate",
      "src/lib/lead-pipeline/metrics.ts",
      "src/lib/lead-pipeline/pipeline-observability.ts",
    ],
  },
  {
    file: "docs/technical/project-architecture-diagram.svg",
    forbidden: ["scripts/cloudflare/**"],
  },
  {
    file: "docs/website/部署设置.md",
    required: [
      "Cloudflare image delivery strategy",
      "starter baseline",
      "customer upgrade lane",
    ],
    forbidden: [
      "Cloudflare Image Optimization is enabled by default",
      "Cloudflare image optimization is enabled by default",
      "Cloudflare Images is required by default",
      "Cloudflare Transformations is required by default",
    ],
  },
  {
    file: "docs/website/新项目替换清单.md",
    required: [
      "图片交付策略",
      "starter baseline",
      "Cloudflare Transformations",
      "Cloudflare Images",
    ],
    forbidden: [
      "Cloudflare Image Optimization is enabled by default",
      "Cloudflare image optimization is enabled by default",
      "Cloudflare Images is required by default",
      "Cloudflare Transformations is required by default",
    ],
  },
  {
    file: "docs/website/quality-proof.md",
    required: [
      "Cloudflare image transformation proof",
      "deployed Cloudflare URL",
      "buyer-visible transformed image URL",
    ],
    forbidden: [
      "Cloudflare Image Optimization is enabled by default",
      "Cloudflare image optimization is enabled by default",
      "Cloudflare Images is required by default",
      "Cloudflare Transformations is required by default",
    ],
  },
  {
    file: ".claude/rules/content.md",
    required: [
      "src/config/single-site-page-expression.ts",
      "src/config/single-site-seo.ts",
      "implementation detail",
      "docs/workflows/cwf/**",
    ],
  },
  {
    file: ".claude/rules/i18n.md",
    required: [
      "messages/en/critical.json",
      "messages/en/deferred.json",
      "Runtime loads bundled split imports",
      "Root layout must emit the correct server-rendered `<html lang={locale}>`",
      "Current repo truth does **not** include a live `src/sites/**/messages/**` runtime overlay layout.",
    ],
  },
  {
    file: ".claude/rules/testing.md",
    required: ["docs/specs/behavioral-contracts.md"],
  },
];

const CURRENT_TRUTH_COMMAND_DOCS = [
  "docs/guides/STRUCTURAL-CHANGE-CLUSTERS.md",
  "docs/guides/DERIVATIVE-PROJECT-REPLACEMENT-CHECKLIST.md",
  "docs/guides/RELEASE-PROOF-RUNBOOK.md",
  "docs/guides/QUALITY-PROOF-LEVELS.md",
  "docs/website/quality-proof.md",
  "docs/website/新项目替换清单.md",
  "docs/website/部署设置.md",
  "docs/technical/deployment-notes.md",
  "docs/impeccable/system/SECTION-REDESIGN-CHECKLIST.md",
];

const RELEASE_PROOF_SEQUENCE = [
  "node scripts/starter-checks.js truth-docs",
  "node scripts/starter-checks.js cf-official-compare --source-only",
  "pnpm type-check",
  "pnpm lint:check",
  "pnpm exec vitest run tests/unit/middleware.test.ts src/__tests__/middleware-locale-cookie.test.ts src/i18n/__tests__/request.test.ts src/lib/__tests__/load-messages.fallback.test.ts",
  "pnpm exec vitest run tests/integration/api/lead-family-contract.test.ts tests/integration/api/lead-family-protection.test.ts src/app/api/inquiry/__tests__/route.test.ts tests/integration/api/subscribe.test.ts",
  "pnpm exec vitest run tests/integration/api/health.test.ts src/__tests__/middleware-locale-cookie.test.ts",
  "node scripts/starter-checks.js translations",
  "pnpm build",
  "pnpm website:build:cf",
  "pnpm exec wrangler deploy --dry-run --env preview",
  "CI=1 pnpm exec playwright test tests/e2e/no-js-html-contract.spec.ts tests/e2e/navigation.spec.ts tests/e2e/contact-form-smoke.spec.ts --project=chromium",
];
const RELEASE_VERIFY_COMMANDS = [
  {
    command: "node",
    args: ["scripts/starter-checks.js", "truth-docs"],
  },
  {
    command: "node",
    args: ["scripts/starter-checks.js", "cf-official-compare", "--source-only"],
  },
  {
    command: "pnpm",
    args: ["type-check"],
  },
  {
    command: "pnpm",
    args: ["lint:check"],
  },
  {
    command: "pnpm",
    args: [
      "exec",
      "vitest",
      "run",
      "tests/unit/middleware.test.ts",
      "src/__tests__/middleware-locale-cookie.test.ts",
      "src/i18n/__tests__/request.test.ts",
      "src/lib/__tests__/load-messages.fallback.test.ts",
    ],
  },
  {
    command: "pnpm",
    args: [
      "exec",
      "vitest",
      "run",
      "tests/integration/api/lead-family-contract.test.ts",
      "tests/integration/api/lead-family-protection.test.ts",
      "src/app/api/inquiry/__tests__/route.test.ts",
      "tests/integration/api/subscribe.test.ts",
    ],
  },
  {
    command: "pnpm",
    args: [
      "exec",
      "vitest",
      "run",
      "tests/integration/api/health.test.ts",
      "src/__tests__/middleware-locale-cookie.test.ts",
    ],
  },
  {
    command: "node",
    args: ["scripts/starter-checks.js", "translations"],
  },
  {
    command: "pnpm",
    args: ["build"],
  },
  {
    command: "pnpm",
    args: ["website:build:cf"],
  },
  {
    command: "pnpm",
    args: ["exec", "wrangler", "deploy", "--dry-run", "--env", "preview"],
  },
  {
    command: "pnpm",
    args: [
      "exec",
      "playwright",
      "test",
      "tests/e2e/no-js-html-contract.spec.ts",
      "tests/e2e/navigation.spec.ts",
      "tests/e2e/contact-form-smoke.spec.ts",
      "--project=chromium",
    ],
    env: {
      CI: "1",
    },
  },
];

function readTruthFile(rootDir, relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

function findOutOfOrderCommand(sequence, content) {
  let previousIndex = -1;

  for (const command of sequence) {
    const index = content.indexOf(command);
    if (index === -1) continue;
    if (index < previousIndex) return command;
    previousIndex = index;
  }

  return null;
}

function findCommandLineIndex(content, command) {
  return content.split("\n").findIndex((line) => line.trim() === command);
}

function collectCurrentTruthDocFindings(rootDir = ROOT) {
  const failures = [];

  for (const check of TRUTH_DOC_CHECKS) {
    const fullPath = path.join(rootDir, check.file);
    if (!fs.existsSync(fullPath)) {
      failures.push({
        file: check.file,
        error: `missing required current-truth file "${check.file}"`,
      });
      continue;
    }

    const content = readTruthFile(rootDir, check.file);
    for (const pattern of check.forbidden ?? []) {
      if (content.includes(pattern)) {
        failures.push({
          file: check.file,
          error: `forbidden current-truth pattern "${pattern}"`,
        });
      }
    }

    for (const pattern of check.required ?? []) {
      if (!content.includes(pattern)) {
        failures.push({
          file: check.file,
          error: `missing current-truth pattern "${pattern}"`,
        });
      }
    }
  }

  const packageJsonPath = path.join(rootDir, "package.json");
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(readTruthFile(rootDir, "package.json"));
    const scripts = packageJson.scripts ?? {};
    const commandDocs = CURRENT_TRUTH_COMMAND_DOCS;
    const directCommandPrefixes = [
      "node scripts/",
      "pnpm exec ",
      "CI=1 pnpm exec ",
      "APP_ENV=preview NEXT_PUBLIC_SITE_URL=https://preview.example.com NODE_ENV=production pnpm exec ",
      "PUBLIC_LAUNCH_STRICT=true pnpm exec ",
      'POST_DEPLOY_TEST=1 PLAYWRIGHT_BASE_URL="$DEPLOYED_BASE_URL" pnpm exec ',
    ];

    for (const doc of commandDocs) {
      const fullPath = path.join(rootDir, doc);
      if (!fs.existsSync(fullPath)) continue;

      const content = readTruthFile(rootDir, doc);
      const matches = content.matchAll(/\bpnpm\s+([A-Za-z0-9:_-]+)/g);
      for (const match of matches) {
        const scriptName = match[1];
        if (scriptName === "exec") continue;

        const lineStart = content.lastIndexOf("\n", match.index) + 1;
        const lineEnd = content.indexOf("\n", match.index);
        const line = content.slice(
          lineStart,
          lineEnd === -1 ? undefined : lineEnd,
        );
        if (line.includes("没有 canonical")) continue;
        if (
          directCommandPrefixes.some((prefix) => line.trim().startsWith(prefix))
        ) {
          continue;
        }

        if (scripts[scriptName]) continue;
        failures.push({
          file: doc,
          error: `unknown package script command "pnpm ${scriptName}"`,
        });
      }
    }
  }

  const runbookPath = path.join(
    rootDir,
    "docs/guides/RELEASE-PROOF-RUNBOOK.md",
  );
  if (fs.existsSync(runbookPath)) {
    const runbook = readTruthFile(
      rootDir,
      "docs/guides/RELEASE-PROOF-RUNBOOK.md",
    );
    const releaseScriptPath = path.join(rootDir, "scripts/release-proof.sh");
    const releaseScript = fs.existsSync(releaseScriptPath)
      ? readTruthFile(rootDir, "scripts/release-proof.sh")
      : null;

    for (const command of RELEASE_PROOF_SEQUENCE) {
      if (releaseScript !== null && !releaseScript.includes(command)) {
        failures.push({
          file: "scripts/release-proof.sh",
          error: `missing release-proof command "${command}"`,
        });
      }
      if (!runbook.includes(command)) {
        failures.push({
          file: "docs/guides/RELEASE-PROOF-RUNBOOK.md",
          error: `missing release-proof runbook command "${command}"`,
        });
      }
    }

    if (releaseScript !== null) {
      const scriptOutOfOrder = findOutOfOrderCommand(
        RELEASE_PROOF_SEQUENCE,
        releaseScript,
      );
      if (scriptOutOfOrder) {
        failures.push({
          file: "scripts/release-proof.sh",
          error: `release-proof command order drift at "${scriptOutOfOrder}"`,
        });
      }
    }

    const runbookOutOfOrder = findOutOfOrderCommand(
      RELEASE_PROOF_SEQUENCE,
      runbook,
    );
    if (runbookOutOfOrder) {
      failures.push({
        file: "docs/guides/RELEASE-PROOF-RUNBOOK.md",
        error: `release-proof runbook command order drift at "${runbookOutOfOrder}"`,
      });
    }
  }

  const derivativeChecklistPath = path.join(
    rootDir,
    "docs/guides/DERIVATIVE-PROJECT-REPLACEMENT-CHECKLIST.md",
  );
  if (fs.existsSync(derivativeChecklistPath)) {
    const checklist = readTruthFile(
      rootDir,
      "docs/guides/DERIVATIVE-PROJECT-REPLACEMENT-CHECKLIST.md",
    );
    const buildIndex = findCommandLineIndex(checklist, "pnpm build");
    const buildCfIndex = findCommandLineIndex(
      checklist,
      "pnpm website:build:cf",
    );

    if (buildIndex === -1) {
      failures.push({
        file: "docs/guides/DERIVATIVE-PROJECT-REPLACEMENT-CHECKLIST.md",
        error: 'missing derivative proof command "pnpm build"',
      });
    }

    if (buildCfIndex === -1) {
      failures.push({
        file: "docs/guides/DERIVATIVE-PROJECT-REPLACEMENT-CHECKLIST.md",
        error: 'missing derivative proof command "pnpm website:build:cf"',
      });
    }

    if (buildIndex !== -1 && buildCfIndex !== -1 && buildIndex > buildCfIndex) {
      failures.push({
        file: "docs/guides/DERIVATIVE-PROJECT-REPLACEMENT-CHECKLIST.md",
        error: '"pnpm build" must appear before "pnpm website:build:cf"',
      });
    }
  }

  return failures;
}

function runTruthDocsCheck() {
  const failures = collectCurrentTruthDocFindings();

  if (failures.length === 0) {
    console.log("current-truth-docs: passed");
    return true;
  }

  console.error("current-truth-docs: failed");
  for (const failure of failures) {
    console.error(`- ${failure.file}: ${failure.error}`);
  }
  return false;
}

function isReleaseVerifyBlockedEnv(name) {
  const value = process.env[name] ?? "";
  return value === "true" || value === "1";
}

function runReleaseVerifyCommand(step) {
  const result = spawnSync(step.command, step.args, {
    cwd: ROOT,
    stdio: "inherit",
    env: {
      ...process.env,
      ...(step.env ?? {}),
    },
  });

  return result.status ?? 1;
}

function runReleaseVerify() {
  if (isReleaseVerifyBlockedEnv("VALIDATE_CONFIG_SKIP_RUNTIME")) {
    console.error(
      "release-proof must not run with VALIDATE_CONFIG_SKIP_RUNTIME enabled",
    );
    return 1;
  }

  if (isReleaseVerifyBlockedEnv("ALLOW_MEMORY_RATE_LIMIT")) {
    console.error(
      "release-proof must not run with ALLOW_MEMORY_RATE_LIMIT enabled",
    );
    return 1;
  }

  console.log("== Release verification flow ==");
  for (const step of RELEASE_VERIFY_COMMANDS) {
    const status = runReleaseVerifyCommand(step);
    if (status !== 0) return status;
  }

  console.log("Cloudflare proof split:");
  console.log(
    "  - Local stock preview: node scripts/starter-checks.js cf-preview-smoke",
  );
  console.log(
    "  - Local Cloudflare deploy-artifact dry run: pnpm exec wrangler deploy --dry-run --env preview",
  );
  console.log(
    "  - Real preview publish path: node scripts/starter-checks.js cf-preview-deployed",
  );
  console.log(
    '  - Deployed GET smoke: node scripts/starter-checks.js deployed-smoke --base-url "$DEPLOYED_BASE_URL"',
  );
  console.log(
    '  - Real deployed lead canary manual launch gate: POST_DEPLOY_TEST=1 PLAYWRIGHT_BASE_URL="$DEPLOYED_BASE_URL" pnpm exec playwright test tests/e2e/smoke/',
  );
  console.log(
    "  - The lead canary requires deployed Airtable/Resend/Turnstile credentials and must be recorded before broad public launch.",
  );
  console.log(
    "Local release proof completed. This is NOT public launch proof.",
  );
  console.log(
    "Public launch still requires strict config, deployed smoke, real lead canary, and owner signoff.",
  );
  return 0;
}

// ---------------------------------------------------------------------------
// Cloudflare official compare
// ---------------------------------------------------------------------------

const CLOUDFLARE_SOURCE_CHECKS = [
  {
    file: "open-next.config.ts",
    label:
      "OpenNext config stays anchored to the Cloudflare adapter without custom cache or split topology",
    requiredSnippets: ["defineCloudflareConfig"],
    forbiddenSnippets: [
      "r2IncrementalCache",
      "doQueue",
      "d1NextTagCache",
      "functions",
      "apiLead",
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
const CLOUDFLARE_SCRIPT_SURFACE_CHECKS = [
  {
    name: "website:build:cf",
    expected: "pnpm exec opennextjs-cloudflare build --noMinify",
  },
];
const DESTRUCTIVE_DEPLOY_SCRIPT_SNIPPETS = [
  "wrangler delete",
  "deleted_classes",
  "new_sqlite_classes",
];

function readCloudflareCompareFile(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function normalizeCloudflareCompareForbiddenCheck(snippet) {
  if (typeof snippet === "string") {
    return { match: snippet, type: "substring" };
  }

  return snippet;
}

function hasCloudflareCompareForbiddenContent(content, snippet) {
  const check = normalizeCloudflareCompareForbiddenCheck(snippet);

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

function findCloudflareCompareForbiddenSnippets(content, snippets) {
  return snippets.filter((snippet) =>
    hasCloudflareCompareForbiddenContent(content, snippet),
  );
}

function formatCloudflareCompareForbiddenSnippet(snippet) {
  const check = normalizeCloudflareCompareForbiddenCheck(snippet);
  return check.type === "regex" ? check.match.toString() : check.match;
}

function collectCloudflareOfficialCompareFailures(options = {}) {
  const { sourceOnly = false, generatedOnly = false } = options;
  const failures = [];
  const packageJson = JSON.parse(readCloudflareCompareFile("package.json"));
  const scripts = packageJson.scripts ?? {};

  if (!generatedOnly) {
    for (const check of CLOUDFLARE_SOURCE_CHECKS) {
      const content = readCloudflareCompareFile(check.file);
      const missing = check.requiredSnippets.filter(
        (snippet) => !content.includes(snippet),
      );
      const forbidden = findCloudflareCompareForbiddenSnippets(
        content,
        check.forbiddenSnippets,
      );

      if (missing.length > 0 || forbidden.length > 0) {
        failures.push({
          file: check.file,
          label: check.label,
          missing,
          forbidden,
        });
      }
    }

    for (const check of CLOUDFLARE_SCRIPT_SURFACE_CHECKS) {
      const script = scripts[check.name];
      const matches = script === check.expected;

      if (!matches) {
        failures.push({
          file: "package.json",
          label:
            "stable Cloudflare build entrypoint must use the native OpenNext Cloudflare CLI",
          missing: [`${check.name}: ${check.expected}`],
          forbidden: [],
        });
      }

      if (typeof script === "string") {
        const forbidden = findCloudflareCompareForbiddenSnippets(script, [
          ...DESTRUCTIVE_DEPLOY_SCRIPT_SNIPPETS,
          "&&",
          "||",
          ";",
        ]);

        if (forbidden.length > 0) {
          failures.push({
            file: "package.json",
            label:
              "Cloudflare build alias must stay exact and must not chain destructive actions",
            missing: [],
            forbidden,
          });
        }
      }
    }

    for (const retiredName of [
      "build:cf",
      "deploy:cf",
      "deploy:cf:dry-run",
      "proof:cf:preview-deployed",
    ]) {
      if (!Object.prototype.hasOwnProperty.call(scripts, retiredName)) {
        continue;
      }

      failures.push({
        file: "package.json",
        label:
          "advanced Cloudflare deploy/proof commands stay as direct scripts, not public package aliases",
        missing: [],
        forbidden: [retiredName],
      });
    }

    const cloudflareWorkflow = readCloudflareCompareFile(
      ".github/workflows/cloudflare-deploy.yml",
    );
    for (const snippet of [
      "node scripts/starter-checks.js cf-preview-deployed",
      "pnpm exec opennextjs-cloudflare deploy --env production",
    ]) {
      if (!cloudflareWorkflow.includes(snippet)) {
        failures.push({
          file: ".github/workflows/cloudflare-deploy.yml",
          label: "Cloudflare workflow must call deploy/proof scripts directly",
          missing: [snippet],
          forbidden: [],
        });
      }
    }
  }

  if (generatedOnly) {
    console.warn(
      "cf-official-compare: --generated-only is retired; native Cloudflare deploy-artifact proof is `pnpm exec wrangler deploy --dry-run --env preview` after `pnpm website:build:cf`.",
    );
  }

  return failures;
}

function runCloudflareOfficialCompareCli(args = []) {
  const sourceOnly = args.includes("--source-only");
  const generatedOnly = args.includes("--generated-only");
  const requireGenerated =
    generatedOnly || args.includes("--require-generated") || !sourceOnly;

  if (sourceOnly && generatedOnly) {
    console.error(
      "cf-official-compare: --generated-only is retired; use --source-only plus wrangler deploy --dry-run.",
    );
    return false;
  }

  if (sourceOnly && args.includes("--require-generated")) {
    console.error(
      "cf-official-compare: generated phase configs are retired; --require-generated is no longer supported.",
    );
    return false;
  }

  const failures = collectCloudflareOfficialCompareFailures({
    sourceOnly,
    generatedOnly,
    requireGenerated,
  });

  if (failures.length > 0) {
    console.error("cf-official-compare: failed");
    for (const failure of failures) {
      console.error(`- ${failure.file}: ${failure.label}`);
      for (const snippet of failure.missing) {
        console.error(`  - missing snippet: ${snippet}`);
      }
      for (const snippet of failure.forbidden) {
        console.error(
          `  - forbidden snippet still present: ${formatCloudflareCompareForbiddenSnippet(snippet)}`,
        );
      }
    }
    return false;
  }

  console.log("cf-official-compare: passed");
  if (generatedOnly) {
    console.log(
      "Generated phase config checks are retired. Run `pnpm exec wrangler deploy --dry-run --env preview` for native deploy-artifact proof.",
    );
  } else if (sourceOnly) {
    console.log(
      "Verified static-generation Cloudflare source baseline against open-next.config.ts, wrangler.jsonc, and package deploy aliases.",
    );
  } else {
    console.log(
      "Verified static-generation Cloudflare source baseline. Native deploy-artifact proof is covered by wrangler deploy --dry-run.",
    );
  }

  return true;
}

// ---------------------------------------------------------------------------
// Cloudflare preview and deployed smoke
// ---------------------------------------------------------------------------

const DEFAULT_CF_PREVIEW_BASE_URL =
  process.env.CLOUDFLARE_PREVIEW_BASE_URL || "http://127.0.0.1:8787";
const DEFAULT_DEPLOY_SMOKE_BASE_URL = process.env.DEPLOY_SMOKE_BASE_URL || "";
const DEPLOY_SMOKE_REQUEST_TIMEOUT_MS = 30000;
const DEPLOY_SMOKE_REQUEST_RETRIES = 2;
const DEPLOY_SMOKE_RETRY_DELAY_MS = 1000;
const CF_PREVIEW_PROOF_OUTPUT_PATH = path.join(
  ROOT,
  "reports",
  "deploy",
  "cloudflare-preview-proof.json",
);
const CF_PREVIEW_DEPLOY_COMMAND = [
  "exec",
  "opennextjs-cloudflare",
  "deploy",
  "--env",
  "preview",
];
const CF_PREVIEW_URL_PATTERN = new RegExp(
  "https://[^\\s\\\"']+\\.workers\\.dev",
  "gi",
);
const CF_PREVIEW_DEPLOY_URL_PATTERN = CF_PREVIEW_URL_PATTERN;

function parseCloudflarePreviewSmokeArgs(args) {
  const parsed = {
    baseUrl: DEFAULT_CF_PREVIEW_BASE_URL,
    includeApiHealth: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--") continue;

    if (arg === "--base-url" && i + 1 < args.length) {
      parsed.baseUrl = args[++i];
      continue;
    }

    if (arg === "--include-api-health") {
      parsed.includeApiHealth = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function normalizeSetCookieFlags(cookieHeader) {
  return cookieHeader
    .split(";")
    .slice(1)
    .flatMap((part) => {
      const flag = part.trim().toLowerCase();
      return flag && !flag.startsWith("expires=") ? [flag] : [];
    })
    .sort();
}

async function requestCloudflarePreviewSmoke(baseUrl, pathname) {
  const url = new URL(pathname, baseUrl);
  const response = await fetch(url, {
    redirect: "manual",
    headers: {
      "user-agent": "cloudflare-preview-smoke",
    },
  });

  return {
    pathname,
    status: response.status,
    location: response.headers.get("location"),
    setCookie: response.headers.get("set-cookie"),
    leakedMiddlewareCookie: response.headers.get("x-middleware-set-cookie"),
    body: await response.text(),
  };
}

function pushFailureUnless(condition, message, failures) {
  if (!condition) failures.push(message);
}

async function runCloudflarePreviewSmoke(args = []) {
  const { baseUrl, includeApiHealth } = parseCloudflarePreviewSmokeArgs(args);
  const failures = [];

  console.log(
    `[cf-preview-smoke] Probing ${baseUrl} (${includeApiHealth ? "strict" : "page/header"} mode)`,
  );

  const rootResponse = await requestCloudflarePreviewSmoke(baseUrl, "/");
  const invalidLocaleResponse = await requestCloudflarePreviewSmoke(
    baseUrl,
    "/invalid/contact",
  );
  const invalidLocaleDynamicResponse = await requestCloudflarePreviewSmoke(
    baseUrl,
    "/fr/products/eu/fittings",
  );
  const pageResponses = await Promise.all([
    requestCloudflarePreviewSmoke(baseUrl, "/en"),
    requestCloudflarePreviewSmoke(baseUrl, "/zh"),
    requestCloudflarePreviewSmoke(baseUrl, "/en/contact"),
    requestCloudflarePreviewSmoke(baseUrl, "/zh/contact"),
  ]);
  const apiHealthResponse = includeApiHealth
    ? await requestCloudflarePreviewSmoke(baseUrl, "/api/health")
    : null;

  pushFailureUnless(
    [200, 307, 308].includes(rootResponse.status),
    `Expected / to return 200/307/308, got ${rootResponse.status}`,
    failures,
  );

  if ([307, 308].includes(rootResponse.status)) {
    pushFailureUnless(
      rootResponse.location === "/en",
      `Expected / redirect location to be /en, got ${rootResponse.location ?? "(missing)"}`,
      failures,
    );
  }

  pushFailureUnless(
    [307, 308].includes(invalidLocaleResponse.status),
    `Expected /invalid/contact to redirect, got ${invalidLocaleResponse.status}`,
    failures,
  );
  pushFailureUnless(
    invalidLocaleResponse.location === "/en/contact",
    `Expected /invalid/contact redirect location to be /en/contact, got ${invalidLocaleResponse.location ?? "(missing)"}`,
    failures,
  );
  pushFailureUnless(
    [307, 308].includes(invalidLocaleDynamicResponse.status),
    `Expected /fr/products/eu/fittings to redirect, got ${invalidLocaleDynamicResponse.status}`,
    failures,
  );
  pushFailureUnless(
    invalidLocaleDynamicResponse.location === "/en/products/eu/fittings",
    `Expected /fr/products/eu/fittings redirect location to be /en/products/eu/fittings, got ${invalidLocaleDynamicResponse.location ?? "(missing)"}`,
    failures,
  );

  for (const response of [
    rootResponse,
    invalidLocaleResponse,
    invalidLocaleDynamicResponse,
    ...pageResponses,
    ...(apiHealthResponse ? [apiHealthResponse] : []),
  ]) {
    pushFailureUnless(
      response.leakedMiddlewareCookie === null,
      `Unexpected x-middleware-set-cookie leak on ${response.pathname}`,
      failures,
    );
  }

  for (const response of pageResponses) {
    pushFailureUnless(
      response.status === 200,
      `Expected ${response.pathname} to return 200, got ${response.status}`,
      failures,
    );
    pushFailureUnless(
      !response.body.includes("Unexpected loadManifest"),
      `Unexpected manifest loader failure surfaced on ${response.pathname}`,
      failures,
    );
  }

  if (apiHealthResponse) {
    pushFailureUnless(
      apiHealthResponse.status === 200,
      `Expected /api/health to return 200, got ${apiHealthResponse.status}`,
      failures,
    );
    pushFailureUnless(
      !apiHealthResponse.body.includes("Unexpected loadManifest"),
      "Unexpected manifest loader failure surfaced on /api/health",
      failures,
    );
  } else {
    console.log(
      "[cf-preview-smoke] Skipping /api/health (diagnostic-only in local preview).",
    );
    console.log(
      "[cf-preview-smoke] Policy: local preview proves page/header/cookie behavior. API proof belongs to deployed smoke.",
    );
    console.log("[cf-preview-smoke] Reference: .claude/rules/cloudflare.md");
  }

  if (
    rootResponse.setCookie &&
    invalidLocaleResponse.setCookie &&
    invalidLocaleDynamicResponse.setCookie
  ) {
    const rootFlags = normalizeSetCookieFlags(rootResponse.setCookie);
    const invalidFlags = normalizeSetCookieFlags(
      invalidLocaleResponse.setCookie,
    );
    const invalidDynamicFlags = normalizeSetCookieFlags(
      invalidLocaleDynamicResponse.setCookie,
    );
    pushFailureUnless(
      JSON.stringify(rootFlags) === JSON.stringify(invalidFlags),
      `NEXT_LOCALE cookie flags differ between / and /invalid/contact (${rootFlags.join(", ") || "none"} vs ${invalidFlags.join(", ") || "none"})`,
      failures,
    );
    pushFailureUnless(
      JSON.stringify(rootFlags) === JSON.stringify(invalidDynamicFlags),
      `NEXT_LOCALE cookie flags differ between / and /fr/products/eu/fittings (${rootFlags.join(", ") || "none"} vs ${invalidDynamicFlags.join(", ") || "none"})`,
      failures,
    );
  }

  if (failures.length > 0) {
    console.error("[cf-preview-smoke] Failures detected:");
    for (const failure of failures) {
      console.error(`  - ${failure}`);
    }
    return false;
  }

  console.log("[cf-preview-smoke] All checks passed");
  return true;
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getDeploySmokeRetryDelayMs(attempt) {
  return DEPLOY_SMOKE_RETRY_DELAY_MS * 2 ** attempt;
}

function parseDeployedSmokeArgs(args) {
  const parsed = {
    baseUrl: DEFAULT_DEPLOY_SMOKE_BASE_URL,
    headerName: process.env.DEPLOY_SMOKE_HEADER_NAME || "",
    headerValue: process.env.DEPLOY_SMOKE_HEADER_VALUE || "",
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--") continue;

    if (arg === "--base-url" && i + 1 < args.length) {
      parsed.baseUrl = args[++i];
      continue;
    }

    if (arg === "--header-name" && i + 1 < args.length) {
      parsed.headerName = args[++i];
      continue;
    }

    if (arg === "--header-value" && i + 1 < args.length) {
      parsed.headerValue = args[++i];
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!parsed.baseUrl) {
    throw new Error("Missing required --base-url");
  }

  if (Boolean(parsed.headerName) !== Boolean(parsed.headerValue)) {
    throw new Error(
      "Both --header-name and --header-value must be provided together",
    );
  }

  return parsed;
}

function buildDeployedSmokeHeaders(headerName, headerValue) {
  const headers = {
    "user-agent": "post-deploy-smoke",
  };

  if (headerName && headerValue) {
    headers[headerName] = headerValue;
  }

  return headers;
}

function isRetriableFetchError(error) {
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return true;
  }

  return (
    error instanceof Error &&
    "cause" in error &&
    typeof error.cause === "object" &&
    error.cause !== null &&
    "code" in error.cause &&
    error.cause.code === "UND_ERR_CONNECT_TIMEOUT"
  );
}

async function requestDeployedSmoke(baseUrl, pathname, headers, retryEvents) {
  const url = new URL(pathname, baseUrl);

  let retries = 0;
  let lastError;

  for (let attempt = 0; attempt <= DEPLOY_SMOKE_REQUEST_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        redirect: "manual",
        headers,
        signal: AbortSignal.timeout(DEPLOY_SMOKE_REQUEST_TIMEOUT_MS),
      });
      const body = await response.text();

      if (response.status >= 500 && attempt < DEPLOY_SMOKE_REQUEST_RETRIES) {
        retries += 1;
        const nextAttempt = attempt + 2;
        retryEvents.push({
          pathname,
          reason: `status ${response.status}`,
          nextAttempt,
        });
        console.warn(
          `[post-deploy-smoke] ${pathname} returned ${response.status}; retrying attempt ${nextAttempt}/${DEPLOY_SMOKE_REQUEST_RETRIES + 1}`,
        );
        await delay(getDeploySmokeRetryDelayMs(attempt));
        continue;
      }

      return {
        pathname,
        status: response.status,
        location: response.headers.get("location"),
        body,
        retries,
      };
    } catch (error) {
      lastError = error;
      if (!isRetriableFetchError(error)) throw error;

      if (attempt < DEPLOY_SMOKE_REQUEST_RETRIES) {
        retries += 1;
        const nextAttempt = attempt + 2;
        retryEvents.push({
          pathname,
          reason: error instanceof Error ? error.message : String(error),
          nextAttempt,
        });
        console.warn(
          `[post-deploy-smoke] ${pathname} request failed; retrying attempt ${nextAttempt}/${DEPLOY_SMOKE_REQUEST_RETRIES + 1}`,
        );
        await delay(getDeploySmokeRetryDelayMs(attempt));
      }
    }
  }

  throw new Error("post-deploy-smoke retry loop exited without a response", {
    cause: lastError,
  });
}

async function runDeployedSmoke(args = []) {
  const { baseUrl, headerName, headerValue } = parseDeployedSmokeArgs(args);
  const headers = buildDeployedSmokeHeaders(headerName, headerValue);
  const failures = [];
  const retryEvents = [];

  console.log(`[post-deploy-smoke] Probing ${baseUrl}`);

  const rootResponse = await requestDeployedSmoke(
    baseUrl,
    "/",
    headers,
    retryEvents,
  );
  const invalidLocaleResponse = await requestDeployedSmoke(
    baseUrl,
    "/invalid/contact",
    headers,
    retryEvents,
  );
  const pages = [];

  for (const pathname of [
    "/en",
    "/zh",
    "/api/health",
    "/en/contact",
    "/zh/contact",
  ]) {
    pages.push(
      await requestDeployedSmoke(baseUrl, pathname, headers, retryEvents),
    );
  }

  pushFailureUnless(
    [200, 307, 308].includes(rootResponse.status),
    `Expected / to return 200/307/308, got ${rootResponse.status}`,
    failures,
  );

  if ([307, 308].includes(rootResponse.status)) {
    pushFailureUnless(
      rootResponse.location === "/en",
      `Expected / redirect location to be /en, got ${rootResponse.location ?? "(missing)"}`,
      failures,
    );
  }

  pushFailureUnless(
    [307, 308].includes(invalidLocaleResponse.status),
    `Expected /invalid/contact to redirect, got ${invalidLocaleResponse.status}`,
    failures,
  );
  pushFailureUnless(
    invalidLocaleResponse.location === "/en/contact",
    `Expected /invalid/contact redirect location to be /en/contact, got ${invalidLocaleResponse.location ?? "(missing)"}`,
    failures,
  );

  for (const response of pages) {
    pushFailureUnless(
      response.status === 200,
      `Expected ${response.pathname} to return 200, got ${response.status}`,
      failures,
    );
  }

  if (failures.length > 0) {
    console.error("[post-deploy-smoke] Failures detected:");
    for (const failure of failures) {
      console.error(`  - ${failure}`);
    }
    return false;
  }

  if (retryEvents.length > 0) {
    console.warn("[post-deploy-smoke] Retried probes:");
    for (const retry of retryEvents) {
      console.warn(
        `  - ${retry.pathname}: ${retry.reason}; next attempt ${retry.nextAttempt}/${DEPLOY_SMOKE_REQUEST_RETRIES + 1}`,
      );
    }
  }

  console.log("[post-deploy-smoke] All checks passed");
  return true;
}

function runChildCommand(command, args) {
  return spawnSync(command, args, {
    cwd: ROOT,
    stdio: "pipe",
    encoding: "utf8",
    env: process.env,
  });
}

function extractCloudflarePreviewDeploymentUrls(output) {
  const urls = [];
  for (const match of output.matchAll(CF_PREVIEW_DEPLOY_URL_PATTERN)) {
    urls.push({
      worker: "native",
      url: match[0] ?? "",
    });
  }
  if (urls.length > 0) return urls;

  return [...new Set(output.match(CF_PREVIEW_URL_PATTERN) ?? [])].map(
    (url) => ({
      worker: "unknown",
      url,
    }),
  );
}

function chooseCloudflarePreviewGatewayUrl(urls) {
  const explicitGateway = urls.find((item) => item.worker === "native");
  if (explicitGateway) return explicitGateway.url;
  return urls.at(-1)?.url ?? null;
}

function writeCloudflarePreviewProofResult(result) {
  fs.mkdirSync(path.dirname(CF_PREVIEW_PROOF_OUTPUT_PATH), {
    recursive: true,
  });
  fs.writeFileSync(
    CF_PREVIEW_PROOF_OUTPUT_PATH,
    JSON.stringify(result, null, 2),
  );
}

function printCloudflarePreviewProofOutput(label, result) {
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  console.log(
    `[proof:cf:preview-deployed] ${label} exit=${result.status ?? 1}`,
  );
}

function runCloudflarePreviewDeployedProof() {
  const deployResult = runChildCommand("pnpm", CF_PREVIEW_DEPLOY_COMMAND);
  const deployOutput = `${deployResult.stdout ?? ""}\n${deployResult.stderr ?? ""}`;
  printCloudflarePreviewProofOutput("deploy", deployResult);
  const deployCommand = `pnpm ${CF_PREVIEW_DEPLOY_COMMAND.join(" ")}`;

  if (/MISSING_MESSAGE/iu.test(deployOutput)) {
    const result = {
      status: "fail",
      stage: "deploy-log",
      generatedAt: new Date().toISOString(),
      command: deployCommand,
      reason: "next-intl MISSING_MESSAGE detected during preview proof",
    };
    writeCloudflarePreviewProofResult(result);
    console.log(JSON.stringify(result, null, 2));
    return 1;
  }

  if (deployResult.status !== 0) {
    const result = {
      status: "blocked",
      stage: "deploy",
      generatedAt: new Date().toISOString(),
      command: deployCommand,
      reason: "preview deploy failed or credentials are unavailable",
    };
    writeCloudflarePreviewProofResult(result);
    console.log(JSON.stringify(result, null, 2));
    return 2;
  }

  const urls = extractCloudflarePreviewDeploymentUrls(deployOutput);
  const baseUrl = chooseCloudflarePreviewGatewayUrl(urls);

  if (!baseUrl) {
    const result = {
      status: "blocked",
      stage: "deploy-output-parse",
      generatedAt: new Date().toISOString(),
      command: deployCommand,
      reason:
        "preview deploy completed but no workers.dev URL was found in output",
      discoveredUrls: urls,
    };
    writeCloudflarePreviewProofResult(result);
    console.log(JSON.stringify(result, null, 2));
    return 2;
  }

  const smokeArgs = [
    "scripts/starter-checks.js",
    "deployed-smoke",
    "--base-url",
    baseUrl,
  ];
  const smokeResult = runChildCommand("node", smokeArgs);
  printCloudflarePreviewProofOutput("smoke", smokeResult);

  const result = {
    status: smokeResult.status === 0 ? "pass" : "fail",
    stage: smokeResult.status === 0 ? "complete" : "smoke",
    generatedAt: new Date().toISOString(),
    baseUrl,
    discoveredUrls: urls,
    deployCommand,
    smokeCommand: `node ${smokeArgs.join(" ")}`,
  };
  writeCloudflarePreviewProofResult(result);
  console.log(JSON.stringify(result, null, 2));

  return smokeResult.status ?? 1;
}

// ---------------------------------------------------------------------------
// CLI routing
// ---------------------------------------------------------------------------

function printUsage() {
  console.error(`Usage: node scripts/starter-checks.js <command> [options]

Commands:
  truth-docs          Check current truth docs and release runbook order
  brand               Check old brand residue
  content-slugs       Check localized MDX slug pairs
  content-manifest    Generate content manifest and static MDX import map
  translations        Check split critical/deferred translation shapes
  validate-production-config Validate production and public-launch config gates
  eslint-disable      Check eslint-disable exception hygiene
  component-governance Check component registry, Storybook, and UI wrapper drift
  content-readiness   Check buyer-visible starter residue
  client-boundary     Check top-level use client budget
  cf-preview-smoke    Probe local Cloudflare preview behavior
  deployed-smoke      Probe deployed URL route health
  cf-preview-deployed Deploy preview workers and run deployed smoke
  cf-official-compare Check Cloudflare source/generated deploy config contract
  release-verify      Run full release verification flow
`);
}

async function main(argv = process.argv.slice(2)) {
  const [command, ...args] = argv;

  let ok;
  switch (command) {
    case "truth-docs":
      ok = runTruthDocsCheck();
      break;
    case "brand":
      ok = runBrandCheck();
      break;
    case "content-slugs":
      ok = runContentSlugCheck(args);
      break;
    case "content-manifest":
      ok = runContentManifestGenerator();
      break;
    case "translations":
      ok = runTranslationCheck();
      break;
    case "validate-production-config":
      ok = runValidateProductionConfigCli();
      break;
    case "eslint-disable":
      ok = runEslintDisableCheck();
      break;
    case "component-governance":
      ok = runComponentGovernanceCli();
      break;
    case "content-readiness":
      ok = runContentReadinessCli();
      break;
    case "client-boundary":
      ok = runClientBoundaryCli();
      break;
    case "cf-preview-smoke":
      ok = await runCloudflarePreviewSmoke(args);
      break;
    case "deployed-smoke":
      ok = await runDeployedSmoke(args);
      break;
    case "cf-preview-deployed":
      ok = runCloudflarePreviewDeployedProof();
      break;
    case "cf-official-compare":
      ok = runCloudflareOfficialCompareCli(args);
      break;
    case "release-verify":
      ok = runReleaseVerify();
      break;
    case "--help":
    case "-h":
      printUsage();
      ok = true;
      break;
    default:
      printUsage();
      ok = false;
  }

  if (typeof ok === "number") {
    process.exitCode = ok;
  } else if (!ok) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error("[starter-checks] Unexpected error:", error);
    process.exit(1);
  });
}

module.exports = {
  CHECKS: TRUTH_DOC_CHECKS,
  RELEASE_PROOF_SEQUENCE,
  analyzeFile,
  analyzeSource,
  buildKey,
  collectClientBoundaryFiles,
  collectCloudflareOfficialCompareFailures,
  collectComponentGovernanceFindings,
  collectContentReadinessFindings,
  collectCurrentTruthDocFindings,
  collectLeafPaths,
  collectPairs,
  collectRegisteredGuardrailExceptionIds,
  compareLocales,
  findCommandLineIndex,
  findOutOfOrderCommand,
  generateContentManifest,
  getActiveGuardrailExceptionSection,
  hasTopLevelUseClientDirective,
  isProductionFile,
  isStructuralGuardrailExemptPath,
  isTestFile,
  parseArgs: parseContentSlugArgs,
  parseFrontmatter,
  parseGuardrailException,
  runBrandCheck,
  runCloudflareOfficialCompareCli,
  runCloudflarePreviewDeployedProof,
  runCloudflarePreviewSmoke,
  runClientBoundaryBudgetCheck,
  runComponentGovernanceCli,
  runContentManifestGenerator,
  runContentReadinessCheck,
  runContentSlugCheck,
  runDeployedSmoke,
  runEslintDisableCheck,
  runReleaseVerify,
  runTranslationCheck,
  runValidateProductionConfigCli,
  STRUCTURAL_GUARDRAIL_RULES,
  shouldValidateProductionRuntimeContract,
  validateContentFrontmatterContract,
  validateCollectionPair,
  validateLocale,
  validateMdxSlugSync,
  validateProductionConfig,
  validateProductionRuntimeContract,
  validatePublicLaunchTrustContent,
};
