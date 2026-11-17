import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { expect, test } from "vitest";
import press, { type PressOptions } from "../src/vite";
import { parseFrontmatter } from "../src/vite/frontmatter";
import { lastCommitDates } from "../src/vite/git";
import { compareRoutes, scanCollection, toRoutePath } from "../src/vite/scan";

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

test("a collection lists its pages and meta files, without `_` files and the ones its filter rejects", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "press-scan-"));
  const files: Record<string, string> = {
    "index.mdx": "---\ntitle: Home\n---\n",
    "draft.mdx": "---\ntitle: Draft\ndraft: true\n---\n",
    "_note.mdx": "A partial",
    "_shared/usage.mdx": "A partial in a folder",
    "_shared/meta.json": "{}",
    "guide/meta.json": '{ "title": "Guide" }',
  };
  for (const [file, content] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(dir, file)), { recursive: true });
    await writeFile(path.join(dir, file), content);
  }

  const paths = async (filter?: Parameters<typeof scanCollection>[1]) =>
    (await scanCollection(dir, filter)).map((file) => file.path);
  expect(await paths()).toEqual(["draft.mdx", "guide/meta.json", "index.mdx"]);
  expect(await paths((file) => !file.data.draft)).toEqual(["guide/meta.json", "index.mdx"]);
  await rm(dir, { recursive: true });
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

test("a site without the default theme imports nothing of it, and needs a theme module", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "press-theme-"));
  const plugin = pluginOf({ defaultTheme: false }, "fumapress:vue");
  await plugin.config({ root }, { command: "build" });
  expect(() => plugin.configResolved({ command: "build" })).toThrow(
    "`defaultTheme: false` needs a theme module with a `Layout`",
  );

  await mkdir(path.join(root, "src"));
  await writeFile(path.join(root, "src/theme.ts"), "export default {};");
  plugin.configResolved({ command: "build" });
  const theme: string = plugin.load("\0virtual:press/theme");
  expect(theme).not.toContain('"@fumapress/vue/theme"');
  expect(theme).toContain("has no `Layout`");
  await rm(root, { recursive: true });
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
