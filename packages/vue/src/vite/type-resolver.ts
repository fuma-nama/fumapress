import { existsSync } from "node:fs";
import { createRequire } from "node:module";

/**
 * What the Vue compiler asks of TypeScript: the file of a type imported from a package. Without TypeScript, Node
 * finds it: the source file an export points to (the UI modules of this package), or the declarations next to it.
 */
export const typeResolver = {
  findConfigFile: () => undefined,
  resolveModuleName(source: string, containingFile: string) {
    let resolvedFileName: string | undefined;
    try {
      const file = createRequire(containingFile).resolve(source);
      const types = file.replace(/\.[cm]?js$/, ".d.ts");
      if (/\.(ts|vue)$/.test(file)) resolvedFileName = file;
      else if (existsSync(types)) resolvedFileName = types;
    } catch {
      // not installed: the compiler reports the import
    }
    return { resolvedModule: resolvedFileName ? { resolvedFileName } : undefined };
  },
};
