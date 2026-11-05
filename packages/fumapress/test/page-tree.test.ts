import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as PageTree from "fumadocs-core/page-tree";
import { selectTreeRoot, type ApiRoute, type Context } from "@fumapress/core";
import { getPageTreeFiles, pageTreePlugin } from "@/router/page-tree";

const references = vi.hoisted(() => new Map<object, string>());

// React Flight needs the `react-server` condition
vi.mock("waku/server", () => ({
  serializeRsc: async (value: unknown) => new TextEncoder().encode(JSON.stringify(value)),
}));
vi.mock("@vitejs/plugin-rsc/rsc", () => ({
  registerClientReference(value: object, id: string, name: string) {
    references.set(value, `${id}#${name}`);
    return Object.defineProperty(value, "$$typeof", {
      value: Symbol.for("react.client.reference"),
    });
  },
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

function createContext(tree: PageTree.Root, base = "/site/") {
  return {
    mode: "default",
    languages: [undefined],
    withBase: (path: string) => base + path.slice(1),
    getLoader: async () => ({ getPageTree: () => tree }),
  } as unknown as Context;
}

function idOf(nodes: object) {
  return references.get(nodes)?.replace(/^.*#/, "");
}

describe("page tree files", () => {
  beforeEach(() => {
    references.clear();
    globalThis.PAGE_TREE_FILES = undefined;
  });

  it("makes every node list a reference to its file, the same arrays on the server", async () => {
    const tree = createTree();
    const { children } = tree;
    const [file] = await getPageTreeFiles(createContext(tree));
    const folder = tree.children[1] as PageTree.Folder;

    expect(tree.children).toBe(children);
    expect(tree.children).toHaveLength(2);
    expect(references.get(tree.children)).toBe(`page-tree:/site/_fumapress/page-tree/${file}#c`);
    expect(idOf(folder.children)).toBe("c.1");
    expect(idOf(tree.fallback!.children)).toBe("f");
    expect(idOf(selectTreeRoot(tree, "docs").children)).toBe("c.1+");
    expect(() => tree.children.push(folder)).toThrow(TypeError);
  });

  it("writes the lists by those names", async () => {
    const tree = createTree();
    const [file] = await getPageTreeFiles(createContext(tree));
    const bytes = globalThis.PAGE_TREE_FILES!.get(`/site/_fumapress/page-tree/${file}`)!;
    const lists = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, { url?: string }[]>;

    expect(Object.keys(lists).sort()).toEqual(["c", "c.1", "c.1+", "f"]);
    expect(lists["c.1+"]!.map((node) => node.url)).toEqual(["/docs", "/docs/a"]);
    expect(lists.c).toHaveLength(2);
  });

  it("creates a file once per tree, and another for revalidated content", async () => {
    const ctx = createContext(createTree());
    expect(await getPageTreeFiles(ctx)).toEqual(await getPageTreeFiles(ctx));

    const other = createTree();
    other.children.pop();
    expect(await getPageTreeFiles(createContext(other))).not.toEqual(await getPageTreeFiles(ctx));
  });

  it("serves the files, and revalidated ones when the site has a server", async () => {
    let tree = createTree();
    const ctx = { ...createContext(tree), getLoader: async () => ({ getPageTree: () => tree }) };
    const routes: ApiRoute[] = [];
    await pageTreePlugin().routes!.call(
      ctx as never,
      {
        createApi: (route: ApiRoute) => routes.push(route),
      } as never,
    );

    const [generated, onRequest] = routes;
    expect(generated!.render).toBe("static");
    expect(onRequest!.render).toBeUndefined();

    const request = (file: string) => new Request(`http://localhost/_fumapress/page-tree/${file}`);
    const [file] = await getPageTreeFiles(ctx as never);
    const response = await generated!.GET!(request(file!), { params: {} });
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/x-component");
    expect((await generated!.GET!(request("default.unknown.txt"), { params: {} })).status).toBe(
      404,
    );

    tree = createTree();
    tree.children.pop();
    const [revalidated] = await getPageTreeFiles(ctx as never);
    expect((await onRequest!.GET!(request(revalidated!), { params: {} })).status).toBe(200);
  });
});
