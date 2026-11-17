import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, expect, test } from "vitest";
import press from "../src/vite";
import { checkNoMacros, listPages, readMacros, transformMacros } from "../src/vite/macro";

// The static rules of the macros, as `fumadocs-mdx/macro` has them: a call is read without running the module.

/** a project with the folders of the collections below */
const root = await mkdtemp(path.join(tmpdir(), "press-macros-"));
for (const dir of ["content/docs", "blog"]) await mkdir(path.join(root, dir), { recursive: true });
afterAll(() => rm(root, { recursive: true }));
const file = path.join(root, "press.config.ts");
const imports = `import { defineCollections, defineDocs } from "@fumapress/vue/content";\n`;
const transform = async (code: string) => (await transformMacros(imports + code, file, root))?.code;

test("compiles a call into the creation of its collection from its files", async () => {
  const code = `const docs = defineDocs({ dir: "content/docs", docs: { schema: pageSchema.extend({ date: z.string() }) } });`;
  expect(await transform(code)).toBe(
    imports +
      'const docs = await defineDocs({ dir: "content/docs", docs: { schema: pageSchema.extend({ date: z.string() }) } }, { dir: "content/docs", ' +
      'pages: { frontmatter: import.meta.glob(["./**/*.{md,mdx}","!./**/_*","!./**/_*/**"], {"base":"/content/docs","query":"?frontmatter","import":"default","eager":true}), ' +
      'load: import.meta.glob(["./**/*.{md,mdx}","!./**/_*","!./**/_*/**"], {"base":"/content/docs"}), ' +
      'assets: import.meta.glob(["./**/*.{md,mdx}","!./**/_*","!./**/_*/**"], {"base":"/content/docs","query":"?assets=client","import":"default"}) }, ' +
      'meta: import.meta.glob(["./**/meta{,.*}.json","!./**/_*","!./**/_*/**"], {"base":"/content/docs","import":"default","eager":true}) });',
  );
});

test("reads `files`, `type` and `lastModified` of both macros", async () => {
  const code = await transform(
    [
      "export const docs = defineDocs();",
      'const blog = defineCollections({ type: "doc", dir: "blog/", files: ["**/*.md", "!drafts/**"], lastModified: true, },);',
    ].join("\n"),
  );
  // the default folder, the one of a site without `press.config`, and no options
  expect(code).toContain(
    'export const docs = await defineDocs(undefined, { dir: "content", pages:',
  );
  // the patterns from the folder, and a trailing comma that stays valid
  expect(code).toContain(
    'const blog = await defineCollections({ type: "doc", dir: "blog/", files: ["**/*.md", "!drafts/**"], lastModified: true, }, { dir: "blog", pages: { frontmatter: import.meta.glob(["./**/*.md","!./drafts/**","!./**/_*","!./**/_*/**"]',
  );
  // the dates of git: none outside a repository
  expect(code).toContain("lastModified: {} } },);");
  // a collection of pages has no `meta.json` files
  expect(code!.split("\n")[2]).not.toContain("meta:");

  expect(
    readMacros(
      imports + 'const docs = defineDocs({ dir: "content/docs", docs: { lastModified: true } });',
      file,
      root,
    ),
  ).toEqual([
    {
      dir: "content/docs",
      pages: ["**/*.{md,mdx}"],
      meta: ["**/meta{,.*}.json"],
      lastModified: true,
    },
  ]);
});

test("fails on a folder that doesn't exist, at the call", async () => {
  const missing =
    '2:14: `defineDocs()` reads the folder "content/nope", which doesn\'t exist. `dir` is a folder from the root of the project, "content" by default.';
  await expect(transform('const docs = defineDocs({ dir: "content/nope" });')).rejects.toThrow(
    `[Fumapress] ${file}:${missing}`,
  );
  // the build reads the calls first, to list the pages
  expect(() =>
    readMacros(imports + 'const docs = defineDocs({ dir: "content/nope" });', file, root),
  ).toThrow(missing);
  const empty = await mkdtemp(path.join(tmpdir(), "press-empty-"));
  await expect(
    transformMacros(imports + "const docs = defineDocs();", file, empty),
  ).rejects.toThrow('2:14: `defineDocs()` reads the folder "content", which doesn\'t exist.');
  await rm(empty, { recursive: true });
});

