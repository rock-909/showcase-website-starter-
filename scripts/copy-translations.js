/**
 * Copy Translation Files to Public Directory
 *
 * This script copies translation files from messages/ to public/messages/
 * with JSON compression (removing whitespace) to reduce file size.
 *
 * Usage:
 *   node scripts/copy-translations.js
 *
 * This script is automatically run as a prebuild step in package.json.
 */

const fs = require("fs").promises;
const fsSync = require("fs");
const path = require("path");

/**
 * Configuration
 */
const CONFIG = {
  locales: require("../i18n-locales.config").locales,
  types: ["critical", "deferred"],
  sourceDir: path.join(__dirname, "..", "messages"),
  targetDir: path.join(__dirname, "..", "public", "messages"),
};

/**
 * Copy and compress a single translation file
 * @param {string} locale - Locale code (e.g., 'en', 'zh')
 * @param {string} type - Translation type (e.g., 'critical', 'deferred')
 * @returns {Promise<void>}
 */
async function copyTranslationFile(locale, type) {
  const srcPath = path.join(CONFIG.sourceDir, locale, `${type}.json`);
  const destPath = path.join(CONFIG.targetDir, locale, `${type}.json`);

  try {
    // Read source file
    const contentStr = await fs.readFile(srcPath, "utf-8");
    const content = JSON.parse(contentStr);

    // Ensure destination directory exists
    const destDir = path.dirname(destPath);
    if (!fsSync.existsSync(destDir)) {
      await fs.mkdir(destDir, { recursive: true });
    }

    // Write compressed JSON (no spaces)
    const compressedJson = JSON.stringify(content);
    await fs.writeFile(destPath, compressedJson, "utf-8");

    // Get file sizes for reporting
    const srcStats = await fs.stat(srcPath);
    const destStats = await fs.stat(destPath);
    const savedBytes = srcStats.size - destStats.size;
    const savedPercent = ((savedBytes / srcStats.size) * 100).toFixed(1);

    console.log(
      `✅ Copied ${locale}/${type}.json (${srcStats.size} → ${destStats.size} bytes, saved ${savedPercent}%)`,
    );
  } catch (error) {
    console.error(`❌ Failed to copy ${locale}/${type}.json:`, error.message);
    throw error;
  }
}

/**
 * Main execution function
 */
async function copyTranslations() {
  console.log("📦 Copying translation files to public directory...\n");

  let totalSrcSize = 0;
  let totalDestSize = 0;

  try {
    // Copy all translation files
    for (const locale of CONFIG.locales) {
      for (const type of CONFIG.types) {
        await copyTranslationFile(locale, type);

        // Accumulate sizes for summary
        const srcPath = path.join(CONFIG.sourceDir, locale, `${type}.json`);
        const destPath = path.join(CONFIG.targetDir, locale, `${type}.json`);
        const srcStats = await fs.stat(srcPath);
        const destStats = await fs.stat(destPath);
        totalSrcSize += srcStats.size;
        totalDestSize += destStats.size;
      }
    }

    // Print summary
    const totalSaved = totalSrcSize - totalDestSize;
    const totalSavedPercent = ((totalSaved / totalSrcSize) * 100).toFixed(1);

    console.log("\n📊 Summary:");
    console.log(`   Total source size: ${totalSrcSize} bytes`);
    console.log(`   Total output size: ${totalDestSize} bytes`);
    console.log(`   Total saved: ${totalSaved} bytes (${totalSavedPercent}%)`);
    console.log("\n✅ All translation files copied successfully!");
  } catch (error) {
    console.error("\n❌ Copy failed:", error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  copyTranslations().catch((error) => {
    console.error("❌ Unexpected error:", error);
    process.exit(1);
  });
}

module.exports = { copyTranslations };
