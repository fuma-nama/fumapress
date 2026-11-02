import { describe, expect, it } from "vitest";
import type { AppContext } from "@/app/context";
import type { PressRoute, RouteFns } from "@/lib/types";
import { takumiPlugin, type TakumiOptions } from "@/plugins/takumi";
import type { RouteHandler, RouteParams } from "fumadocs-core/framework/plugin";
import type { ReactElement } from "react";
import { createApp, i18n } from "./fixtures";

async function getPage(ctx: AppContext, slugs: string[], lang?: string) {
  const page = (await ctx.getLoader()).getPage(slugs, lang);
  if (!page) throw new Error(`missing page ${slugs.join("/")} (${lang})`);
  return page;
}

async function readImage(handler: RouteHandler, params: RouteParams = {}) {
  const res = await handler(new Request("http://localhost/"), { params });
  const bytes = new Uint8Array(await res.arrayBuffer());

  expect(res.headers.get("content-type")).toBe("image/webp");
  expect(String.fromCharCode(...bytes.subarray(0, 4))).toBe("RIFF");
  return res;
}

describe("og:image", () => {
  it("resolves the page image against the base URL", async () => {
    const ctx = await createApp({ plugins: [takumiPlugin()] });
    const { image } = await ctx.getPageData(await getPage(ctx, ["docs", "basics"]));

    expect(image).toBe("https://example.com/og/docs/basics.webp");
  });

  it("follows the locale, fallback pages use the image of their origin", async () => {
    const ctx = await createApp({ i18n, plugins: [takumiPlugin()] });
    const translated = await ctx.getPageData(await getPage(ctx, ["docs", "basics"], "cn"));
    const fallback = await ctx.getPageData(await getPage(ctx, ["docs", "only-en"], "cn"));

    expect(translated.image).toBe("https://example.com/cn/og/docs/basics.webp");
    expect(fallback.image).toBe("https://example.com/en/og/docs/only-en.webp");
  });
});

describe("routes", () => {
  async function routes(options?: TakumiOptions) {
    const ctx = await createApp();
    return (await takumiPlugin(options).routes!.call(ctx))!;
  }

  it("registers page images", async () => {
    const [route] = await routes();

    expect(route!.path).toBe("/og/[...slugs]");
    expect(route!.staticPaths).toContainEqual(["index.webp"]);
    expect(route!.staticPaths).toContainEqual(["docs", "basics.webp"]);
  });

  it("applies shared options under the ones from generate()", async () => {
    const [route] = await routes({
      options: { headers: { "x-shared": "1" } },
      generate: () => ({ node: <div>Page</div>, options: { status: 201 } }),
    });

    const page = await readImage(route!.GET!, { slugs: ["docs", "basics.webp"] });
    expect(page.status).toBe(201);
    expect(page.headers.get("x-shared")).toBe("1");
  });
});

describe("route images", () => {
  async function createRoute(partial: Partial<PressRoute> & { path: string }) {
    const ctx = await createApp();
    const handlers = new Map<string, { render?: string; handler: RouteHandler }>();
    const route: PressRoute = {
      render: "static",
      component: () => null,
      meta: [],
      pages: [],
      ...partial,
    };

    await takumiPlugin().configureRoutes!.call(ctx, {
      createApiIsomorphic: (api: { path: string; render?: string; handler: RouteHandler }) =>
        handlers.set(api.path, api),
      getRoutes: () => [route],
    } as unknown as RouteFns);

    return { handlers, route };
  }

  function metaOf(route: PressRoute, path: string) {
    const [image] = route.meta[0]!({ path }) as ReactElement<{ content: string }>[];
    return image!.props;
  }

  it("prerenders an image per static path and adds the meta tags", async () => {
    const seen: RouteParams[] = [];
    const { handlers, route } = await createRoute({
      path: "/tags/[tag]",
      pages: [
        { path: "/tags/react", params: { tag: "react" }, translations: [] },
        { path: "/tags/vue", params: { tag: "vue" }, translations: [] },
      ],
      takumiOptions(params) {
        seen.push(params);
        return { title: `Tag ${params.tag}` };
      },
    });

    expect(Array.from(handlers, ([path, { render }]) => [path, render])).toEqual([
      ["/og/tags/react.webp", "static"],
      ["/og/tags/vue.webp", "static"],
    ]);
    await readImage(handlers.get("/og/tags/react.webp")!.handler);
    expect(seen).toEqual([{ tag: "react" }]);
    expect(metaOf(route, "/tags/react")).toEqual({
      property: "og:image",
      content: "https://example.com/og/tags/react.webp",
    });
  });

  it("names the root image index.webp", async () => {
    const { handlers, route } = await createRoute({
      path: "/",
      pages: [{ path: "/", params: {}, translations: [] }],
      takumiOptions: { node: <div /> },
    });

    expect(Array.from(handlers.keys())).toEqual(["/og/index.webp"]);
    expect(metaOf(route, "/").content).toBe("https://example.com/og/index.webp");
  });

  it("serves dynamic pages from an image route with their params", async () => {
    const seen: RouteParams[] = [];
    const { handlers, route } = await createRoute({
      path: "/[lang]/tags/[tag]",
      render: "dynamic",
      takumiOptions(params) {
        seen.push(params);
        return { title: String(params.tag) };
      },
    });

    expect(Array.from(handlers, ([path, { render }]) => [path, render])).toEqual([
      ["/og/[lang]/tags/[tag]", "dynamic"],
    ]);
    await readImage(handlers.get("/og/[lang]/tags/[tag]")!.handler, { lang: "en", tag: "react" });
    expect(seen).toEqual([{ lang: "en", tag: "react" }]);
    expect(metaOf(route, "/en/tags/react").content).toBe("https://example.com/og/en/tags/react");
  });
});
