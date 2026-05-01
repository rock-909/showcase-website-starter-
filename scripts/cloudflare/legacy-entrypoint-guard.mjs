#!/usr/bin/env node

const commandName = process.argv[2] ?? "legacy Cloudflare entrypoint";

console.error(
  `[cloudflare] ${commandName} is disabled because it uses the old single-worker Wrangler entrypoint.`,
);
console.error(
  "[cloudflare] Use phase6 instead: pnpm deploy:cf:phase6:preview, pnpm deploy:cf:phase6:production, or pnpm deploy:cf:phase6:dry-run.",
);

process.exit(1);