test("fails on a macro outside `press.config`, where nothing compiles it", () => {
  const content = path.join(root, "src/content.ts");
  expect(() => checkNoMacros(`${imports}export const docs = defineDocs();`, content)).toThrow(
    `[Fumapress] ${content}:2:21: \`defineDocs()\` is a macro, compiled in \`press.config\` only: call it there, as the value of a top-level \`const\`.`,
  );
  // its types are not a call
  expect(() =>
    checkNoMacros(
      'import type { DocsOptions } from "@fumapress/vue/content";\nexport const a: DocsOptions<any, any, false> = {};',
      content,
    ),
  ).not.toThrow();
});

test("leaves a module without macro calls as it is", async () => {
  expect(await transformMacros("export const a = 1;", file, root)).toBeUndefined();
  const types = `import type { DocsOptions } from "@fumapress/vue/content";\nconst a: DocsOptions<any, any, false> = {};`;
  expect(await transformMacros(types, file, root)).toBeUndefined();
});

test("maps the compiled module to its source", async () => {
  const result = await transformMacros(imports + "const docs = defineDocs({});", file, root);
  expect(result?.map.sources).toEqual([file]);
  expect(result?.map.mappings).not.toBe("");
});

test("rejects what can't be read without running the module, at its position", async () => {
  const fails = (code: string) => expect(transform(code)).rejects.toThrow();
  const failsWith = (code: string, message: string) =>
    expect(transform(code)).rejects.toThrow(`[Fumapress] ${file}:${message}`);

  await failsWith(
    'const dir = "content";\nconst docs = defineDocs({ dir });',
    "3:27: the `dir` option of a macro must be a string literal, since it affects how content files are bundled. Move dynamic logic into other options like `schema`.",
  );
  await failsWith(
    "const docs = defineDocs({ docs: { files: patterns } });",
    "2:42: the `files` option of a macro must be an array of string literals",
  );
  await failsWith(
    "const docs = defineDocs({ docs: { lastModified: process.env.CI } });",
    "2:49: the `lastModified` option of a macro must be a boolean literal",
  );
  await failsWith(
    "const docs = defineDocs({ ...options, schema: undefined });",
    "2:27: the options of a macro cannot be spread, since its `dir` option affects how content files are bundled.",
  );
  await failsWith(
    "const docs = defineDocs({ docs: options });",
    "2:33: the `docs` option of a macro must be an object literal",
  );
  await failsWith(
    "const docs = defineDocs(options);",
    "2:14: macro calls only accept an inline options object.",
  );
  await failsWith(
    "const docs = defineDocs({}, {});",
    "2:14: macro calls only accept an inline options object.",
  );
  await failsWith(
    "export let docs = defineDocs({});",
    "2:8: a macro collection must be declared with `const`, since `let` bindings can be reassigned.",
  );
  await failsWith(
    "export const { toFumadocsSource } = defineDocs({});",
    "2:14: a macro collection must be assigned to a plain variable (e.g. `const docs = defineDocs({ ... })`), destructuring is not supported.",
  );
  const onlyTopLevel =
    "macros from @fumapress/vue/content can only be called as the initializer of a top-level `const` declaration";
  await failsWith("function create() {\n  return defineDocs({});\n}", `3:10: ${onlyTopLevel}`);
  await failsWith("defineDocs({});", `2:1: ${onlyTopLevel}`);
  await failsWith("export default defineDocs({});", `2:16: ${onlyTopLevel}`);
  await failsWith("const define = defineDocs;", `2:16: ${onlyTopLevel}`);
  await failsWith(
    "const docs = [defineCollections({ type: 'doc', dir: 'a' })];",
    `2:15: ${onlyTopLevel}`,
  );
  await failsWith(
    'const blog = defineCollections({ dir: "blog" });',
    '2:14: defineCollections requires `type: "doc"`.',
  );
  // a collection of `meta.json` files alone can't be joined with pages: they are in `defineDocs()`
  await failsWith(
    'const blog = defineCollections({ type: "meta", dir: "blog" });',
    '2:40: the `type` option of a macro must be "doc"',
  );

  await expect(
    transformMacros('export { defineDocs } from "@fumapress/vue/content";', file, root),
  ).rejects.toThrow(`${file}:1:1: re-exporting from @fumapress/vue/content is not supported.`);
  await expect(
    transformMacros('import * as content from "@fumapress/vue/content";', file, root),
  ).rejects.toThrow(`${file}:1:8: only named imports are supported for @fumapress/vue/content.`);
  // the names of properties and types are not uses of a macro
  await expect(
    transform(
      "const docs = defineDocs({});\nconst a = { defineDocs: 1 }.defineDocs;\ntype T = typeof defineDocs;",
    ),
  ).resolves.toContain("await defineDocs");
  await fails("const docs = defineDocs({ dir: `content/${name}` });");
});

