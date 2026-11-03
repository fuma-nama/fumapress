import { expect, it, vi } from "vitest";
import { createPress, type Context } from "@fumapress/core";
import { contentSourcePlugin } from "@/content-source";

// it reads the config of the integration
vi.mock("@fumadocs/astro/source", () => ({ NoProcessedMarkdownError: class extends Error {} }));

it("leaves pages to the plugins of their content source", async () => {
  const data = { title: "Home", content: "%% raw %%", load: async () => ({}) };
  const ctx = (await createPress(
    {
      content: { docs: { files: [{ type: "page" as const, path: "index.md", data }] } },
      preset: false,
      plugins: [contentSourcePlugin(), { getPageText: () => "rendered" }],
    },
    { base: "/" },
  )) as Context;
  const [page] = (await ctx.getLoader()).getPages();

  expect(await ctx.getPageText(page!)).toBe("rendered");
});

it("serves the page tree of each language at a URL by its content", async () => {
  async function treeRoutes(title: string) {
    const data = { title, load: async () => ({}) };
    const ctx = (await createPress(
      {
        content: { docs: { files: [{ type: "page" as const, path: "index.md", data }] } },
        i18n: { languages: ["en", "fr"], defaultLanguage: "en" },
        preset: false,
        plugins: [contentSourcePlugin()],
      },
      { base: "/" },
    )) as Context;
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

  // on request, by the middleware
  const ctx = (await createPress(
    {
      mode: "dynamic",
      content: {
        docs: { files: [{ type: "page" as const, path: "index.md", data: { title: "Home" } }] },
      },
      i18n: { languages: ["en", "fr"], defaultLanguage: "en" },
      preset: false,
      plugins: [contentSourcePlugin()],
    },
    { base: "/docs" },
  )) as Context;
  expect(await ctx.getApiRoutes()).toEqual([]);
  const next = async () => new Response(null, { status: 404 });
  const tree = await ctx.handleRequest(new Request(`http://localhost/docs${paths[1]}`), next);
  expect(tree.headers.get("Content-Type")).toBe("application/json");
  const source = await ctx.getLoader();
  expect(await tree.json()).toEqual(await source.serializePageTree(source.getPageTree("fr")));
  const other = "/docs/_fumapress/page-tree/fr.0000000000000000.json";
  expect((await ctx.handleRequest(new Request(`http://localhost${other}`), next)).status).toBe(404);
});
