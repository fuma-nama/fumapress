import { describe, expect, it, vi } from "vitest";
import type { AppContext } from "@/app/context";
import type { RouteFns } from "@/lib/types";
import { takumiPlugin, type TakumiOptions } from "@/plugins/takumi";
import type { RouteParams } from "@/lib/routes";
import type { FC, ReactElement } from "react";

vi.mock("waku/router/server", () => ({
  unstable_notFound() {
    throw new Error("not found");
  },
}));

type Api = Parameters<RouteFns["createApiIsomorphic"]>[0];

const pages = [
  { slugs: [], data: { title: "Home" } },
  { slugs: ["docs", "page"], data: { title: "Page", description: "Description" } },
];

async function init(options: TakumiOptions, overrides: Partial<AppContext> = {}) {
  const apis: Api[] = [];
  const ctx = {
    mode: "default",
    data: {},
    siteConfig: { name: "Site" },
    interceptPageMeta() {},
    getLoader: () => ({
      getPages: () => pages,
      getPage: (slugs: string[]) => pages.find((page) => page.slugs.join("/") === slugs.join("/")),
    }),
    ...overrides,
  } as unknown as AppContext;
  const plugin = takumiPlugin(options);

  await plugin.init!.call(ctx);
  await plugin.createPages!.call(ctx, {
    createApiIsomorphic: (api: Api) => apis.push(api),
  } as unknown as RouteFns);

  return { apis };
}

async function readImage(api: Api, slugs: string[] = []) {
  const res = await api.handler(new Request("http://localhost/"), { params: { slugs } });
  const bytes = new Uint8Array(await res.arrayBuffer());

  expect(res.headers.get("content-type")).toBe("image/webp");
  expect(String.fromCharCode(...bytes.subarray(0, 4))).toBe("RIFF");
  return res;
}

describe("og:image", () => {
  async function metaOf(options: TakumiOptions, overrides: Partial<AppContext>, page: object) {
    let meta!: ReactElement<{ children: ReactElement[] }>;
    await init(options, {
      ...overrides,
      interceptPageMeta(fn) {
        meta = fn({ page, next: () => null } as never) as never;
      },
    } as Partial<AppContext>);
    const image = meta.props.children[1] as ReactElement<{ children: ReactElement[] }>;
    return image.props.children[0]!.props as { content: string };
  }

  it("resolves the page image against the base URL", async () => {
    const { content } = await metaOf(
      {},
      { siteConfig: { name: "Site", baseUrl: "https://example.com" } },
      pages[1]!,
    );
    expect(content).toBe("https://example.com/docs/page.webp");
  });

  it("follows locale and the dynamic base path", async () => {
    const { content } = await metaOf({}, { mode: "dynamic" }, { slugs: ["docs"], locale: "cn" });
    expect(content).toBe("/cn/_takumi/docs.webp");
  });
});

describe("routes", () => {
  it("registers page images", async () => {
    const { apis } = await init({});

    expect(apis.map((api) => [api.path, api.render])).toEqual([["/[...slugs]", "static"]]);
    expect(apis[0]!.staticPaths).toEqual([["index.webp"], ["docs", "page.webp"]]);
  });

  it("applies shared options under the ones from generate()", async () => {
    const { apis } = await init({
      options: { headers: { "x-shared": "1" } },
      generate: () => ({ node: <div>Page</div>, options: { status: 201 } }),
    });

    const page = await readImage(apis[0]!, ["docs", "page.webp"]);
    expect(page.status).toBe(201);
    expect(page.headers.get("x-shared")).toBe("1");
  });
});

describe("route images", () => {
  async function createRoute(page: object, siteConfig: object = { name: "Site" }) {
    const apis: Api[] = [];
    const created: { component: FC<{ path: string }> }[] = [];
    const ctx = {
      mode: "default",
      data: {},
      siteConfig,
      interceptPageMeta() {},
    } as unknown as AppContext;
    const fns = {
      createPage: (page: never) => created.push(page),
      createApiIsomorphic: (api: Api) => apis.push(api),
    } as unknown as RouteFns;
    const plugin = takumiPlugin();

    await plugin.init!.call(ctx);
    await plugin.prepareCreatePages!.call(ctx, fns);
    fns.createPage(page as never);

    return { apis, fns, page: created[0]! };
  }

  function metaOf(page: { component: FC<{ path: string }> }, path: string) {
    const element = page.component({ path }) as ReactElement<{ children: ReactElement[] }>;
    const meta = element.props.children[0] as ReactElement<{ children: ReactElement[] }>;
    return meta.props.children[0]!.props as { property: string; content: string };
  }

  it("prerenders an image per static path and adds the meta tags", async () => {
    const seen: RouteParams[] = [];
    const { apis, page } = await createRoute({
      path: "/tags/[tag]",
      render: "static",
      staticPaths: ["react", "vue"],
      component: () => <main>Tag</main>,
      takumiOptions(params: RouteParams) {
        seen.push(params);
        return { title: `Tag ${params.tag}` };
      },
    });

    expect(apis.map((api) => [api.path, api.render])).toEqual([
      ["/tags/react.webp", "static"],
      ["/tags/vue.webp", "static"],
    ]);
    await readImage(apis[0]!);
    expect(seen).toEqual([{ tag: "react" }]);
    expect(metaOf(page, "/tags/react")).toEqual({
      property: "og:image",
      content: "/tags/react.webp",
    });
  });

  it("names the root image index.webp and resolves it against the base URL", async () => {
    const { apis, page } = await createRoute(
      { path: "/", render: "static", component: () => null, takumiOptions: { node: <div /> } },
      { name: "Site", baseUrl: "https://example.com" },
    );

    expect(apis.map((api) => api.path)).toEqual(["/index.webp"]);
    expect(metaOf(page, "/").content).toBe("https://example.com/index.webp");
  });

  it("serves dynamic pages from an image route with their params", async () => {
    const seen: RouteParams[] = [];
    const { apis, page } = await createRoute({
      path: "/[lang]/(fs)/tags/[tag]",
      render: "dynamic",
      component: () => null,
      takumiOptions(params: RouteParams) {
        seen.push(params);
        return { title: String(params.tag) };
      },
    });

    expect(apis.map((api) => [api.path, api.render])).toEqual([
      ["/_takumi/[lang]/tags/[tag]", "dynamic"],
    ]);
    const res = await apis[0]!.handler(new Request("http://localhost/"), {
      params: { lang: "en", tag: "react" },
    });
    expect(res.headers.get("content-type")).toBe("image/webp");
    expect(seen).toEqual([{ lang: "en", tag: "react" }]);
    expect(metaOf(page, "/en/tags/react").content).toBe("/_takumi/en/tags/react");
  });
});
