import { isValidElement } from "react";
import { expect, it, vi } from "vitest";
import { contentSourcePlugin } from "@/content-source";
import { pressContext } from "./harness";
import { AstroContent } from "@/island/serialize";

// it reads the config of the integration
vi.mock("@fumadocs/astro/source", () => ({ NoProcessedMarkdownError: class extends Error {} }));

it("leaves pages to the plugins of their content source", async () => {
  const data = { title: "Home", content: "%% raw %%", load: async () => ({}) };
  const ctx = await pressContext(
    {
      content: { docs: { files: [{ type: "page" as const, path: "index.md", data }] } },
      plugins: [{ getPageText: () => "rendered" }],
    },
    { defaults: [contentSourcePlugin()] },
  );
  const [page] = (await ctx.getLoader()).getPages();

  expect(await ctx.getPageText(page!)).toBe("rendered");
});

it("serves the page tree of each language at a URL by its content", async () => {
  async function treeRoutes(title: string) {
    const data = { title, load: async () => ({}) };
    const ctx = await pressContext(
      {
        content: { docs: { files: [{ type: "page" as const, path: "index.md", data }] } },
        i18n: { languages: ["en", "fr"], defaultLanguage: "en" },
      },
      { base: "/", defaults: [contentSourcePlugin()] },
    );
    const source = await ctx.getLoader();
    const paths: string[] = [];
    for (const [i, route] of (await ctx.getApiRoutes()).entries()) {
      const response = await route.GET!(new Request("http://localhost"), { params: {} });
      const locale = ["en", "fr"][i];
      expect(await response.json()).toEqual(
        await source.serializePageTree(source.getPageTree(locale)),
      );
      expect(route.path).toMatch(
        new RegExp(`^/_fumapress/page-tree/${locale}\\.[0-9a-f]{16}\\.json$`),
      );
      paths.push(route.path);
    }
    return paths;
  }

  const paths = await treeRoutes("Home");
  expect(paths).toHaveLength(2);
  expect(await treeRoutes("Home")).toEqual(paths);
  expect((await treeRoutes("Other"))[0]).not.toBe(paths[0]);

  // on request, also a route
  const ctx = await pressContext(
    {
      mode: "dynamic",
      content: {
        docs: { files: [{ type: "page" as const, path: "index.md", data: { title: "Home" } }] },
      },
      i18n: { languages: ["en", "fr"], defaultLanguage: "en" },
    },
    { base: "/docs", defaults: [contentSourcePlugin()] },
  );
  const routes = await ctx.getApiRoutes();
  expect(routes.map((route) => route.render)).toEqual(["dynamic", "dynamic"]);
  expect(routes.map((route) => route.path)).toEqual(paths);
  const tree = await routes[1]!.GET!(new Request("http://localhost"), { params: {} });
  expect(tree.headers.get("Content-Type")).toBe("application/json");
  expect(tree.headers.get("Cache-Control")).toContain("immutable");
});

it("renders collection pages as their `<Content />`, dated by the `date` frontmatter", async () => {
  const Content = () => new Response();
  const data = {
    title: "Post",
    date: "2026-11-04",
    getText: async () => "",
    load: async () => ({ body: Content, toc: [] }),
  };
  const ctx = await pressContext(
    {
      content: { docs: { files: [{ type: "page" as const, path: "post.mdx", data }] } },
    },
    { base: "/", defaults: [contentSourcePlugin()] },
  );
  const [page] = (await ctx.getLoader()).getPages();
  const body = await ctx.getPageBody(page!);

  expect(isValidElement(body?.node) && body.node.type).toBe(AstroContent);
  expect(body?.node).toHaveProperty("props.component", Content);
  expect(await ctx.getPageCreatedAt(page!)).toEqual(new Date("2026-11-04"));
});