test("lists the pages of a collection like its glob: without `_` files and the patterns starting with `!`", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "press-macro-"));
  const files: Record<string, string> = {
    "index.mdx": "---\ntitle: Home\n---\n",
    "guide/install.md": "---\ntitle: Install\n---\n",
    "drafts/next.mdx": "---\ntitle: Next\n---\n",
    "_note.mdx": "A partial",
    "_shared/usage.mdx": "A partial in a folder",
    "guide/meta.json": '{ "title": "Guide" }',
  };
  for (const [name, content] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(dir, name)), { recursive: true });
    await writeFile(path.join(dir, name), content);
  }

  const list = async (pages: string[]) =>
    (await listPages({ dir: ".", pages, lastModified: false }, dir)).map((name) =>
      path.relative(dir, name),
    );
  expect(await list(["**/*.{md,mdx}"])).toEqual([
    "drafts/next.mdx",
    "guide/install.md",
    "index.mdx",
  ]);
  expect(await list(["**/*.mdx", "!drafts/**"])).toEqual(["index.mdx"]);
  await rm(dir, { recursive: true });
});

/** the core plugin of `press()` */
function corePlugin(): any {
  const plugins = (press() as unknown[]).flat(Infinity) as { name: string }[];
  return plugins.find((plugin) => plugin.name === "fumapress:vue");
}

test("a site without `press.config` is a collection of `content/`, compiled like a config", async () => {
  const site = await mkdtemp(path.join(tmpdir(), "press-default-"));
  await mkdir(path.join(site, "content/_parts"), { recursive: true });
  await writeFile(path.join(site, "content/index.mdx"), "---\ntitle: Home\n---\n");
  await writeFile(path.join(site, "content/_parts/note.mdx"), "A partial");

  const plugin = corePlugin();
  const config = await plugin.config({ root: site }, { command: "build" });
  // each page is an entry of the browser build
  expect(config.environments.client.build.rollupOptions.input.slice(1)).toEqual([
    path.join(site, "content/index.mdx"),
  ]);

  const id = "\0virtual:press/config";
  const code: string = plugin.load(id);
  // the default folder of `defineDocs()`
  expect(code).toContain("const docs = defineDocs();");
  expect(code).toContain("export default createPress(docs.toFumadocsSource());");
  const compiled = await plugin.transform(code, id);
  expect(compiled.code).toContain(
    'const docs = await defineDocs(undefined, { dir: "content", pages:',
  );

  // with `press.config`, its own calls
  await writeFile(
    path.join(site, "press.config.ts"),
    `${imports}const docs = defineDocs({ dir: "docs" });\nexport default createPress(docs.toFumadocsSource());\n`,
  );
  await mkdir(path.join(site, "docs"));
  await writeFile(path.join(site, "docs/a.md"), "---\ntitle: A\n---\n");
  const own = await plugin.config({ root: site }, { command: "build" });
  expect(own.environments.client.build.rollupOptions.input.slice(1)).toEqual([
    path.join(site, "docs/a.md"),
  ]);
  expect(plugin.load(id)).toBe(
    `export { default } from ${JSON.stringify(path.join(site, "press.config.ts"))};\n`,
  );
  expect(await plugin.transform(plugin.load(id), id)).toBeUndefined();
  await rm(site, { recursive: true });
});

test("loads the frontmatter of a page as its own module", async () => {
  const site = await mkdtemp(path.join(tmpdir(), "press-frontmatter-"));
  await writeFile(path.join(site, "page.mdx"), "---\ntitle: Hello\ntags: [a, b]\n---\n\n## Body\n");
  const plugin = corePlugin();
  expect(plugin.load(`${path.join(site, "page.mdx")}?frontmatter`)).toBe(
    'export default {"title":"Hello","tags":["a","b"]};\n',
  );
  await rm(site, { recursive: true });
});
