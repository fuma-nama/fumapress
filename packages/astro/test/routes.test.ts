import type { APIContext, MiddlewareNext } from "astro";
import { describe, expect, it, vi } from "vitest";
import { type AppShape, type Context, type Plugin } from "@fumapress/core";
import { notFoundView } from "@fumapress/core/runtime";
import { onRequest } from "@/routes/middleware";
import { fileStaticPaths, pageStaticPaths, pageTarget, serve } from "@/routes/shared";
import type { PageProps, ViewPage } from "@/routes/shared";
import { pressContext, type TestSite } from "./harness";

const runtime = vi.hoisted(() => ({ ctx: undefined as Context | undefined }));
vi.mock("@/runtime", () => ({ getPressContext: () => runtime.ctx }));

const docs = { files: [{ type: "page" as const, path: "index.mdx", data: { title: "Home" } }] };

function site(plugin: Plugin<AppShape, any>, config: Partial<TestSite> = {}, base = "/") {
  return pressContext({ content: { docs }, plugins: [plugin], ...config }, { base });
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

    // the most specific first
    expect(paths.map((path) => path.params.fumapressFile)).toEqual([
      "llms.txt",
      "og/a/b.webp",
      "og/index.webp",
    ]);
    expect(paths[1]!.props.params).toEqual({ slugs: ["a", "b.webp"] });
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

    const redirect = await pageTarget(
      (await serve(dynamic, new Request("http://localhost/sub"))) as PageProps,
      new Request("http://localhost/sub"),
    );
    expect(redirect).toBeInstanceOf(Response);
    expect((redirect as Response).status).toBe(302);
    expect((redirect as Response).headers.get("Location")).toBe("/sub/en");
  });
});

