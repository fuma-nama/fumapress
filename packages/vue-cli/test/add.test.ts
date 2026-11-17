import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, expect, test } from "vitest";
import { add, listUnits, type Project } from "../src/add";

const packageDir = fileURLToPath(new URL("../../vue", import.meta.url));
const dirs: string[] = [];

function project(): Project {
  const root = mkdtempSync(path.join(tmpdir(), "fumapress-vue-"));
  dirs.push(root);
  return {
    root,
    packageDir,
    uiDir: path.join(root, "src/ui"),
    themeDir: path.join(root, "src/theme"),
  };
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

test("lists the theme and the modules of the UI, a module with the ones inside it", () => {
  const units = listUnits(packageDir);
  expect(units[0]).toBe("theme");
  expect(units).toEqual(
    expect.arrayContaining(["layouts/docs", "layouts/shared", "components/card", "provider/base"]),
  );
  // the slots and the page of a layout come with it
  expect(units.some((unit) => unit.startsWith("layouts/docs/"))).toBe(false);
  // a folder starting with `.` is internal
  expect(units.some((unit) => unit.split("/").some((part) => part.startsWith(".")))).toBe(false);
});

test("a copy imports an internal module from the package", () => {
  const target = project();
  add(target, ["i18n"]);
  expect(readFileSync(path.join(target.uiDir, "i18n/index.ts"), "utf8")).toContain(
    'from "@fumapress/vue/ui/.translations"',
  );
});

test("names the modules of the package that import a copy nothing imports", () => {
  const target = project();
  add(target, ["theme"]);
  // the theme gets the card from `mdx`, which imports the card of the package
  const card = add(target, ["components/card"]);
  expect(card.relinked).toEqual([]);
  expect(card.unused).toEqual({ "components/card": ["mdx"] });

  const mdx = add(target, ["mdx"]);
  expect(mdx.unused).toEqual({});
  expect(readFileSync(path.join(target.uiDir, "mdx/index.ts"), "utf8")).toContain(
    'from "../components/card"',
  );
  expect(readFileSync(path.join(target.themeDir, "components.ts"), "utf8")).toContain(
    'from "../ui/mdx"',
  );
});

test("a copy a file of the project imports is used", () => {
  const target = project();
  mkdirSync(path.join(target.root, "src/pages"), { recursive: true });
  writeFileSync(
    path.join(target.root, "src/pages/home.vue"),
    '<script setup>\nimport { Card } from "../ui/components/card";\n</script>\n',
  );
  expect(add(target, ["components/card"]).unused).toEqual({});
  // the theme is loaded by the site
  expect(add(target, ["theme"]).unused).toEqual({});
});

test("every module can be copied: what it imports from outside is a module of the package", () => {
  for (const unit of listUnits(packageDir)) {
    expect(() => add(project(), [unit]), unit).not.toThrow();
  }
});

test("a copy imports the rest of the UI from the package", () => {
  const target = project();
  const { written } = add(target, ["layouts/docs"]);
  expect(written.length).toBeGreaterThan(10);

  const body = readFileSync(path.join(target.uiDir, "layouts/docs/client/LayoutBody.vue"), "utf8");
  // outside the module: by the name of the package
  expect(body).toContain('from "@fumapress/vue/ui/contexts/tree"');
  expect(body).toContain('from "@fumapress/vue/ui/layouts/shared/client"');
  // inside it: as it was
  expect(body).toContain('from "../slots/container"');
});

test("copies use each other: files copied before import the new copy", () => {
  const target = project();
  add(target, ["theme"]);
  const layout = path.join(target.themeDir, "Layout.vue");
  expect(readFileSync(layout, "utf8")).toContain('from "@fumapress/vue/ui/layouts/docs"');
  expect(readFileSync(path.join(target.themeDir, "style.css"), "utf8")).toContain(
    '@import "@fumapress/vue/style/neutral.css"',
  );

  const { relinked } = add(target, ["layouts/docs"]);
  expect(relinked).toContain(layout);
  const code = readFileSync(layout, "utf8");
  expect(code).toContain('from "../ui/layouts/docs"');
  expect(code).toContain('from "../ui/layouts/docs/page"');
  // a module the project has no copy of stays the one of the package
  expect(readFileSync(path.join(target.themeDir, "Root.vue"), "utf8")).toContain(
    'from "@fumapress/vue/ui/provider/base"',
  );
});

test("leaves the theme of the project alone: it is not a copy of the default one", () => {
  const target = project();
  mkdirSync(target.themeDir, { recursive: true });
  const root = path.join(target.themeDir, "Root.vue");
  const code = '<script setup>\nimport { Root } from "@fumapress/vue/theme";\n</script>\n';
  writeFileSync(root, code);
  writeFileSync(path.join(target.themeDir, "index.ts"), "export default {};\n");

  const { relinked } = add(target, ["components/card"]);
  expect(relinked).toEqual([]);
  expect(readFileSync(root, "utf8")).toBe(code);
});

test("keeps the files of the project, unless told to overwrite", () => {
  const target = project();
  add(target, ["components/card"]);
  const again = add(target, ["components/card"]);
  expect(again.written).toEqual([]);
  expect(again.skipped.length).toBeGreaterThan(0);
  expect(add(target, ["components/card"], { overwrite: true }).written.length).toBe(
    again.skipped.length,
  );
});

test("names the packages the copies import that the project lacks", () => {
  const target = project();
  writeFileSync(
    path.join(target.root, "package.json"),
    JSON.stringify({ dependencies: { vue: "^3.5.0", "@lucide/vue": "^1.0.0" } }),
  );
  const { missing } = add(target, ["components/ui/button", "components/ui/collapsible"]);
  // with the version the UI is written for, and without what the project has
  // the primitives of Reka UI come from the package, so they are nothing to install
  expect(Object.keys(missing)).toEqual(["class-variance-authority"]);
  expect(missing["class-variance-authority"]).toMatch(/^\^?\d/);
});

test("refuses to copy the theme next to a theme module that would hide it", () => {
  const target = project();
  mkdirSync(path.join(target.root, "src"));
  writeFileSync(path.join(target.root, "src/theme.ts"), "export default {};\n");
  expect(() => add(target, ["theme"])).toThrow("src/theme.ts is the theme module of this site");
  expect(() => add(target, ["theme"])).toThrow(
    "Move it into the folder, for example to src/theme/own.ts, and update its relative imports",
  );
});

test("refuses an internal module", () => {
  expect(() => add(project(), [".translations"])).toThrow(
    '".translations" is not a module of the UI',
  );
});

test("refuses a name that is not a module", () => {
  expect(() => add(project(), ["layouts/nope"])).toThrow(
    '"layouts/nope" is not a module of the UI',
  );
});
