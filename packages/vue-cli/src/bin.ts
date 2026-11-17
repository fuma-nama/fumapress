#!/usr/bin/env node
import path from "node:path";
import { parseArgs } from "node:util";
import { add, installCommand, listUnits, resolveProject } from "./add";

const help = `Copies the UI of @fumapress/vue into your project, to change it.

Usage
  fumapress-vue list                 the modules you can copy
  fumapress-vue add <module...>      copy modules of the UI, like \`layouts/docs\` or \`components/card\`
  fumapress-vue add theme            copy the default theme: the base theme, the docs and home layouts, and the layouts the project imports

A copy imports the rest of the UI from the package, and your other copies from your project.

Options
  --dir <path>         where modules go (default: src/ui)
  --theme-dir <path>   where the theme goes (default: src/theme)
  --overwrite          replace files that exist
  --cwd <path>         the project (default: the current folder)
`;

function main(): number {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      dir: { type: "string" },
      "theme-dir": { type: "string" },
      overwrite: { type: "boolean", default: false },
      cwd: { type: "string" },
      help: { type: "boolean", short: "h", default: false },
    },
  });
  const [command, ...names] = positionals;
  if (values.help || !command) {
    console.log(help);
    return command || values.help ? 0 : 1;
  }

  const root = path.resolve(values.cwd ?? process.cwd());
  const project = resolveProject(root, { uiDir: values.dir, themeDir: values["theme-dir"] });
  const show = (file: string) => path.relative(root, file);

  if (command === "list") {
    console.log(listUnits(project.packageDir).join("\n"));
    return 0;
  }
  if (command !== "add" || names.length === 0) {
    console.error(help);
    return 1;
  }

  const result = add(project, names, { overwrite: values.overwrite });
  for (const file of result.written) console.log(`+ ${show(file)}`);
  for (const file of result.relinked) console.log(`~ ${show(file)} (now imports your copy)`);
  for (const file of result.skipped)
    console.log(`  ${show(file)} exists, kept (--overwrite replaces it)`);

  const packages = Object.entries(result.missing).map(([name, range]) => `${name}@${range}`);
  if (packages.length > 0) {
    console.log(
      `\nYour copies import packages your project doesn't depend on yet. Add them:\n  ${installCommand(root)} ${packages.join(" ")}`,
    );
  }

  for (const [unit, dependents] of Object.entries(result.unused)) {
    const next =
      dependents.length > 0
        ? `Copy a module that imports it, or import it from a file of your project:\n${dependents.map((name) => `  fumapress-vue add ${name}`).join("\n")}`
        : "Import it from a file of your project.";
    console.log(
      `\nNothing in your project imports your copy of ${unit} yet, so your site doesn't use it. ${next}`,
    );
  }
  return 0;
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
