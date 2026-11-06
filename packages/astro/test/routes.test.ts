import type { APIContext, MiddlewareNext } from "astro";
import { describe, expect, it, vi } from "vitest";
import { type AppShape, type Plugin } from "@fumapress/core";
import { notFoundView, type PressRuntime, type RuntimeContext } from "@fumapress/core/runtime";
import { onRequest } from "@/routes/middleware";
import { fileStaticPaths, pageStaticPaths, serve, serveApi } from "@/routes/shared";
import { pressContext, type TestSite } from "./harness";

const runtime = vi.hoisted(() => ({ ctx: undefined as RuntimeContext | undefined }));
vi.mock("@/routes/context", () => ({
  get ctx() {
    return runtime.ctx;
  },
}));

const docs = { files: [{ type: "page" as const, path: "index.mdx", data: { title: "Home" } }] };
const i18n = { languages: ["en", "cn"], defaultLanguage: "en" };
const dynamicDocs = { docs: { files: () => docs.files } };
/** the home page is prerendered, `/live/status` renders on demand */
const mixed = {
  docs,
  live: {
    files: () => [{ type: "page" as const, path: "live/status.mdx", data: { title: "Status" } }],
  },
};

function site(
  plugin: Plugin<AppShape, any>,
  config: Partial<TestSite> = {},
  base = "/",
  runtime: Partial<PressRuntime> = {},
) {
  return pressContext({ content: { docs }, plugins: [plugin], ...config }, { base, ...runtime });
}

const GET = () => new Response("get");

