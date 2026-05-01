#!/usr/bin/env node

const {
  LOCALES,
  loadLocaleSplit,
  writeFlatTranslation,
} = require("./translation-flat-utils");

function main() {
  for (const locale of LOCALES) {
    const { merged, flat } = loadLocaleSplit(locale);
    writeFlatTranslation(locale, merged);
    console.log(`Regenerated flat translation from split source: ${flat}`);
  }
}

main();
