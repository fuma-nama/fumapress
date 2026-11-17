import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const PACKAGE = "@fumapress/vue";
/** the default theme: a unit like the modules of the UI, copied to its own folder */
const THEME = "theme";

export interface Project {
  /** the folder of the project, with its `package.json` */
  root: string;
  /** the folder of `@fumapress/vue`, the source of the UI */
  packageDir: string;
  /** where modules of the UI are copied: a module keeps its path in it */
  uiDir: string;
  /** where the default theme is copied */
  themeDir: string;
}

export interface AddResult {
  /** files written, by absolute path */
  written: string[];
  /** files kept because they exist, by absolute path */
  skipped: string[];
  /** files of the project now importing a copy instead of the package */
  relinked: string[];
  /** the packages the copies import that the project doesn't depend on, with the version the UI is written for */
  missing: Record<string, string>;
}

const toPosix = (file: string) => file.split(path.sep).join("/");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir).sort()) {
    const file = path.join(dir, name);
    if (statSync(file).isDirectory()) walk(file, out);
    else out.push(file);
  }
  return out;
}

export function resolveProject(
  root: string,
  options: { uiDir?: string; themeDir?: string } = {},
): Project {
  let manifest: string;
  try {
    manifest = createRequire(path.join(root, "package.json")).resolve(`${PACKAGE}/package.json`);
  } catch {
    throw new Error(`${PACKAGE} is not installed in ${root}.`);
  }
  return {
    root,
    packageDir: path.dirname(manifest),
    uiDir: path.resolve(root, options.uiDir ?? "src/ui"),
    themeDir: path.resolve(root, options.themeDir ?? "src/theme"),
  };
}

/**
 * The units a project can copy: the theme, and the modules of the UI. A module is a folder with an `index.ts`, and
 * the modules inside it come with it, like the slots of a layout.
 */
export function listUnits(packageDir: string): string[] {
  const units: string[] = [];
  const visit = (dir: string, name: string) => {
    if (existsSync(path.join(dir, "index.ts"))) {
      units.push(name);
      return;
    }
    for (const child of readdirSync(dir).sort()) {
      const file = path.join(dir, child);
      if (statSync(file).isDirectory()) visit(file, name ? `${name}/${child}` : child);
    }
  };
  visit(path.join(packageDir, "ui"), "");
  return [THEME, ...units];
}

const sourceOf = (project: Project, unit: string) =>
  unit === THEME ? path.join(project.packageDir, THEME) : path.join(project.packageDir, "ui", unit);

const targetOf = (project: Project, unit: string) =>
  unit === THEME ? project.themeDir : path.join(project.uiDir, unit);

