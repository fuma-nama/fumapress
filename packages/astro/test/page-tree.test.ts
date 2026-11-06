import { expect, it } from "vitest";
import { pageTreePlugin } from "@/island/page-tree";
import { pressContext } from "./harness";

it("serves the page tree of each language at a URL by its content", async () => {
  async function treeRoutes(title: string) {
    const data = { title, load: async () => ({}) };
    const ctx = await pressContext(
      {
        content: { docs: { files: [{ type: "page" as const, path: "index.md", data }] } },
        i18n: { languages: ["en", "fr"], defaultLanguage: "en" },
      },
      { base: "/", defaults: [pageTreePlugin()] },
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

  // on demand, also a route
  const ctx = await pressContext(
    {
      content: {
        docs: {
          files: () => [{ type: "page" as const, path: "index.md", data: { title: "Home" } }],
        },
      },
      i18n: { languages: ["en", "fr"], defaultLanguage: "en" },
    },
    { base: "/docs", defaults: [pageTreePlugin()] },
  );
  const routes = await ctx.getApiRoutes();
  expect(routes.map((route) => route.render)).toEqual(["dynamic", "dynamic"]);
  expect(routes.map((route) => route.path)).toEqual(paths);
  const tree = await routes[1]!.GET!(new Request("http://localhost"), { params: {} });
  expect(tree.headers.get("Content-Type")).toBe("application/json");
  expect(tree.headers.get("Cache-Control")).toContain("immutable");
});