describe("views", () => {
  const i18n = { languages: ["en", "cn"], defaultLanguage: "en" };
  const view = (node: unknown) => ({ type: "test" as const, props: {}, node: String(node) });
  const views: Plugin<AppShape, { views: { test: {} } }> = {
    views: ({ lang }) => [
      { path: "/blog", view: () => view(`blog:${lang}`) },
      {
        path: "/tags/[tag]",
        staticPaths: lang === "cn" ? ["react"] : ["react", "vue"],
        view: ({ tag }) => view(`${tag}:${lang}`),
      },
      { path: "/(app)/live/[id]", render: "dynamic", view: ({ id }) => view(id) },
      { path: "/404", view: () => view(`404:${lang}`) },
    ],
  };
  const paths = async (config: Partial<TestSite>) => {
    const out: (string | undefined)[] = [];
    for (const { params, props } of await pageStaticPaths(await site(views, config), true))
      if (props.view) out.push(params.fumapressPage);
    return out;
  };

  it("are prerendered at the path of their language, in every `hideLocale` mode", async () => {
    // the most specific first, `/404` is the 404 page
    expect(await paths({ i18n })).toEqual([
      "en/blog",
      "en/404",
      "cn/blog",
      "cn/404",
      "en/tags/react",
      "en/tags/vue",
      "cn/tags/react",
    ]);
    expect(await paths({ i18n: { ...i18n, hideLocale: "default-locale" } })).toEqual([
      "blog",
      "cn/blog",
      "cn/404",
      "cn/tags/react",
      "tags/react",
      "tags/vue",
    ]);
    expect(await paths({})).toEqual(["blog", "tags/react", "tags/vue"]);
    await expect(pageStaticPaths(await site(views), false)).rejects.toThrow(
      'the route "/(app)/live/[id]" renders on request, add an adapter to Astro.',
    );
  });

  it("leave `/404` to the 404 page, in the language of its URL", async () => {
    const ctx = await site(views, { i18n: { ...i18n, hideLocale: "default-locale" } });
    expect(await paths({ i18n: { ...i18n, hideLocale: "default-locale" } })).toContain("cn/404");
    expect(await paths({ i18n: { ...i18n, hideLocale: "default-locale" } })).not.toContain("404");
    expect((await notFoundView(ctx, "cn"))?.route.path).toBe("/cn/404");
    expect((await notFoundView(ctx, "fr"))?.route.path).toBe("/404");
  });

  it("link the pages of other languages at their path as translations", async () => {
    const pages = new Map<string, ViewPage["page"]>();
    for (const { props } of await pageStaticPaths(await site(views, { i18n }), true))
      if (props.view) pages.set(props.view.page.path, props.view.page);

    expect(pages.get("/cn/tags/react")?.translations).toEqual([
      { lang: "en", path: "/en/tags/react" },
      { lang: "cn", path: "/cn/tags/react" },
    ]);
    expect(pages.get("/en/tags/vue")?.translations).toEqual([{ lang: "en", path: "/en/tags/vue" }]);
    expect(pages.get("/cn/tags/react")?.params).toEqual({ tag: "react" });
  });

  it("render on request with their params, every view in `dynamic` mode", async () => {
    const ctx = await site(views, { i18n }, "/sub");
    const request = new Request("http://localhost/sub/en/live/42");
    const live = (await serve(ctx, request)) as PageProps;
    expect(live.view?.page).toEqual({
      path: "/en/live/42",
      params: { id: "42" },
      translations: [],
    });
    expect(await pageTarget(live, request)).toMatchObject({ content: { node: "42" } });
    expect(await serve(ctx, new Request("http://localhost/sub/cn/blog"))).toBeInstanceOf(Response);

    const dynamic = await site(views, { i18n, mode: "dynamic" });
    const blog = (await serve(dynamic, new Request("http://localhost/cn/blog/"))) as PageProps;
    expect(blog.view?.page.path).toBe("/cn/blog");
    expect(blog.view?.page.translations).toHaveLength(2);
  });

  it("match the pages of their route by the decoded path of the request", async () => {
    const tags: Plugin<AppShape, any> = {
      views: () => [{ path: "/tags/[tag]", staticPaths: ["über"], view: ({ tag }) => view(tag) }],
    };
    const ctx = await site(tags, { i18n, mode: "dynamic" });
    const listed = (await serve(
      ctx,
      new Request("http://localhost/cn/tags/%C3%BCber"),
    )) as PageProps;
    const other = (await serve(ctx, new Request("http://localhost/cn/tags/%C3%A4"))) as PageProps;

    expect(listed.view?.page.path).toBe("/cn/tags/über");
    expect(listed.view?.page.translations).toHaveLength(2);
    expect(other.view?.page).toEqual({
      path: "/cn/tags/ä",
      params: { tag: "ä" },
      translations: [],
    });
  });

  it("answer 404 without content", async () => {
    const ctx = await site({ views: () => [{ path: "/empty", view: () => undefined }] });
    const [routed] = await ctx.getViewRoutes();
    const response = await pageTarget(
      { view: { ...routed!, page: routed!.route.pages[0]! } },
      new Request("http://localhost/empty"),
    );
    expect((response as Response).status).toBe(404);
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

  it("gives files rendered on request the trailing slash of `[...fumapressServer]`, when Astro routes them to the 404 page", async () => {
    runtime.ctx = await site(
      {
        routes: () => [
          { path: "/robots.txt", render: "dynamic", GET },
          { path: "/api/x", render: "dynamic", GET },
          { path: "/sitemap.xml", GET },
        ],
      },
      {},
      "/sub",
    );
    const next = vi.fn(async () => new Response("next"));
    const call = (path: string, routePattern = "/404") =>
      onRequest(
        {
          isPrerendered: false,
          routePattern,
          request: new Request(`http://localhost${path}?q=1`),
        } as APIContext,
        next as MiddlewareNext,
      );

    await call("/sub/robots.txt");
    expect(next).toHaveBeenLastCalledWith(new URL("http://localhost/sub/robots.txt/?q=1"));
    for (const [path, pattern] of [
      ["/sub/robots.txt", "/robots.txt"],
      ["/sub/robots.txt/", "/404"],
      ["/sub/api/x", "/404"],
      ["/sub/sitemap.xml", "/404"],
      ["/robots.txt", "/404"],
    ] as const) {
      await call(path, pattern);
      expect(next).toHaveBeenLastCalledWith();
    }
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