/** how files import others: `from "x"`, `import "x"`, `import("x")`, and `@import "x"` in CSS */
const IMPORT = /(\bfrom\s*|\bimport\s*\(?\s*|@import\s+)(["'])([^"'\n]+)\2/g;

/** the package specifier of a file of the package: the folder of a module, or a file of `css/` or `theme/` */
function specifierOf(project: Project, file: string): string | undefined {
  const relative = toPosix(path.relative(project.packageDir, file));
  if (relative.startsWith("ui/")) {
    if (existsSync(path.join(file, "index.ts"))) return `${PACKAGE}/${relative}`;
    return;
  }
  if (relative === THEME) return `${PACKAGE}/${THEME}`;
  if (relative.startsWith("css/") || relative.startsWith(`${THEME}/`)) {
    return `${PACKAGE}/${relative}`;
  }
  // the compiled stylesheets are exported without `dist`
  if (relative.startsWith("dist/style/")) return `${PACKAGE}/${relative.slice("dist/".length)}`;
}

/** a file of a unit for the project: an import leaving the unit goes to the package, by name */
function detach(project: Project, unit: string, file: string, code: string): string {
  const root = sourceOf(project, unit);

  return code.replace(IMPORT, (match, before: string, quote: string, specifier: string) => {
    if (!specifier.startsWith(".")) return match;
    const target = path.resolve(path.dirname(file), specifier);
    if (target === root || target.startsWith(root + path.sep)) return match;

    const name = specifierOf(project, target);
    if (!name) {
      throw new Error(
        `${toPosix(path.relative(project.packageDir, file))} imports "${specifier}", which is not a module of ${PACKAGE}.`,
      );
    }
    return `${before}${quote}${name}${quote}`;
  });
}

/**
 * The path of a module of the UI in the project, when the project has a copy of it. Only modules of the UI: a
 * project's own theme folder is not a copy of the default theme.
 */
function localCopy(project: Project, name: string): string | undefined {
  if (!name.startsWith("ui/")) return;
  const dir = path.join(project.uiDir, name.slice(3));
  return existsSync(path.join(dir, "index.ts")) ? dir : undefined;
}

/** a file of the project: an import of the package goes to the copy of the project, when it has one */
function relink(project: Project, file: string, code: string): string {
  return code.replace(IMPORT, (match, before: string, quote: string, specifier: string) => {
    if (!specifier.startsWith(`${PACKAGE}/`)) return match;
    const copy = localCopy(project, specifier.slice(PACKAGE.length + 1));
    if (!copy) return match;

    const relative = toPosix(path.relative(path.dirname(file), copy));
    return `${before}${quote}${relative.startsWith(".") ? relative : `./${relative}`}${quote}`;
  });
}

/**
 * Copies units of the UI into a project. A copy imports the rest of the UI from the package, and from the project
 * where it has a copy: so are the files copied before, which now use the new copies.
 */
export function add(
  project: Project,
  units: string[],
  options: { overwrite?: boolean } = {},
): AddResult {
  const known = new Set(listUnits(project.packageDir));
  for (const unit of units) {
    if (!known.has(unit)) {
      throw new Error(
        `"${unit}" is not a module of the UI. Run \`fumapress-vue list\` to see them.`,
      );
    }
  }

  if (units.includes(THEME)) {
    // `src/theme.ts` and `src/theme/index.ts` are the same import: the file wins, and the copy would never load
    const show = (file: string) => toPosix(path.relative(project.root, file));
    const module = [".ts", ".js"]
      .map((extension) => project.themeDir + extension)
      .find((file) => existsSync(file));
    if (module) {
      throw new Error(
        `${show(module)} is the theme module of this site, and it is loaded instead of ${show(project.themeDir)}/index.ts.\nRename it, for example to ${show(project.themeDir)}/own.ts, run this again, then add what it exports to ${show(project.themeDir)}/index.ts.`,
      );
    }
  }

  const result: AddResult = { written: [], skipped: [], relinked: [], missing: {} };
  for (const unit of units) {
    const source = sourceOf(project, unit);
    for (const file of walk(source)) {
      const target = path.join(targetOf(project, unit), path.relative(source, file));
      if (existsSync(target) && !options.overwrite) {
        result.skipped.push(target);
        continue;
      }
      mkdirSync(path.dirname(target), { recursive: true });
      const text = /\.(ts|vue|css)$/.test(file);
      writeFileSync(
        target,
        text ? detach(project, unit, file, readFileSync(file, "utf8")) : readFileSync(file),
      );
      result.written.push(target);
    }
  }

  // every copy of the project, old and new, uses the copies of the project
  const dirs = [project.uiDir, project.themeDir].filter((dir) => existsSync(dir));
  for (const file of dirs.flatMap((dir) => walk(dir))) {
    if (!/\.(ts|vue|css)$/.test(file)) continue;
    const code = readFileSync(file, "utf8");
    const next = relink(project, file, code);
    if (next === code) continue;
    writeFileSync(file, next);
    if (!result.written.includes(file)) result.relinked.push(file);
  }

  result.missing = missingPackages(project, result.written);
  return result;
}

function readManifest(dir: string): Record<string, Record<string, string> | undefined> {
  const file = path.join(dir, "package.json");
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
}

/**
 * The packages files of the project import without the project depending on them. The UI is source in the project
 * now, so what was a dependency of the package is one of the project.
 */
function missingPackages(project: Project, files: string[]): Record<string, string> {
  const own = readManifest(project.root);
  const ofPackage = readManifest(project.packageDir);
  const has = (name: string) =>
    Boolean(
      own.dependencies?.[name] ?? own.devDependencies?.[name] ?? own.peerDependencies?.[name],
    );
  const missing: Record<string, string> = {};

  for (const file of files) {
    if (!/\.(ts|vue)$/.test(file)) continue;
    for (const [, , , specifier = ""] of readFileSync(file, "utf8").matchAll(IMPORT)) {
      if (/^(\.|node:|virtual:)/.test(specifier)) continue;
      const name = specifier.split("/", specifier.startsWith("@") ? 2 : 1).join("/");
      if (name === PACKAGE || has(name)) continue;
      const range =
        ofPackage.dependencies?.[name] ??
        ofPackage.peerDependencies?.[name] ??
        ofPackage.devDependencies?.[name];
      // a type-only or optional import the package doesn't ship is not something to install
      if (range) missing[name] = range;
    }
  }
  return missing;
}
