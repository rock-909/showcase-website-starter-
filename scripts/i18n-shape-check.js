/**
 * i18n Shape Consistency Check
 *
 * Goals:
 * 1) Ensure messages/{locale}/critical.json and deferred.json are the canonical split source
 * 2) Ensure en/critical.json keys match zh/critical.json keys (and same for deferred)
 * 3) Ensure public/messages/{locale}/{critical,deferred}.json union equals messages/{locale}/{critical,deferred}.json union
 * 4) If flat files exist, ensure they are a generated parity view of split union
 *
 * Exit code: 0 on success, 1 on any mismatch
 *
 * CI Integration:
 * - Run via `pnpm i18n:shape:check` as blocking gate
 * - Outputs structured JSON report to reports/i18n-shape-report.json
 * - Console output provides human-readable summary
 */

const fs = require("fs");
const fsp = require("fs").promises;
const path = require("path");
const {
  LOCALES,
  asSet,
  collectLeafPaths,
  diffSets,
  getLocaleSplitPaths,
  readJson,
} = require("./translation-flat-utils");

const ROOT = path.join(__dirname, "..");
const REPORT_DIR = path.join(ROOT, "reports");
const REPORT_PATH = path.join(REPORT_DIR, "i18n-shape-report.json");

async function ensureDir(p) {
  if (!fs.existsSync(p)) {
    await fsp.mkdir(p, { recursive: true });
  }
}

/**
 * Compare split files (critical/deferred) between en and zh locales.
 * This ensures type safety as the types are derived from en/*.json files.
 */
async function compareSplitFiles(result, locales) {
  const splitTypes = ["critical", "deferred"];

  for (const splitType of splitTypes) {
    const splitData = {};

    for (const locale of locales) {
      const { critical, deferred } = getLocaleSplitPaths(locale);
      const filePath = splitType === "critical" ? critical : deferred;
      try {
        splitData[locale] = await readJson(filePath);
      } catch (err) {
        result.ok = false;
        result.issues.push({
          type: "file-read-error",
          locale,
          file: `${splitType}.json`,
          message: `Failed to read messages/${locale}/${splitType}.json: ${err.message}`,
        });
        return;
      }
    }

    // Compare en vs zh for this split type
    const enKeys = asSet(collectLeafPaths(splitData.en));
    const zhKeys = asSet(collectLeafPaths(splitData.zh));

    const enMinusZh = diffSets(enKeys, zhKeys);
    const zhMinusEn = diffSets(zhKeys, enKeys);

    if (enMinusZh.length || zhMinusEn.length) {
      result.ok = false;
      result.issues.push({
        type: `${splitType}-shape-mismatch`,
        message: `messages/en/${splitType}.json and messages/zh/${splitType}.json leaf key sets differ`,
        missingInZh: enMinusZh.slice(0, 50),
        missingInEn: zhMinusEn.slice(0, 50),
        missingInZhCount: enMinusZh.length,
        missingInEnCount: zhMinusEn.length,
      });
    }
  }
}

