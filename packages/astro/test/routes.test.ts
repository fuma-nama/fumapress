import type { APIContext, MiddlewareNext } from "astro";
import { describe, expect, it, vi } from "vitest";
import {
  createPress,
  type Context,
  type Plugin,
  type PressConfig,
  type ViewRoute,
} from "@fumapress/core";
import { onRequest } from "@/routes/middleware";
import { expandViews, fileStaticPaths, pageStaticPaths, serve } from "@/routes/shared";

const runtime = vi.hoisted(() => ({ ctx: undefined as Context | undefined }));
vi.mock("@/runtime", () => ({ getPressContext: () => runtime.ctx }));

const docs = { files: [{ type: "page" as const, path: "index.mdx", data: { title: "Home" } }] };

function site(plugin: Plugin, config: Partial<PressConfig> = {}, base = "/") {
  return createPress(
    { content: { docs }, preset: false, plugins: [plugin], ...config },
    { base },
  ) as Promise<Context>;
}

const GET = () => new Response("get");

describe("static routes", () => {
  it("expand the params of their static paths", async () => {
    const ctx = await site({
      routes: () => [
        { path: "/og/[...slugs]", staticPaths: [["a", "b.webp"], ["index.webp"]], GET },
        { path: "/llms.txt", GET },
        { path: "/api/search", render: "dynamic", GET },
      ],
    });
    const paths = await fileStaticPaths(ctx, true);

    expect(paths.map((path) => path.params.fumapressFile)).toEqual([
      "og/a/b.webp",
      "og/index.webp",
      "llms.txt",
    ]);
    expect(paths[0]!.props.params).toEqual({ slugs: ["a", "b.webp"] });
    await expect(fileStaticPaths(ctx, false)).rejects.toThrow(
      'the route "/api/search" renders on request, add an adapter to Astro.',
    );
  });

  it("render the pages and the root redirect", async () => {
    const ctx = await site(
      {},
      { i18n: { languages: ["en", "cn"], defaultLanguage: "en" }, mode: "static" },
    );
    const paths = await pageStaticPaths(ctx, false);

    expect(paths.map((path) => path.params.fumapressPage)).toEqual(["en", "cn", undefined]);
    expect(paths[2]!.props.redirect).toBe("/en");
    expect(await pageStaticPaths(await site({}, { mode: "dynamic" }), true)).toEqual([]);

    const guide = { files: [{ type: "page" as const, path: "docs/guide.mdx", data: {} }] };
    const noHome = await site(
      {},
      {
        content: { docs: guide },
        i18n: { languages: ["en"], defaultLanguage: "en" },
        mode: "static",
      },
      "/sub",
    );
    expect((await pageStaticPaths(noHome, false)).at(-1)!.props.redirect).toBe(
      "/sub/en/docs/guide",
    );
  });
});

describe("server routes", async () => {
  const ctx = await site(
    {
      routes: () => [
        {
          path: "/api/[id]",
          render: "dynamic",
          GET: (_request, { params }) => Response.json(params),
          PUT: () => new Response("put"),
        },
        { path: "/proxy", render: "dynamic", ALL: (request) => new Response(request.method) },
      ],
    },
    {},
    "/sub",
  );
  const request = (path: string, method = "GET") =>
    serve(ctx, new Request(`http://localhost${path}`, { method })) as Promise<Response>;

  it("dispatch by method", async () => {
    expect(await (await request("/sub/api/1")).json()).toEqual({ id: "1" });
    expect(await (await request("/sub/api/1", "PUT")).text()).toBe("put");
    expect(await (await request("/sub/proxy", "POST")).text()).toBe("POST");
  });

  it("answer HEAD with GET, other methods with 405", async () => {
    expect((await request("/sub/api/1", "HEAD")).status).toBe(200);
    const response = await request("/sub/api/1", "DELETE");
    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET, PUT");
  });

  it("leave other paths to the 404 page of Astro", async () => {
    for (const path of ["/sub/missing", "/other"]) {
      const response = await request(path);
      expect(response.status).toBe(404);
      expect(response.body).toBeNull();
    }
  });

  it("create the routes of plugins once per content", async () => {
    const routes = vi.fn(() => [{ path: "/api", render: "dynamic" as const, GET }]);
    const once = await site({ routes });
    for (let i = 0; i < 3; i++) await serve(once, new Request("http://localhost/api"));
    expect(routes).toHaveBeenCalledTimes(1);
  });

  it("render pages in dynamic mode", async () => {
    const dynamic = await site(
      {},
      { mode: "dynamic", i18n: { languages: ["en", "cn"], defaultLanguage: "en" } },
      "/sub",
    );
    const page = await serve(dynamic, new Request("http://localhost/sub/cn/"));
    expect(page).toMatchObject({ page: { url: "/cn" } });

    const redirect = (await serve(dynamic, new Request("http://localhost/sub"))) as Response;
    expect(redirect.status).toBe(302);
    expect(redirect.headers.get("Location")).toBe("/sub/en");
  });
});

