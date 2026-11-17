// Compiles the script of every `.vue` file of `ui/` and `theme/` the way a site without TypeScript does: the types of
// props are read from the file system, and a type that needs TypeScript to be found or read fails.
//
//   node scripts/check-sfc.mjs
import { readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compileScript, parse, registerTS } from "vue/compiler-sfc";
import { typeResolver } from "../src/vite/type-resolver.ts";

// what the Vite plugin registers for a site without TypeScript
registerTS(() => typeResolver);

const root = fileURLToPath(new URL("..", import.meta.url));
const fs = {
  fileExists: (file) => statSync(file, { throwIfNoEntry: false })?.isFile() ?? false,
  readFile: (file) => readFileSync(file, "utf8"),
  realpath: realpathSync,
};

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const file = path.join(dir, name);
    if (statSync(file).isDirectory()) walk(file, out);
    else if (name.endsWith(".vue")) out.push(file);
  }
  return out;
}

const files = [...walk(path.join(root, "ui")), ...walk(path.join(root, "theme"))];
let failed = 0;
for (const file of files) {
  const { descriptor } = parse(readFileSync(file, "utf8"), { filename: file });
  if (!descriptor.script && !descriptor.scriptSetup) continue;
  try {
    compileScript(descriptor, { id: file, fs });
  } catch (error) {
    failed++;
    console.log(`${path.relative(root, file)}\n  ${String(error.message).split("\n")[0]}`);
  }
}

console.log(`${files.length} files, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
