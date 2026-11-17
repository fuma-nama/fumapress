import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { expect, test } from "vitest";
import press, { type PressOptions } from "../src/vite";
import { parseFrontmatter } from "../src/vite/frontmatter";
import { lastCommitDates } from "../src/vite/git";
import { compareRoutes, toRoutePath } from "../src/vite/scan";

const run = promisify(execFile);

test("maps page files to route paths", () => {
  expect(toRoutePath("index.vue")).toBe("/");
  expect(toRoutePath("about.vue")).toBe("/about");
  expect(toRoutePath("blog/index.vue")).toBe("/blog");
  expect(toRoutePath("blog/[slug].vue")).toBe("/blog/[slug]");
  expect(toRoutePath("files/[...path].vue")).toBe("/files/[...path]");

  // a page with a fixed path is matched before one with a param, and a rest param last
  expect(
    ["/[...path]", "/[slug]", "/about", "/blog/[slug]", "/blog/new", "/"].sort(compareRoutes),
  ).toEqual(["/", "/about", "/blog/new", "/blog/[slug]", "/[slug]", "/[...path]"]);
});

test("reads when each file last changed from one git log", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "press-git-"));
  const git = (...args: string[]) =>
    run("git", args, {
      cwd: dir,
      env: {
        ...process.env,
        GIT_AUTHOR_DATE: "2026-01-02T03:04:05Z",
        GIT_COMMITTER_DATE: "2026-05-06T00:00:00Z",
      },
    });
  await mkdir(path.join(dir, "content/guide"), { recursive: true });
  await writeFile(path.join(dir, "content/guide/install.mdx"), "Install");
  await writeFile(path.join(dir, "outside.mdx"), "Outside");
  await git("init", "-q");
  await git("add", ".");
  await git("-c", "user.name=a", "-c", "user.email=a@b.c", "commit", "-q", "-m", "first");
  await writeFile(path.join(dir, "content/new.mdx"), "Not committed");

  const content = path.join(dir, "content");
  expect(Object.fromEntries(await lastCommitDates(content))).toEqual({
    [path.join(content, "guide/install.mdx")]: "2026-01-02T03:04:05.000Z",
  });
  // outside a repository: no dates
  expect((await lastCommitDates(tmpdir())).size).toBe(0);
  await rm(dir, { recursive: true });
});

/** a plugin of `press()` by name */
function pluginOf(options: PressOptions, name: string): any {
  const plugins = (press(options) as unknown[]).flat(Infinity) as { name: string }[];
  return plugins.find((plugin) => plugin.name === name);
}

test("the theme module is used as written, and the default theme without one", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "press-theme-"));
  // the folder of the pages of a site without `press.config`
  await mkdir(path.join(root, "content"));
  const plugin = pluginOf({}, "fumapress:vue");
  await plugin.config({ root }, { command: "build" });
  plugin.configResolved({ command: "build", base: "/", environments: {} });
  expect(plugin.load("\0virtual:press/theme")).toContain(
    'export { default } from "@fumapress/vue/theme/default"',
  );

  await mkdir(path.join(root, "src"));
  await writeFile(path.join(root, "src/theme.ts"), "export default {};");
  const theme: string = plugin.load("\0virtual:press/theme");
  // nothing of the default theme: a theme builds on it with `extends`
  expect(theme).not.toContain("@fumapress/vue/theme/default");
  expect(theme).toContain(`export { default } from ${JSON.stringify(`${root}/src/theme.ts`)}`);
  await rm(root, { recursive: true });
});

test("fails once on an optional peer dependency the site imports without having it", async () => {
  const plugin = pluginOf({}, "fumapress:optional-peers");
  const importer = `${process.cwd()}/node_modules/@fumapress/vue/theme/layouts/Flux.vue?vue&type=script`;
  // what Vite resolves a missing optional peer dependency to
  const missing = {
    resolve: async () => ({ id: "__vite-optional-peer-dep:motion-v:@fumapress/vue" }),
    error(message: string): never {
      throw new Error(message);
    },
  };
  await expect(plugin.resolveId.call(missing, "motion-v", importer, {})).rejects.toThrow(
    '[Fumapress] node_modules/@fumapress/vue/theme/layouts/Flux.vue imports "motion-v", an optional peer dependency of @fumapress/vue that the site doesn\'t have. Install motion-v in the site.',
  );
  // once: the other imports of the build would repeat it
  await expect(plugin.resolveId.call(missing, "motion-v", importer, {})).resolves.toEqual({
    id: "__vite-optional-peer-dep:motion-v:@fumapress/vue",
  });
  // a subpath of another package
  await expect(plugin.resolveId.call(missing, "@orama/core/x", importer, {})).rejects.toThrow(
    "Install @orama/core in the site.",
  );

  // installed, or not a peer dependency: resolved as it is
  const installed = { resolve: async (id: string) => ({ id: `/node_modules/${id}/index.js` }) };
  await expect(plugin.resolveId.call(installed, "motion-v", importer, {})).resolves.toEqual({
    id: "/node_modules/motion-v/index.js",
  });
  await expect(plugin.resolveId.call(missing, "vue", importer, {})).resolves.toBeUndefined();
});

test("adds the options of the site to those of the Vue plugin", () => {
  const isCustomElement = (tag: string) => tag.startsWith("x-");
  const { options } = pluginOf(
    { vue: { template: { compilerOptions: { isCustomElement } } } },
    "vite:vue",
  ).api;
  expect(options.template.compilerOptions.isCustomElement).toBe(isCustomElement);
  // the ones the package needs stay
  expect(options.script.fs).toBeDefined();
  expect(options.compiler.registerTS).toBeTypeOf("function");
});

test("parses frontmatter", () => {
  expect(parseFrontmatter("---\ntitle: Hello\nfull: true\n---\n\n## Body\n")).toEqual({
    data: { title: "Hello", full: true },
    body: "\n## Body\n",
  });
  expect(parseFrontmatter("## No frontmatter\n")).toEqual({
    data: {},
    body: "## No frontmatter\n",
  });
});