describe("static routes", () => {
  it("expand the params of their static paths", async () => {
    const ctx = await site({
      routes({ createApi }) {
        createApi({
          path: "/og/[...slugs]",
          render: "static",
          staticPaths: [["a", "b.webp"], ["index.webp"]],
          GET,
        });
        createApi({ path: "/llms.txt", render: "static", GET });
        createApi({ path: "/api/search", GET });
      },
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
      'the route "/api/search" renders on demand, add an adapter to Astro.',
    );
    // the search route has no file extension, Astro redirects it to a catch-all route
    await expect(fileStaticPaths(ctx, true, true)).resolves.toEqual(paths);
    const file = await site({ routes: ({ createApi }) => createApi({ path: "/feed.json" }) });
    await expect(fileStaticPaths(file, true, true)).rejects.toThrow(
      'Astro serves your 404 page at "/feed.json"',
    );
  });

  it("render the pages and the root redirect", async () => {
    const ctx = await site({}, { i18n });
    const paths = await pageStaticPaths(ctx, false);

    expect(paths.map((path) => path.params.fumapressPage)).toEqual(["en", "cn", undefined]);
    expect(paths[2]!.props.redirect).toBe("/en");

    const guide = { files: [{ type: "page" as const, path: "docs/guide.mdx", data: {} }] };
    const noHome = await site(
      {},
      {
        content: { docs: guide },
        i18n: { languages: ["en"], defaultLanguage: "en" },
      },
      "/sub",
    );
    expect((await pageStaticPaths(noHome, false)).at(-1)!.props.redirect).toBe(
      "/sub/en/docs/guide",
    );
  });

  it("leave out the pages of dynamic sources, and the root redirect with them", async () => {
    expect(await pageStaticPaths(await site({}, { content: dynamicDocs, i18n }), true)).toEqual([]);
    expect(await pageStaticPaths(await site({}, { i18n }, "/", { dynamic: true }), true)).toEqual(
      [],
    );

    const paths = await pageStaticPaths(await site({}, { content: mixed }), true);
    expect(paths).toMatchObject([{ params: {}, props: { page: { url: "/" } } }]);
  });
});

describe("server routes", async () => {
  const ctx = await site(
    {
      routes({ createApi }) {
        createApi({
          path: "/api/[id]",
          render: "dynamic",
          GET: (_request, { params }) => Response.json(params),
          PUT: () => new Response("put"),
        });
        createApi({
          path: "/proxy",
          render: "dynamic",
          ALL: (request) => new Response(request.method),
        });
      },
    },
    {},
    "/sub",
  );
  const request = (path: string, method = "GET") =>
    serveApi(ctx, new Request(`http://localhost${path}`, { method })) as Promise<Response>;

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

  it("leave other paths to Astro", async () => {
    for (const path of ["/sub/missing", "/other"]) {
      expect(await request(path)).toBeUndefined();
      expect(await serve(ctx, new Request(`http://localhost${path}`))).toBeUndefined();
    }
  });

  it.each<[string, Partial<TestSite>, Partial<PressRuntime>]>([
    ["a dynamic source", { content: dynamicDocs }, {}],
    ["`output: 'server'`", {}, { dynamic: true }],
  ])("render pages with %s", async (_, config, runtime) => {
    const dynamic = await site({}, { ...config, i18n }, "/sub", runtime);
    const page = await serve(dynamic, new Request("http://localhost/sub/cn/"));
    expect(page).toMatchObject({ page: { url: "/cn" } });
    expect(await serve(dynamic, new Request("http://localhost/sub"))).toEqual({
      redirect: "/sub/en",
    });
  });

  it("render only the pages of dynamic sources on a site mixing both", async () => {
    const both = await site({}, { content: mixed });

    expect(await serve(both, new Request("http://localhost/live/status/"))).toMatchObject({
      page: { url: "/live/status" },
    });
    expect(await serve(both, new Request("http://localhost/"))).toBeUndefined();
  });
});

describe("views", () => {
  const hidden = { ...i18n, hideLocale: "default-locale" as const };
  const view = (node: unknown) => ({ type: "test" as const, props: {}, node: String(node) });
  const views: Plugin<AppShape, { views: { test: {} } }> = {
    routes({ createView }) {
      for (const lang of this.languages) {
        createView({ lang, path: "/blog", view: () => view(`blog:${lang}`) });
        createView({
          lang,
          path: "/tags/[tag]",
          staticPaths: lang === "cn" ? ["react"] : ["react", "vue"],
          view: ({ tag }) => view(`${tag}:${lang}`),
        });
        createView({
          lang,
          path: "/(app)/live/[id]",
          render: "dynamic",
          view: ({ id }) => view(id),
        });
        createView({ lang, path: "/404", view: () => view(`404:${lang}`) });
      }
    },
  };
  const paths = async (config: Partial<TestSite>) => {
    const out: (string | undefined)[] = [];
    for (const { params, props } of await pageStaticPaths(await site(views, config), true))
      if (props.view) out.push(params.fumapressPage);
    return out;
  };

  it.each([
    [
      "prefixed",
      { i18n },
      ["en/blog", "en/tags/react", "en/tags/vue", "en/404", "cn/blog", "cn/tags/react", "cn/404"],
    ],
    // `/404` of the hidden locale is the 404 page
    [
      "hidden default locale",
      { i18n: hidden },
      ["blog", "tags/react", "tags/vue", "cn/blog", "cn/tags/react", "cn/404"],
    ],
    ["without i18n", {}, ["blog", "tags/react", "tags/vue"]],
  ])("are prerendered at the path of their language: %s", async (_, config, expected) => {
    expect(await paths(config)).toEqual(expected);
  });

  it("need an adapter to render on demand", async () => {
    await expect(pageStaticPaths(await site(views), false)).rejects.toThrow(
      'the route "/(app)/live/[id]" renders on demand, add an adapter to Astro.',
    );
  });

  it("leave `/404` to the 404 page, in the language of its URL", async () => {
    const ctx = await site(views, { i18n: hidden });
    expect((await notFoundView(ctx, "cn"))?.path).toBe("/cn/404");
    expect((await notFoundView(ctx, "fr"))?.path).toBe("/404");
  });

  it("render on demand with their params", async () => {
    const ctx = await site(views, { i18n }, "/sub");
    const request = new Request("http://localhost/sub/en/live/42");
    const live = (await serve(ctx, request))!;
    expect(live.view?.page).toEqual({
      path: "/en/live/42",
      params: { id: "42" },
      translations: [],
    });
    expect(await serve(ctx, new Request("http://localhost/sub/cn/blog"))).toBeUndefined();
  });

  it.each<[string, Partial<TestSite>, Partial<PressRuntime>]>([
    ["a dynamic source", { content: dynamicDocs }, {}],
    ["`output: 'server'`", {}, { dynamic: true }],
  ])("following the content render on demand with %s", async (_, config, runtime) => {
    const following: Plugin<AppShape, { views: { test: {} } }> = {
      routes({ createView }) {
        for (const lang of this.languages)
          createView({
            lang,
            path: "/blog",
            render: this.getContentRender(),
            view: () => view(`blog:${lang}`),
          });
      },
    };
    const onRequest = await site(following, { ...config, i18n }, "/", runtime);
    const blog = (await serve(onRequest, new Request("http://localhost/cn/blog/")))!;
    expect(blog.view?.page.path).toBe("/cn/blog");
    expect(blog.view?.page.translations).toHaveLength(2);

    const prerendered = await site(following, { i18n });
    expect(await serve(prerendered, new Request("http://localhost/cn/blog/"))).toBeUndefined();
  });

  it("match the pages of their route by the decoded path of the request", async () => {
    const tags: Plugin<AppShape, any> = {
      routes({ createView }) {
        for (const lang of this.languages)
          createView({
            lang,
            path: "/tags/[tag]",
            render: "dynamic",
            staticPaths: ["über"],
            view: ({ tag }) => view(tag),
          });
      },
    };
    const ctx = await site(tags, { i18n });
    const listed = (await serve(ctx, new Request("http://localhost/cn/tags/%C3%BCber")))!;
    const other = (await serve(ctx, new Request("http://localhost/cn/tags/%C3%A4")))!;

    expect(listed.view?.page.path).toBe("/cn/tags/über");
    expect(listed.view?.page.translations).toHaveLength(2);
    expect(other.view?.page).toEqual({
      path: "/cn/tags/ä",
      params: { tag: "ä" },
      translations: [],
    });
  });
});

describe("middleware", () => {
  /** the answer of `onRequest` to a request of the site */
  const request = async (
    path: string,
    context: Partial<APIContext> = {},
    next: () => Promise<Response> = async () => new Response("next"),
  ) =>
    (await onRequest(
      {
        isPrerendered: false,
        request: new Request(`http://localhost${path}`),
        ...context,
      } as APIContext,
      next as MiddlewareNext,
    )) as Response;

  it("skips prerendered routes, and rewrites as new requests with the base path", async () => {
    const middleware = vi.fn<NonNullable<Plugin["middleware"]>>((request, next) =>
      request.url.endsWith("/a") ? next("/b") : next(),
    );
    runtime.ctx = await site(
      {
        middleware,
        routes: ({ createApi }) =>
          createApi({ path: "/b", render: "dynamic", GET: (request) => new Response(request.url) }),
      },
      {},
      "/sub",
    );
    const next = vi.fn(async () => new Response("next"));
    await request("/sub/a", { isPrerendered: true }, next);
    expect(middleware).not.toHaveBeenCalled();
    expect(await (await request("/sub/a", {}, next)).text()).toBe("http://localhost/sub/b");
    // the middleware of plugins runs for the rewritten request too
    expect(middleware).toHaveBeenCalledTimes(2);
    expect(next).toHaveBeenCalledTimes(1);
    expect(await (await request("/sub/c", {}, next)).text()).toBe("next");
    expect(next).toHaveBeenLastCalledWith();
  });

  it.each([
    ["/[...fumapressServer]", "/sub/api/x", "route"],
    // a file `[...fumapressServer]` doesn't take with `trailingSlash: "always"`
    ["/404", "/sub/robots.txt", "route"],
    ["/404", "/sub/missing", "next"],
    // a custom route replaces the route of a plugin
    ["/api/x", "/sub/api/x", "next"],
  ])("on %s, answers %s with the %s", async (routePattern, path, expected) => {
    runtime.ctx = await site(
      {
        routes({ createApi }) {
          createApi({ path: "/api/x", GET: () => new Response("route") });
          createApi({ path: "/robots.txt", GET: () => new Response("route") });
        },
      },
      {},
      "/sub",
    );
    expect(await (await request(path, { routePattern })).text()).toBe(expected);
  });

  describe("on the 404 page, with a file of a static route", () => {
    const withFile = () =>
      site(
        { routes: ({ createApi }) => createApi({ path: "/a.txt", render: "static", GET }) },
        {},
        "/sub",
      );
    const onNotFound = { routePattern: "/404", isPrerendered: true };

    it("answers in dev, the way builds serve it", async () => {
      runtime.ctx = await withFile();
      expect(await (await request("/sub/a.txt", onNotFound)).text()).toBe("get");
      expect(await (await request("/sub/b.txt", onNotFound)).text()).toBe("next");
    });

    it("leaves builds to the file", async () => {
      runtime.ctx = await withFile();
      vi.stubEnv("DEV", false);
      expect(await (await request("/sub/a.txt", onNotFound)).text()).toBe("next");
      vi.unstubAllEnvs();
    });
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
    expect(await (await request("/own", {}, next)).text()).toBe("next");
    expect(next).toHaveBeenCalledExactlyOnceWith();
  });
});
