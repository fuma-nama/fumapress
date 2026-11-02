import { describe, expect, it } from "vitest";
import type { PressRoute, RouteFns } from "@/lib/types";
import { takumiPlugin } from "@/plugins/takumi";
import type { RouteHandler, RouteParams } from "fumadocs-core/framework/plugin";
import type { ReactElement } from "react";
import { createApp } from "./fixtures";

async function readImage(handler: RouteHandler, params: RouteParams = {}) {
  const res = await handler(new Request("http://localhost/"), { params });
  const bytes = new Uint8Array(await res.arrayBuffer());

  expect(res.headers.get("content-type")).toBe("image/webp");
  expect(String.fromCharCode(...bytes.subarray(0, 4))).toBe("RIFF");
  return res;
}

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

    const plugin = takumiPlugin();
    await plugin.init!.call(ctx);
    await plugin.configureRoutes!.call(ctx, {
      createApiIsomorphic: (api: { path: string; render?: string; handler: RouteHandler }) =>
        handlers.set(api.path, api),
      getRoutes: () => [route],
    } as unknown as RouteFns);

    return { handlers, route };
  }

  function metaOf(route: PressRoute, path: string) {
    const tags = route.meta[0]!({ path }) as ReactElement<{ property: string; content: string }>[];
    return tags.map((tag) => tag.props);
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
      ["/tags/react.webp", "static"],
      ["/tags/vue.webp", "static"],
    ]);
    await readImage(handlers.get("/tags/react.webp")!.handler);
    expect(seen).toEqual([{ tag: "react" }]);
    expect(metaOf(route, "/tags/react")).toEqual([
      { property: "og:image", content: "https://example.com/tags/react.webp" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "twitter:card", content: "summary_large_image" },
    ]);
  });

  it("names the root image index.webp", async () => {
    const { handlers, route } = await createRoute({
      path: "/",
      pages: [{ path: "/", params: {}, translations: [] }],
      takumiOptions: { node: <div /> },
    });

    expect(Array.from(handlers.keys())).toEqual(["/index.webp"]);
    expect(metaOf(route, "/")[0]!.content).toBe("https://example.com/index.webp");
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
      ["/_takumi/[lang]/tags/[tag]", "dynamic"],
    ]);
    await readImage(handlers.get("/_takumi/[lang]/tags/[tag]")!.handler, {
      lang: "en",
      tag: "react",
    });
    expect(seen).toEqual([{ lang: "en", tag: "react" }]);
    expect(metaOf(route, "/en/tags/react")[0]!.content).toBe(
      "https://example.com/_takumi/en/tags/react",
    );
  });
});
