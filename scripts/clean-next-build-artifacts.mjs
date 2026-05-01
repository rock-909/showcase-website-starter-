import { existsSync, mkdirSync, renameSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const targets = [".next", ".open-next", ".wrangler/tmp"];
const trashRoot = resolve(root, ".trash-next-artifacts");
const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "");
const moved = [];

for (const target of targets) {
  const source = resolve(root, target);
  if (!existsSync(source)) {
    continue;
  }

  mkdirSync(trashRoot, { recursive: true });

  const trashName = `showcase-${target.replace(/[/.]/g, "-")}-${stamp}`;
  let destination = resolve(trashRoot, trashName);
  let suffix = 1;

  while (existsSync(destination)) {
    suffix += 1;
    destination = resolve(trashRoot, `${trashName}-${suffix}`);
  }

  renameSync(source, destination);
  moved.push(`${target} -> ${destination}`);
}

console.log(
  moved.length === 0
    ? `[clean-next-build-artifacts] no build artifacts found in ${root}`
    : `[clean-next-build-artifacts] moved to local artifact trash:\n${moved.join("\n")}`,
);
