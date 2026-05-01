import { existsSync } from "node:fs";
import path from "node:path";
import { config as loadDotenv } from "dotenv";

const LOCAL_ENV_FILES = [".env.local", ".env"];

function resolveEnvFile(rootDir, envFile) {
  return path.isAbsolute(envFile) ? envFile : path.join(rootDir, envFile);
}

export function loadLocalEnv(
  rootDir = process.cwd(),
  { allowDefault = true, envFile = null } = {},
) {
  const candidates = envFile
    ? [resolveEnvFile(rootDir, envFile)]
    : allowDefault
      ? LOCAL_ENV_FILES.map((fileName) => path.join(rootDir, fileName))
      : [];
  const loaded = [];

  for (const filePath of candidates) {
    if (!existsSync(filePath)) {
      if (envFile) {
        throw new Error(`Explicit env file not found: ${filePath}`);
      }
      continue;
    }

    const result = loadDotenv({
      path: filePath,
      override: false,
      quiet: true,
    });
    if (result.error) {
      throw new Error(
        `Failed to parse env file ${filePath}: ${result.error.message}`,
      );
    }
    loaded.push(path.relative(rootDir, filePath));
  }

  return loaded;
}
