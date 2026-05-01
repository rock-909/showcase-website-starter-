#!/usr/bin/env node

/**
 * Translation Validation Script
 *
 * Validates the split canonical translation inputs:
 * 1. Contain all required keys
 * 2. Have no duplicate keys
 * 3. Have consistent structure across all locales
 *
 * Usage: node scripts/validate-translations.js
 */

const fs = require("fs");
const {
  LOCALES,
  asSet,
  collectLeafPaths,
  getLocaleSplitPaths,
  readJson,
} = require("./translation-flat-utils");

/**
 * Validate translations for a specific locale
 */
function validateLocale(locale) {
  console.log(`\n📦 Validating split canonical locale: ${locale}`);

  const { critical: criticalPath, deferred: deferredPath } =
    getLocaleSplitPaths(locale);

  // Check if files exist
  if (!fs.existsSync(criticalPath)) {
    console.error(`   ❌ Error: critical.json not found: ${criticalPath}`);
    return false;
  }

  if (!fs.existsSync(deferredPath)) {
    console.error(`   ❌ Error: deferred.json not found: ${deferredPath}`);
    return false;
  }

  // Read files
  const critical = readJson(criticalPath);
  const deferred = readJson(deferredPath);

  // Get all keys
  const criticalKeys = collectLeafPaths(critical);
  const deferredKeys = collectLeafPaths(deferred);

  console.log(`   Critical keys: ${criticalKeys.length}`);
  console.log(`   Deferred keys: ${deferredKeys.length}`);
  console.log(`   Total keys: ${criticalKeys.length + deferredKeys.length}`);

  // Check for duplicate keys
  const criticalSet = asSet(criticalKeys);
  const deferredSet = asSet(deferredKeys);

  const deferredDuplicates = criticalKeys.filter((key) => deferredSet.has(key));

  if (deferredDuplicates.length > 0) {
    console.error(
      `   ❌ Error: Found ${deferredDuplicates.length} duplicate keys:`,
    );
    deferredDuplicates
      .slice(0, 10)
      .forEach((key) => console.error(`      - ${key}`));
    if (deferredDuplicates.length > 10) {
      console.error(`      ... and ${deferredDuplicates.length - 10} more`);
    }
    return false;
  }

  console.log(`   ✅ No duplicate keys found`);

  return {
    locale,
    criticalKeys: criticalSet,
    deferredKeys: deferredSet,
    totalKeys: criticalKeys.length + deferredKeys.length,
  };
}

/**
 * Compare keys across locales
 */
function compareLocales(localeData) {
  console.log("\n🔍 Comparing locales...");

  const locales = Object.keys(localeData);

  if (locales.length < 2) {
    console.log("   ⚠️  Only one locale found, skipping comparison");
    return true;
  }

  const [firstLocale, ...otherLocales] = locales;
  const firstData = localeData[firstLocale];

  let allMatch = true;

  for (const locale of otherLocales) {
    const data = localeData[locale];

    // Check if total keys match
    if (data.totalKeys !== firstData.totalKeys) {
      console.error(
        `   ❌ Error: ${locale} has ${data.totalKeys} keys, but ${firstLocale} has ${firstData.totalKeys} keys`,
      );
      allMatch = false;
      continue;
    }

    // Check if all keys match
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
        `   ❌ Error: ${locale} is missing ${missingInLocale.length} keys:`,
      );
      missingInLocale
        .slice(0, 5)
        .forEach((key) => console.error(`      - ${key}`));
      if (missingInLocale.length > 5) {
        console.error(`      ... and ${missingInLocale.length - 5} more`);
      }
      allMatch = false;
    }

    if (extraInLocale.length > 0) {
      console.error(
        `   ❌ Error: ${locale} has ${extraInLocale.length} extra keys:`,
      );
      extraInLocale
        .slice(0, 5)
        .forEach((key) => console.error(`      - ${key}`));
      if (extraInLocale.length > 5) {
        console.error(`      ... and ${extraInLocale.length - 5} more`);
      }
      allMatch = false;
    }

    if (missingInLocale.length === 0 && extraInLocale.length === 0) {
      console.log(`   ✅ ${locale} matches ${firstLocale}`);
    }
  }

  return allMatch;
}

/**
 * Main execution
 */
function main() {
  console.log("🚀 Translation Validation (split canonical)");
  console.log("==========================");

  const localeData = {};
  let allValid = true;

  // Validate each locale
  for (const locale of LOCALES) {
    const result = validateLocale(locale);

    if (!result) {
      allValid = false;
    } else {
      localeData[locale] = result;
    }
  }

  if (!allValid) {
    console.error("\n❌ Validation failed!\n");
    process.exit(1);
  }

  // Compare locales
  const localesMatch = compareLocales(localeData);

  if (!localesMatch) {
    console.error("\n❌ Locales do not match!\n");
    process.exit(1);
  }

  console.log("\n✅ All validations passed!");
  console.log("\nSummary:");
  console.log("--------");

  for (const [locale, data] of Object.entries(localeData)) {
    console.log(
      `${locale.toUpperCase()}: ${data.totalKeys} total keys (${data.criticalKeys.size} critical + ${data.deferredKeys.size} deferred)`,
    );
  }

  console.log(
    "\n💡 Translation files are valid and consistent across all locales.\n",
  );
}

// Run the script
if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

module.exports = { validateLocale, compareLocales, collectLeafPaths };