async function main() {
  const startTime = Date.now();
  const result = {
    ok: true,
    timestamp: new Date().toISOString(),
    duration: 0,
    summary: {
      totalChecks: 0,
      passedChecks: 0,
      failedChecks: 0,
    },
    issues: [],
  };

  try {
    // Check 1: Compare split files (critical/deferred) between locales
    result.summary.totalChecks += 2; // critical + deferred
    const issueCountBefore = result.issues.length;
    await compareSplitFiles(result, LOCALES);
    const newIssues = result.issues.length - issueCountBefore;
    result.summary.passedChecks += 2 - newIssues;
    result.summary.failedChecks += newIssues;

    // Check 2+: For each locale, validate split canonical source
    for (const locale of LOCALES) {
      const {
        critical: srcCriticalPath,
        deferred: srcDeferredPath,
        flat,
      } = getLocaleSplitPaths(locale);
      const pubCriticalPath = path.join(
        ROOT,
        "public",
        "messages",
        locale,
        "critical.json",
      );
      const pubDeferredPath = path.join(
        ROOT,
        "public",
        "messages",
        locale,
        "deferred.json",
      );

      const srcCritical = await readJson(srcCriticalPath);
      const srcDeferred = await readJson(srcDeferredPath);

      const srcSet = asSet([
        ...collectLeafPaths(srcCritical),
        ...collectLeafPaths(srcDeferred),
      ]);

      // Check 2: public vs src split (optional if public not generated yet)
      const hasPubCritical = fs.existsSync(pubCriticalPath);
      const hasPubDeferred = fs.existsSync(pubDeferredPath);
      if (hasPubCritical && hasPubDeferred) {
        result.summary.totalChecks++;
        const pubCritical = await readJson(pubCriticalPath);
        const pubDeferred = await readJson(pubDeferredPath);
        const pubSet = asSet([
          ...collectLeafPaths(pubCritical),
          ...collectLeafPaths(pubDeferred),
        ]);

        const pubMinusSrc = diffSets(pubSet, srcSet);
        const srcMinusPub = diffSets(srcSet, pubSet);
        if (pubMinusSrc.length || srcMinusPub.length) {
          result.ok = false;
          result.summary.failedChecks++;
          result.issues.push({
            type: "public-vs-src-split-mismatch",
            locale,
            message: `public/messages/${locale}/{critical,deferred}.json union != messages/${locale}/{critical,deferred}.json union`,
            extraInPublic: pubMinusSrc.slice(0, 50),
            missingInPublic: srcMinusPub.slice(0, 50),
            extraInPublicCount: pubMinusSrc.length,
            missingInPublicCount: srcMinusPub.length,
          });
        } else {
          result.summary.passedChecks++;
        }
      } else {
        console.warn(
          `[i18n-shape-check] public/messages/${locale} not found; skip public parity sub-check`,
        );
      }

      // Check 3: flat file parity (optional generated compatibility artifact)
      if (fs.existsSync(flat)) {
        result.summary.totalChecks++;
        const flatData = await readJson(flat);
        const flatSet = asSet(collectLeafPaths(flatData));
        const srcMinusFlat = diffSets(srcSet, flatSet);
        const flatMinusSrc = diffSets(flatSet, srcSet);

        if (srcMinusFlat.length || flatMinusSrc.length) {
          result.ok = false;
          result.summary.failedChecks++;
          result.issues.push({
            type: "flat-generated-parity-mismatch",
            locale,
            message: `messages/${locale}.json is not aligned with messages/${locale}/{critical,deferred}.json union`,
            missingInFlat: srcMinusFlat.slice(0, 50),
            extraInFlat: flatMinusSrc.slice(0, 50),
            missingInFlatCount: srcMinusFlat.length,
            extraInFlatCount: flatMinusSrc.length,
          });
        } else {
          result.summary.passedChecks++;
        }
      }
    }

    result.duration = Date.now() - startTime;

    await ensureDir(REPORT_DIR);
    await fsp.writeFile(REPORT_PATH, JSON.stringify(result, null, 2), "utf-8");

    // Output summary
    console.log("\n=== i18n Shape Check Report ===");
    console.log(`Timestamp: ${result.timestamp}`);
    console.log(`Duration: ${result.duration}ms`);
    console.log(
      `Checks: ${result.summary.passedChecks}/${result.summary.totalChecks} passed`,
    );

    if (!result.ok) {
      console.error("\n❌ i18n shape check failed");
      console.error(`\nIssues found: ${result.issues.length}`);
      for (const issue of result.issues) {
        console.error(
          "\n-",
          issue.type,
          issue.locale ? `(locale: ${issue.locale})` : "",
        );
        console.error("  ", issue.message);
        if (issue.missingInZhCount)
          console.error("  Missing in zh:", issue.missingInZhCount, "keys");
        if (issue.missingInEnCount)
          console.error("  Missing in en:", issue.missingInEnCount, "keys");
        if (issue.missingInSplitCount !== undefined)
          console.error(
            "  Missing in split:",
            issue.missingInSplitCount,
            "keys",
          );
        if (issue.extraInSplitCount !== undefined)
          console.error("  Extra in split:", issue.extraInSplitCount, "keys");
        if (issue.missingInPublicCount !== undefined)
          console.error(
            "  Missing in public:",
            issue.missingInPublicCount,
            "keys",
          );
        if (issue.extraInPublicCount !== undefined)
          console.error("  Extra in public:", issue.extraInPublicCount, "keys");
        if (issue.missingInFlatCount !== undefined)
          console.error("  Missing in flat:", issue.missingInFlatCount, "keys");
        if (issue.extraInFlatCount !== undefined)
          console.error("  Extra in flat:", issue.extraInFlatCount, "keys");

        // Show sample keys for debugging
        if (issue.missingInZh?.length) {
          console.error(
            "  Sample missing in zh:",
            issue.missingInZh.slice(0, 5).join(", "),
          );
        }
        if (issue.missingInEn?.length) {
          console.error(
            "  Sample missing in en:",
            issue.missingInEn.slice(0, 5).join(", "),
          );
        }
      }
      console.error(`\nReport saved to: ${REPORT_PATH}`);
      process.exit(1);
    } else {
      console.log("\n✅ i18n shape check passed");
      console.log(`Report saved to: ${REPORT_PATH}`);
      process.exit(0);
    }
  } catch (err) {
    result.duration = Date.now() - startTime;
    console.error("❌ i18n shape check crashed:", err?.message || err);
    try {
      await ensureDir(REPORT_DIR);
      await fsp.writeFile(
        REPORT_PATH,
        JSON.stringify(
          {
            ok: false,
            timestamp: result.timestamp,
            duration: result.duration,
            crash: String(err),
            stack: err?.stack,
          },
          null,
          2,
        ),
        "utf-8",
      );
    } catch {
      // Report file write is best-effort; exit with error regardless
    }
    process.exit(1);
  }
}

main();
