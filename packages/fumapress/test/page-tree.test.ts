import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as PageTree from "fumadocs-core/page-tree";
import type { ApiRoute, Context } from "@fumapress/core";
import { getPageTreeFiles, pageTreePlugin } from "@/router/page-tree";

// React Flight needs the `react-server` condition
vi.mock("waku/server", () => ({
  serializeRsc: async (value: unknown) => new TextEncoder().encode(JSON.stringify(value)),
}));
vi.mock("@vitejs/plugin-rsc/rsc", () => ({
  registerClientReference: (value: object) =>
    Object.defineProperty(value, "$$typeof", { value: Symbol.for("react.client.reference") }),
}));

function createTree(): PageTree.Root {
  const page = (url: string): PageTree.Item => ({ type: "page", name: url, url });
  return {
    name: "root",
    children: [
      page("/"),
      {
        type: "folder",
        name: "docs",
        $ref: { folder: "docs" },
        index: page("/docs"),
        children: [page("/docs/a")],
      },
    ],
    fallback: { name: "fallback", children: [page("/hidden")] },
  };
}

function createContext(
  tree: PageTree.Root,
  base = "/site/",
  render: "static" | "dynamic" = "static",
) {
  return {
    getContentRender: (source?: string) => (source ? "static" : render),
    languages: [undefined],
    withBase: (path: string) => base + path.slice(1),
    getLoader: async () => ({ getPageTree: () => tree, getPages: () => [{ type: "docs" }] }),
  } as unknown as Context;
}

function revalidated() {
  const tree = createTree();
  tree.children.pop();
  return tree;
}

describe("page tree files", () => {
  beforeEach(() => {
    globalThis.PAGE_TREE_FILES = undefined;
  });

  it("creates a file once per tree, and another for revalidated content", async () => {
    const ctx = createContext(createTree());
    expect(await getPageTreeFiles(ctx)).toEqual(await getPageTreeFiles(ctx));

    expect(await getPageTreeFiles(createContext(revalidated()))).not.toEqual(
      await getPageTreeFiles(ctx),
    );
  });

  describe("routes", () => {
    const request = (file: string) => new Request(`http://localhost/_fumapress/page-tree/${file}`);

    async function serving(render: "static" | "dynamic") {
      const state = { tree: createTree() };
      const ctx = {
        ...createContext(state.tree, undefined, render),
        getLoader: async () => ({
          getPageTree: () => state.tree,
          getPages: () => [{ type: "docs" }],
        }),
      };
      const routes: ApiRoute[] = [];
      await pageTreePlugin().routes!.call(
        ctx as never,
        { createApi: (route: ApiRoute) => routes.push(route) } as never,
      );
      return { ctx, routes, state };
    }

    it("generates the files of static content", async () => {
      const { ctx, routes } = await serving("static");
      expect(routes).toHaveLength(1);
      const [generated] = routes;
      expect(generated!.render).toBe("static");

      const [file] = await getPageTreeFiles(ctx as never);
      expect(generated!.staticPaths).toEqual([file]);
      const response = await generated!.GET!(request(file!), { params: {} });
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("text/x-component");
      expect((await generated!.GET!(request("default.unknown.txt"), { params: {} })).status).toBe(
        404,
      );
    });

    it("serves the revalidated files of dynamic content on demand", async () => {
      const { ctx, routes, state } = await serving("dynamic");
      const [built, onRequest] = routes;
      expect(built!.render).toBe("static");
      expect(onRequest!.render).toBeUndefined();

      state.tree = revalidated();
      const [next] = await getPageTreeFiles(ctx as never);
      expect((await onRequest!.GET!(request(next!), { params: {} })).status).toBe(200);
    });
  });
});
