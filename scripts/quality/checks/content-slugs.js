const fs = require("node:fs");
const path = require("node:path");
const matter = require("gray-matter");
const { glob } = require("glob");
const yaml = require("js-yaml");

const DEFAULT_COLLECTIONS = ["posts", "pages", "products"];
const DEFAULT_LOCALES = ["en", "zh"];
const REPORT_DIR = "reports";
const CONTENT_SLUG_REPORT_FILENAME = "content-slug-sync-report.json";
const matterOptions = {
  engines: {
    yaml: {
      parse: (str) => yaml.load(str),
      stringify: (obj) => yaml.dump(obj),
    },
  },
};

function buildKey(rootDir, filePath, collection, locale) {
  const localeRoot = path.join(rootDir, "content", collection, locale);
  const relative = path.relative(localeRoot, filePath);
  return `${collection}/${relative.replace(/\\/g, "/")}`;
}

function parseFrontmatter(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const { data } = matter(content, matterOptions);

    if (!data || typeof data.slug !== "string") {
      return {
        slug: null,
        error: "frontmatter.slug is missing or not a string",
      };
    }

    return { slug: data.slug, error: null };
  } catch (err) {
    return { slug: null, error: `Failed to parse: ${err.message}` };
  }
}

function collectPairs(rootDir, collection, baseLocale, targetLocale) {
  const basePattern = path.join(
    rootDir,
    "content",
    collection,
    baseLocale,
    "**/*.mdx",
  );
  const targetPattern = path.join(
    rootDir,
    "content",
    collection,
    targetLocale,
    "**/*.mdx",
  );
  const pairMap = new Map();

  for (const filePath of glob.sync(basePattern)) {
    const key = buildKey(rootDir, filePath, collection, baseLocale);
    const entry = pairMap.get(key) || {};
    entry.basePath = filePath;
    pairMap.set(key, entry);
  }

  for (const filePath of glob.sync(targetPattern)) {
    const key = buildKey(rootDir, filePath, collection, targetLocale);
    const entry = pairMap.get(key) || {};
    entry.targetPath = filePath;
    pairMap.set(key, entry);
  }

  return pairMap;
}

function validateCollectionPair(rootDir, collection, baseLocale, targetLocale) {
  const issues = [];
  const pairMap = collectPairs(rootDir, collection, baseLocale, targetLocale);
  let fileCount = 0;

  for (const [, { basePath, targetPath }] of pairMap) {
    fileCount += (basePath ? 1 : 0) + (targetPath ? 1 : 0);

    if (!basePath || !targetPath) {
      const missingLocale = !basePath ? baseLocale : targetLocale;
      const existingPath = basePath || targetPath;
      issues.push({
        type: "missing_pair",
        collection,
        baseLocale,
        targetLocale,
        basePath,
        targetPath,
        message: `Missing ${missingLocale} counterpart for: ${path.basename(existingPath)}`,
      });
      continue;
    }

    const baseResult = parseFrontmatter(basePath);
    const targetResult = parseFrontmatter(targetPath);

    if (baseResult.error || targetResult.error) {
      issues.push({
        type: "parse_error",
        collection,
        baseLocale,
        targetLocale,
        basePath,
        targetPath,
        message: "Failed to parse frontmatter.slug",
        error: baseResult.error || targetResult.error,
      });
      continue;
    }

    if (baseResult.slug !== targetResult.slug) {
      issues.push({
        type: "slug_mismatch",
        collection,
        baseLocale,
        targetLocale,
        basePath,
        targetPath,
        baseSlug: baseResult.slug,
        targetSlug: targetResult.slug,
        message: `Slug mismatch: "${baseResult.slug}" (${baseLocale}) vs "${targetResult.slug}" (${targetLocale})`,
      });
    }
  }

  return {
    issues,
    pairCount: pairMap.size,
    fileCount,
  };
}

function validateMdxSlugSync(options) {
  const {
    rootDir,
    collections = DEFAULT_COLLECTIONS,
    locales = DEFAULT_LOCALES,
    baseLocale = locales[0],
  } = options;
  const issues = [];
  const targetLocales = locales.filter((locale) => locale !== baseLocale);
  let totalFiles = 0;
  let totalPairs = 0;

  for (const collection of collections) {
    for (const targetLocale of targetLocales) {
      const result = validateCollectionPair(
        rootDir,
        collection,
        baseLocale,
        targetLocale,
      );
      issues.push(...result.issues);
      totalFiles += result.fileCount;
      totalPairs += result.pairCount;
    }
  }

  return {
    ok: issues.length === 0,
    checkedCollections: collections,
    checkedLocales: locales,
    issues,
    stats: {
      totalFiles,
      totalPairs,
      missingPairs: issues.filter((issue) => issue.type === "missing_pair")
        .length,
      slugMismatches: issues.filter((issue) => issue.type === "slug_mismatch")
        .length,
      parseErrors: issues.filter((issue) => issue.type === "parse_error")
        .length,
    },
  };
}

