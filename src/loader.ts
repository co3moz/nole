import * as fs from "fs";
import * as path from "path";

/**
 * Mirrors Node's own resolution: explicit extensions win, otherwise the nearest
 * package.json "type" decides. Missing or unreadable means CommonJS.
 */
export function isEsmFile(file: string): boolean {
  if (file.endsWith(".mts") || file.endsWith(".mjs")) return true;
  if (file.endsWith(".cts") || file.endsWith(".cjs")) return false;

  let dir = path.dirname(file);

  while (true) {
    const pkgPath = path.join(dir, "package.json");

    if (fs.existsSync(pkgPath)) {
      try {
        return JSON.parse(fs.readFileSync(pkgPath).toString()).type === "module";
      } catch {
        return false;
      }
    }

    const parent = path.dirname(dir);
    if (parent === dir) return false;
    dir = parent;
  }
}

const CONFIG_NAMES = [
  "nole.config.ts",
  "nole.config.mts",
  "nole.config.cts",
  "nole.config.js",
  "nole.config.mjs",
  "nole.config.cjs",
];

/** Finds the config file next to the working directory, if there is one. */
export function findConfigFile(cwd = process.cwd()): string | null {
  for (const name of CONFIG_NAMES) {
    const candidate = path.join(cwd, name);

    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}
