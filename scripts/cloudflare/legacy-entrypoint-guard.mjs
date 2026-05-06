#!/usr/bin/env node

const commandName = process.argv[2] ?? "legacy Cloudflare entrypoint";

console.error(
  `[cloudflare] ${commandName} is disabled because it uses the old single-worker Wrangler entrypoint.`,
);
console.error(
  "[cloudflare] Use the stable Cloudflare commands instead: pnpm deploy:cf:preview, pnpm deploy:cf, or pnpm deploy:cf:dry-run.",
);

process.exit(1);
