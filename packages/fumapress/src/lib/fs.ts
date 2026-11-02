import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";

/**
 * Requires the nearest `package.json` to declare `"type": "module"`.
 */
export function assertEsmApp(startDir = process.cwd()): void {
  let dir = startDir;
  while (true) {
    const pkgPath = join(dir, "package.json");
    let pkg: { type?: string } | undefined;
    try {
      pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    } catch {}

    if (pkg && pkg.type !== "module") {
      throw new Error(`Fumapress apps must be ES modules: add '"type": "module"' to ${pkgPath}.`);
    }

    if (pkg) return;

    const parent = dirname(dir);
    if (parent === dir) return;
    dir = parent;
  }
}

/**
 * Returns the absolute path to the root directory of the current git repository.
 */
export function getGitRootDir(startDir = process.cwd()): string | null {
  let dir = startDir;
  while (true) {
    if (existsSync(join(dir, ".git"))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      break; // reached filesystem root
    }
    dir = parent;
  }

  return null;
}