function parseContentSlugArgs(args) {
  const options = {
    json: false,
    quiet: false,
    help: false,
    collections: DEFAULT_COLLECTIONS,
    locales: DEFAULT_LOCALES,
  };

  for (const arg of args) {
    if (arg === "--json") {
      options.json = true;
    } else if (arg === "--quiet") {
      options.quiet = true;
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg.startsWith("--collections=")) {
      options.collections = arg
        .split("=")[1]
        .split(",")
        .flatMap((item) => {
          const trimmed = item.trim();
          return trimmed ? [trimmed] : [];
        });
    } else if (arg.startsWith("--locales=")) {
      options.locales = arg
        .split("=")[1]
        .split(",")
        .flatMap((item) => {
          const trimmed = item.trim();
          return trimmed ? [trimmed] : [];
        });
    }
  }

  return options;
}

function printContentSlugHelp() {
  console.log(`
MDX Content Slug Sync Validator

Usage:
  node scripts/starter-checks.js content-slugs [options]

Options:
  --json              Output JSON report to reports/content-slug-sync-report.json
  --collections=x,y   Collections to check (default: posts,pages,products)
  --locales=x,y       Locales to check (default: en,zh)
  --quiet             Only output errors
  --help, -h          Show this help

Examples:
  node scripts/starter-checks.js content-slugs
  node scripts/starter-checks.js content-slugs --json
  node scripts/starter-checks.js content-slugs --collections=products --locales=en,zh,ja
`);
}

function printContentSlugSummary(result, options) {
  console.log("\nMDX Slug Sync Validation");
  console.log("========================\n");

  if (!options.quiet) {
    console.log(`Collections: ${result.checkedCollections.join(", ")}`);
    console.log(`Locales: ${result.checkedLocales.join(", ")}`);
    console.log(`Total files: ${result.stats.totalFiles}`);
    console.log(`Total pairs: ${result.stats.totalPairs}\n`);
  }

  if (result.ok) {
    console.log("All slug validations passed.\n");
    return;
  }

  const missingPairs = result.issues.filter(
    (issue) => issue.type === "missing_pair",
  );
  if (missingPairs.length > 0) {
    console.log(`Missing Pairs (${missingPairs.length}):`);
    for (const issue of missingPairs) {
      const existingFile = issue.basePath || issue.targetPath;
      const missingLocale = issue.basePath
        ? issue.targetLocale
        : issue.baseLocale;
      console.log(
        `   - [${issue.collection}] ${path.basename(existingFile)} (missing ${missingLocale})`,
      );
    }
    console.log("");
  }

  const slugMismatches = result.issues.filter(
    (issue) => issue.type === "slug_mismatch",
  );
  if (slugMismatches.length > 0) {
    console.log(`Slug Mismatches (${slugMismatches.length}):`);
    for (const issue of slugMismatches) {
      console.log(
        `   - [${issue.collection}] ${path.basename(issue.basePath)}`,
      );
      console.log(`     ${issue.baseLocale}: "${issue.baseSlug}"`);
      console.log(`     ${issue.targetLocale}: "${issue.targetSlug}"`);
    }
    console.log("");
  }

  const parseErrors = result.issues.filter(
    (issue) => issue.type === "parse_error",
  );
  if (parseErrors.length > 0) {
    console.log(`Parse Errors (${parseErrors.length}):`);
    for (const issue of parseErrors) {
      const file = issue.basePath || issue.targetPath;
      console.log(`   - [${issue.collection}] ${path.basename(file)}`);
      if (issue.error) console.log(`     Error: ${issue.error}`);
    }
    console.log("");
  }

  console.log("Summary:");
  console.log(`   Missing pairs: ${result.stats.missingPairs}`);
  console.log(`   Slug mismatches: ${result.stats.slugMismatches}`);
  console.log(`   Parse errors: ${result.stats.parseErrors}`);
  console.log(`   Total issues: ${result.issues.length}\n`);
}

function writeContentSlugJsonReport(result, rootDir) {
  const reportDir = path.join(rootDir, REPORT_DIR);
  const reportPath = path.join(reportDir, CONTENT_SLUG_REPORT_FILENAME);

  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        tool: "content-slug-sync",
        version: "1.0.0",
        ...result,
      },
      null,
      2,
    ),
  );
  console.log(`JSON report saved to: ${reportPath}\n`);
}

function runContentSlugCheck(args = [], rootDir = process.cwd()) {
  const options = parseContentSlugArgs(args);
  if (options.help) {
    printContentSlugHelp();
    return true;
  }
  if (options.collections.length === 0) {
    console.error("Error: No collections specified");
    return false;
  }
  if (options.locales.length < 2) {
    console.error("Error: At least 2 locales are required for comparison");
    return false;
  }

  const result = validateMdxSlugSync({
    rootDir,
    collections: options.collections,
    locales: options.locales,
  });
  printContentSlugSummary(result, options);
  if (options.json) writeContentSlugJsonReport(result, rootDir);

  return result.ok;
}

module.exports = {
  DEFAULT_COLLECTIONS,
  DEFAULT_LOCALES,
  buildKey,
  collectPairs,
  parseContentSlugArgs,
  parseFrontmatter,
  printContentSlugHelp,
  printContentSlugSummary,
  runContentSlugCheck,
  validateCollectionPair,
  validateMdxSlugSync,
  writeContentSlugJsonReport,
};