describe("views", () => {
  const i18n = { languages: ["en", "cn"], defaultLanguage: "en" };
  const views: Plugin = {
    routes() {
      const routes: ViewRoute[] = [];
      for (const lang of ["en", "cn"]) {
        routes.push({ path: "/blog", lang, view: () => ({ node: `blog:${lang}` }) });
        routes.push({
          path: "/tags/[tag]",
          lang,
          staticPaths: lang === "en" ? ["react", "vue"] : ["react"],
          view: ({ tag }) => ({ node: `${tag}:${lang}` }),
        });
      }
      routes.push({
        path: "/(app)/live/[id]",
        render: "dynamic",
        view: ({ id }) => ({ node: id }),
      });
      return routes;
    },
  };
  const paths = async (config: Partial<PressConfig>) => {
    const out: (string | undefined)[] = [];
    for (const { params, props } of await pageStaticPaths(await site(views, config), true))
      if (props.view) out.push(params.fumapressPage);
    return out;
  };

  it("are prerendered at the path of their language, in every `hideLocale` mode", async () => {
    expect(await paths({ i18n })).toEqual([
      "en/blog",
      "en/tags/react",
      "en/tags/vue",
      "cn/blog",
      "cn/tags/react",
    ]);
    expect(await paths({ i18n: { ...i18n, hideLocale: "default-locale" } })).toEqual([
      "blog",
      "tags/react",
      "tags/vue",
      "cn/blog",
      "cn/tags/react",
    ]);
    expect(await paths({})).toEqual(["blog", "tags/react", "tags/vue", "blog", "tags/react"]);
    await expect(pageStaticPaths(await site(views), false)).rejects.toThrow(
      'the route "/(app)/live/[id]" renders on request, add an adapter to Astro.',
    );
  });

  it("link the pages of other languages at their path as translations", async () => {
    const expanded = await expandViews(await site(views, { i18n }));
    const translations = (path: string) =>
      expanded.find((view) => view.path === path)?.translations;

    expect(translations("/cn/tags/react")).toEqual([
      { locale: "en", path: "/en/tags/react" },
      { locale: "cn", path: "/cn/tags/react" },
    ]);
    expect(translations("/en/tags/vue")).toEqual([{ locale: "en", path: "/en/tags/vue" }]);
    expect(expanded.find((view) => view.path === "/cn/tags/react")?.params).toEqual({
      tag: "react",
    });
  });

  it("render on request with their params, every view in `dynamic` mode", async () => {
    const ctx = await site(views, { i18n }, "/sub");
    const live = (await serve(ctx, new Request("http://localhost/sub/live/42"))) as {
      view: { params: unknown; translations: unknown };
    };
    expect(live.view).toMatchObject({ params: { id: "42" }, translations: [] });
    expect(await serve(ctx, new Request("http://localhost/sub/cn/blog"))).toBeInstanceOf(Response);

    const dynamic = await site(views, { i18n, mode: "dynamic" });
    const blog = (await serve(dynamic, new Request("http://localhost/cn/blog/"))) as {
      view: { path: string; translations: unknown[] };
    };
    expect(blog.view.path).toBe("/cn/blog");
    expect(blog.view.translations).toHaveLength(2);
  });
});

describe("middleware", () => {
  it("skips prerendered routes, and rewrites as new requests with the base path", async () => {
    const middleware = vi.fn<NonNullable<Plugin["middleware"]>>((request, next) =>
      request.url.endsWith("/a") ? next("/b") : next(),
    );
    runtime.ctx = await site(
      {
        middleware,
        routes: () => [
          { path: "/b", render: "dynamic", GET: (request) => new Response(request.url) },
        ],
      },
      {},
      "/sub",
    );
    const next = vi.fn(async () => new Response("next"));
    const call = async (isPrerendered: boolean, path: string) =>
      (await onRequest(
        { isPrerendered, request: new Request(`http://localhost${path}`) } as APIContext,
        next as MiddlewareNext,
      )) as Response;

    await call(true, "/sub/a");
    expect(middleware).not.toHaveBeenCalled();
    expect(await (await call(false, "/sub/a")).text()).toBe("http://localhost/sub/b");
    // the middleware of plugins runs for the rewritten request too
    expect(middleware).toHaveBeenCalledTimes(2);
    expect(next).toHaveBeenCalledTimes(1);
    expect(await (await call(false, "/sub/c")).text()).toBe("next");
    expect(next).toHaveBeenLastCalledWith();
  });

  it("keeps the request when a rewrite fails", async () => {
    runtime.ctx = await site({
      middleware: async (request, next) => {
        if (!request.url.endsWith("/own")) return next();
        const response = await next("/missing");
        return response.ok ? response : next();
      },
    });
    const next = vi.fn(async () => new Response("next"));
    const response = await onRequest(
      { isPrerendered: false, request: new Request("http://localhost/own") } as APIContext,
      next as MiddlewareNext,
    );

    expect(await (response as Response).text()).toBe("next");
    expect(next).toHaveBeenCalledExactlyOnceWith();
  });
});
