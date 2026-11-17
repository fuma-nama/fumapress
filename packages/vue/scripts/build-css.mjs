// Compiles the stylesheet of the UI for each color theme of `css/`, to `dist/style/<theme>.css`: Tailwind CSS runs
// here, so a site doesn't install it. A site that wants Tailwind CSS compiles the same sources itself.
//
//   node scripts/build-css.mjs
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compile, optimize } from "@tailwindcss/node";
import { Scanner } from "@tailwindcss/oxide";

const root = fileURLToPath(new URL("..", import.meta.url));
const cssDir = path.join(root, "css");
const outDir = path.join(root, "dist/style");
mkdirSync(outDir, { recursive: true });

const themes = readdirSync(cssDir)
  .filter((name) => name.endsWith(".css") && name !== "default.css" && name !== "preset.css")
  .map((name) => name.slice(0, -4));

for (const theme of themes) {
  // only the classes of the UI: `preset.css` names its sources, and nothing else is scanned
  const input = `@import "tailwindcss" source(none);\n@import "./${theme}.css";\n@import "./preset.css";\n`;
  const compiler = await compile(input, { base: cssDir, onDependency() {} });
  const scanner = new Scanner({ sources: compiler.sources });
  const { code } = optimize(compiler.build(scanner.scan()), { minify: true });
  writeFileSync(path.join(outDir, `${theme}.css`), code);
}
console.log(`${themes.length} stylesheets in dist/style`);
