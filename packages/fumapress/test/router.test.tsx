import { describe, expect, it, vi } from "vitest";
import { createElement, type FC, type ReactNode } from "react";
import { renderToReadableStream } from "react-dom/server.edge";
import { createRouter, type WakuRouteFns } from "@/router";
import { fsRouterFn } from "@/router/fs";
import { createPress, getPressContext, type WakuServerEntry } from "@/press";
import type { AppShape, Awaitable, Context, Plugin } from "@fumapress/core";
import { llmsPlugin } from "@fumapress/core/plugins/llms.txt";
import type { I18nConfig } from "fumadocs-core/i18n";
import type { VirtualFile } from "fumadocs-core/source";

interface Route {
  kind: string;
  path?: string;
  id?: string;
  render?: string;
  staticPaths?: unknown;
  component: FC<never>;
}

const recorded = vi.hoisted(() => {
  const state = {
    routes: [] as Route[],
    pending: undefined as Promise<unknown> | undefined,
    /** the request being handled, for `unstable_getRequest()` */
    request: undefined as Request | undefined,
  };
  return Object.assign(state, {
    fns() {
      state.routes = [];
      const record = (kind: string) => (item: Route) => {
        state.routes.push({ ...item, kind });
      };
      return {
        createPage: record("page"),
        createLayout: record("layout"),
        createRoot: record("root"),
        createApi: record("api"),
        createSlice: record("slice"),
        createInterceptor() {},
      };
    },
  });
});

// React Flight needs the `react-server` condition
vi.mock("waku/server", () => ({
  serializeRsc: async (value: unknown) => new TextEncoder().encode(JSON.stringify(value)),
}));
vi.mock("@vitejs/plugin-rsc/rsc", () => ({
  registerClientReference: (value: object, id: string, name: string) =>
    Object.defineProperty(value, "$$typeof", { value: Symbol.for("react.client.reference") }),
}));

vi.mock("waku", () => ({
  createPages(fn: (fns: unknown) => Promise<unknown>) {
    recorded.pending = fn(recorded.fns());
    return {};
  },
}));

// like Waku: RSC requests of client navigations are like `/RSC/R/docs.txt?query=` for `/docs`, route paths are canonical
vi.mock("waku/router/server", () => {
  const canonical = (pathname: string) => pathname.replace(/(\/index\.html|\/)$/, "") || "/";
  return {
    unstable_getRequest: () => recorded.request,
    unstable_parseRouterRequest(req: Request) {
      const url = new URL(req.url);
      const rsc = /^\/RSC\/R(\/.*)\.txt$/.exec(url.pathname);
      if (rsc) return { type: "route", path: rsc[1], query: url.searchParams.get("query") ?? "" };
      return { type: "route", path: canonical(url.pathname), query: url.searchParams.toString() };
    },
    unstable_formatRouterRequest(req: Request, path: string, query?: string) {
      const url = new URL(req.url);
      const rsc = url.pathname.startsWith("/RSC/");
      url.pathname = rsc ? `/RSC/R${canonical(path)}.txt` : canonical(path);
      if (query === undefined) return url;
      if (rsc) url.searchParams.set("query", query);
      else url.search = query;
      return url;
    },
    unstable_notFound() {
      throw new Error("not found");
    },
    unstable_redirect(to: string) {
      throw new Error(`redirect:${to}`);
    },
  };
});

const prefixed: I18nConfig = { languages: ["en", "cn"], defaultLanguage: "en" };
const hidden: I18nConfig = { ...prefixed, hideLocale: "default-locale" };
const files: VirtualFile[] = [
  { type: "page", path: "index.mdx", data: { title: "Home" } },
  { type: "page", path: "index.cn.mdx", data: { title: "首页" } },
  { type: "page", path: "guide.mdx", data: { title: "Guide" } },
];

function site(
  plugins: Plugin<AppShape, any>[] = [],
  i18n?: I18nConfig,
  mode: "static" | "default" | "dynamic" = "static",
) {
  return createPress({ files }, { i18n: i18n as never })
    .plugins(...plugins)
    .config({
      mode,
      preset: [],
      site: { baseUrl: "https://example.com" },
      ui: { renderPage: (props) => `${props.lang}:${props.type}:${props.slugs?.join("/")}` },
    });
}

async function routes(
  plugins: Plugin<AppShape, any>[] = [],
  own: (this: Context, fns: WakuRouteFns) => Awaitable<void> = () => {},
  i18n?: I18nConfig,
  mode?: "static" | "default" | "dynamic",
) {
  const router = await createRouter(site(plugins, i18n, mode));
  router.createPages(own);
  await recorded.pending;
  return router;
}

function paths(kind: string) {
  const out: string[] = [];
  for (const route of recorded.routes) if (route.kind === kind) out.push(route.path ?? route.id!);
  return out.sort();
}

function route(path: string): Route {
  const found = recorded.routes.find((route) => route.path === path);
  if (!found) throw new Error(`missing route ${path}`);
  return found;
}

/** rendered HTML of a route */
async function html(route: Route, props: object): Promise<string> {
  const stream = await renderToReadableStream(await (route.component as FC<object>)(props));
  await stream.allReady;
  return new Response(stream).text();
}

const Page: FC = () => null;
const Lang: FC<{ lang?: string }> = ({ lang }) => createElement("p", null, lang);

describe("createPages", () => {
  it("prefixes every language and renders content through `ui.renderPage`", async () => {
    await routes([], undefined, prefixed);
    expect(paths("layout")).toEqual(["/(default)", "/cn", "/en"]);
    expect(paths("page")).toEqual(["/", "/404", "/cn/[...slugs]", "/en/[...slugs]"]);

    const content = route("/en/[...slugs]");
    const element = (content.component as FC<{ slugs: string[] }>)({ slugs: ["guide"] }) as {
      type: FC<{ slugs: string[]; lang: string }>;
      props: { slugs: string[]; lang: string };
    };
    const rendered = (await element.type(element.props)) as { props: { children: unknown[] } };
    expect(rendered.props.children[2]).toBe("en:undefined:guide");
  });

  it("routes the root of a language rendered on request, unless your own page has it", async () => {
    await routes([], undefined, prefixed, "dynamic");
    expect(paths("page")).toEqual(expect.arrayContaining(["/cn", "/en"]));

    const root = recorded.routes.find((route) => route.kind === "page" && route.path === "/cn");
    const element = (root!.component as FC)({}) as unknown as {
      props: { slugs: string[]; lang: string };
    };
    expect(element.props).toEqual({ slugs: [], lang: "cn" });

    await routes(
      [],
      ({ createPage }) => createPage({ path: "/", lang: "cn", component: Page }),
      hidden,
      "dynamic",
    );
    const roots = paths("page").filter((path) => path === "/cn");
    expect(roots).toEqual(["/cn"]);
    expect(paths("page")).not.toContain("/(default)");
  });

  it("keeps plugin layouts in route groups, your own pages win, two plugins on one path fail", async () => {
    const layout = (path: string): Plugin => ({
      name: "layout",
      waku: { createPages: ({ createLayout }) => createLayout({ path, component: Page }) },
    });
    await expect(routes([layout("/docs")])).rejects.toThrow(/route group/);

    await routes([layout("/(acme)")]);
    expect(paths("layout")).toEqual(["/(acme)"]);

    const page = (name: string): Plugin => ({
      name,
      waku: { createPages: ({ createPage }) => createPage({ path: "/(acme)/x", component: Page }) },
    });
    await routes([page("a")], ({ createPage }) => createPage({ path: "/(fs)/x", component: Page }));
    expect(paths("page")).toEqual(["/(fs)/x", "/404", "/[...slugs]"]);

    await expect(routes([page("a"), page("b")])).rejects.toThrow(
      /"a" and "b" both take the path "\/x"/,
    );
  });

  it("serves the pages of plugins as their routes, a view on their path is an error naming both", async () => {
    const page: Plugin = {
      name: "page",
      waku: { createPages: ({ createPage }) => createPage({ path: "/(acme)/x", component: Page }) },
    };
    await routes([page]);
    expect(paths("page")).toContain("/(acme)/x");

    const view: Plugin<AppShape, { views: { x: {} } }> = {
      name: "view",
      routes: ({ createView }) =>
        createView({ path: "/x", view: () => ({ type: "x", props: {}, node: "x" }) }),
    };
    await expect(routes([page, view])).rejects.toThrow(/"page" and "view" both take the path/);
  });

  it("replaces the routes on every run, like dev reruns", async () => {
    const router = await createRouter(site());
    for (const path of ["/(fs)/a", "/(fs)/b"]) {
      router.createPages(({ createPage }) => createPage({ path, component: Page }));
      await recorded.pending;
    }
    const served: string[] = [];
    for (const route of await getPressContext().getRoutes()) served.push(route.path);
    expect(served).toEqual(["/b"]);
  });

  it("makes a view at `/404` the not found page", async () => {
    const view: Plugin<AppShape, { views: { x: {} } }> = {
      name: "views",
      routes({ createView }) {
        for (const lang of this.languages)
          createView({ lang, path: "/404", view: () => ({ type: "x", props: {}, node: "gone" }) });
      },
    };
    await routes([view]);
    expect(paths("page").filter((path) => path === "/404")).toHaveLength(1);

    // with i18n, the 404 page renders the view in the language of the URL, also with a hidden locale
    await routes([view], undefined, hidden);
    expect(paths("page")).toEqual(["/(default)/[...slugs]", "/404", "/cn/404", "/cn/[...slugs]"]);
  });

  it("registers a view without the pages your own pages take", async () => {
    const tags: Plugin<AppShape, { views: { x: {} } }> = {
      name: "tags",
      routes: ({ createView }) =>
        createView({
          path: "/tags/[tag]",
          staticPaths: ["a", "b"],
          view: () => ({ type: "x", props: {}, node: "tag" }),
        }),
    };
    await routes([tags], ({ createPage }) => createPage({ path: "/(fs)/tags/a", component: Page }));
    expect(route("/tags/[tag]").staticPaths).toEqual([["b"]]);
  });

  it("matches views on the encoded path of the router, decoding it once", async () => {
    const tags: string[] = [];
    const view: Plugin<AppShape, { views: { x: {} } }> = {
      name: "tags",
      routes: ({ createView }) =>
        createView({
          path: "/tags/[tag]",
          render: "dynamic",
          view: ({ tag }) => (tags.push(String(tag)), { type: "x", props: {}, node: "tag" }),
        }),
    };
    await routes([view], undefined, undefined, "default");
    recorded.request = new Request("https://example.com/tags/x");
    for (const path of ["/tags/100%25", "/tags/a%2Fb", "/tags/a%252Fb"])
      await html(route("/tags/[tag]"), { path });
    expect(tags).toEqual(["100%", "a/b", "a%2Fb"]);
  });

  it("gives your own slices their id, a plugin's slice with it is skipped", async () => {
    const slice: Plugin = {
      name: "banner",
      waku: {
        createPages: ({ createSlice }) =>
          createSlice({ id: "banner", component: Page, render: "static" } as never),
      },
    };
    await routes([slice], ({ createSlice }) =>
      createSlice({ id: "banner", component: Lang, render: "static" } as never),
    );
    expect(paths("slice")).toEqual(["banner"]);
    expect(recorded.routes.find((item) => item.kind === "slice")?.component).toBe(Lang);
  });

  it("rejects reading the routes through base options while plugins create them, without a home", async () => {
    const nav: Plugin = {
      name: "nav",
      async routes() {
        await this.getBaseOptions({ lang: undefined });
      },
    };
    const router = await createRouter(
      createPress({ files: [files[2]!] }, {})
        .plugins(nav)
        .config({ preset: [] }),
    );
    router.createPages(() => {});
    await expect(recorded.pending).rejects.toThrow(
      '"nav" reads the routes while plugins create them',
    );
  });

  it("renders the Markdown of your own pages reading the base options, without a home", async () => {
    let read: unknown;
    const About: FC = async () => {
      read = (await getPressContext().getBaseOptions({ lang: undefined })).nav?.url;
      return null;
    };
    const router = await createRouter(
      createPress({ files: [files[2]!] }, {})
        .plugins(llmsPlugin({ routes: "all" }))
        .config({ preset: [] }),
    );
    router.createPages(({ createPage }) => createPage({ path: "/(fs)/about", component: About }));
    await recorded.pending;
    expect(read).toBe("/guide");
  });

  it("defaults `site.baseUrl` to the development server, with a warning", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await createRouter(createPress({ files }, {}).plugins().config({ preset: [] }));
    expect(getPressContext().siteConfig.baseUrl).toBe("http://localhost:3000");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"site.baseUrl" is not set'));
    warn.mockRestore();
  });

  it("renders the head of views from core, with their title and description", async () => {
    const view: Plugin<AppShape, { views: { x: {} } }> = {
      name: "views",
      routes: ({ createView }) =>
        createView({
          path: "/blog",
          view: () => ({
            type: "x",
            props: {},
            node: "posts",
            title: "Blog",
            description: "Posts",
          }),
        }),
    };
    await routes([view]);
    const out = await html(route("/blog"), { path: "/blog" });
    expect(out).toContain("<title>Blog</title>");
    expect(out).toContain('<meta name="description" content="Posts"/>');
    expect(out).toContain('<link rel="canonical" href="https://example.com/blog"/>');
  });

  it("shows the not found page in the language of the URL", async () => {
    const notFound = (url: string) => {
      recorded.request = new Request(new URL(url, "http://localhost"));
      const root = (route("/404").component as FC)({}) as { props: { lang: string } };
      return root.props.lang;
    };

    await routes([], undefined, prefixed);
    expect(route("/404").render).toBe("static");
    expect(notFound("/cn/missing")).toBe("cn");
    expect(notFound("/en/missing")).toBe("en");
    expect(notFound("/cnx/missing")).toBe("en");

    await routes([], undefined, hidden, "default");
    expect(route("/404").render).toBe("dynamic");
    expect(notFound("/cn")).toBe("cn");
    expect(notFound("/missing")).toBe("en");
  });

  it("tells client references apart by React's tag", async () => {
    await routes();
    const ctx = getPressContext();
    expect(ctx.isClientReference({ $$typeof: Symbol.for("react.client.reference") })).toBe(true);
    expect(ctx.isClientReference(Object.assign(() => {}, { $$typeof: Symbol.for("x") }))).toBe(
      false,
    );
    expect(ctx.isClientReference(null)).toBe(false);
  });
});

describe("patchAdapter", () => {
  it("nests server entries, the first plugin outermost, and refuses to overwrite a build option", async () => {
    const order: string[] = [];
    const wrap = (name: string, options?: object): Plugin => ({
      name,
      waku: {
        unstable_serverEntry(entry): WakuServerEntry {
          order.push(name);
          return { ...entry, buildOptions: { ...entry.buildOptions, ...options } };
        },
      },
    });
    const adapter = () => ({ fetch: async () => new Response(), build: async () => {} }) as never;

    let router = await routes([wrap("outer"), wrap("inner")]);
    router.patchAdapter(adapter)({} as never, {} as never);
    expect(order).toEqual(["inner", "outer"]);

    router = await routes([wrap("outer", { KEY: 2 }), wrap("inner", { KEY: 1 })]);
    expect(() => router.patchAdapter(adapter)({} as never, {} as never)).toThrow(
      /"outer" overwrites the build option "KEY" of the plugin "inner"/,
    );
  });
});

describe("createMiddlewares", () => {
  it("chains `waku.honoMiddleware` in layer order before the plugins' `middleware`", async () => {
    const hono = (name: string): Plugin => ({
      name,
      waku: { honoMiddleware: () => async (_c, next) => next() },
    });
    const router = await routes([hono("a"), hono("b")]);
    expect(router.createMiddlewares()).toHaveLength(3);
  });

  it("runs the middleware of plugins on the page of client navigations, addressing redirects and rewrites like the request", async () => {
    const seen: string[] = [];
    const router = await routes(
      [
        {
          async middleware(request, next) {
            seen.push(request.url);
            const { pathname } = new URL(request.url);
            if (pathname === "/old")
              return Response.redirect(new URL("/new?a=1", request.url), 308);
            if (pathname === "/away") return Response.redirect("https://example.org/", 307);
            if (pathname === "/alias") return next("/guide");
            return next();
          },
        },
      ],
      undefined,
      undefined,
      "default",
    );
    const handler = router.createMiddlewares().at(-1)!({
      app: { fetch: async (req: Request) => new Response(req.url) },
    } as never);
    const request = async (url: string) => {
      const c = { req: { raw: new Request(url), url }, res: undefined as Response | undefined };
      await handler(c as never, async () => {
        c.res = new Response("next");
      });
      return c.res!;
    };

    const redirect = await request("http://localhost/RSC/R/old.txt?query=");
    expect(redirect.status).toBe(308);
    expect(redirect.headers.get("Location")).toBe("http://localhost/RSC/R/new.txt?query=a%3D1");
    expect((await request("http://localhost/RSC/R/away.txt?query=")).headers.get("Location")).toBe(
      "https://example.org/",
    );
    expect(await (await request("http://localhost/RSC/R/alias.txt?query=x")).text()).toBe(
      "http://localhost/RSC/R/guide.txt?query=x",
    );
    expect(await (await request("http://localhost/RSC/R/guide.txt?query=")).text()).toBe("next");
    expect(seen).toEqual([
      "http://localhost/old",
      "http://localhost/away",
      "http://localhost/alias?x",
      "http://localhost/guide",
    ]);

    // document requests are the page itself, as requested
    expect((await request("http://localhost/old")).headers.get("Location")).toBe(
      "http://localhost/new?a=1",
    );
    seen.length = 0;
    await request("http://localhost/guide/?flag");
    expect(seen).toEqual(["http://localhost/guide/?flag"]);
  });
});

describe("fsRouterFn", () => {
  const Layout: FC<{ lang?: string; children?: ReactNode }> = ({ lang, children }) =>
    createElement("div", { lang }, children);

  const modules = {
    "./pages/_layout.tsx": async () => ({ default: Layout }),
    "./pages/about.tsx": async () => ({ default: Lang }),
    "./pages/legal.tsx": async () => ({ default: Lang, getConfig: () => ({ autoI18n: false }) }),
    "./pages/tags/[tag].tsx": async () => ({
      default: Lang,
      getConfig: () => ({ staticPaths: ["react"] }),
    }),
  };

  /** the routes of the pages directory, next to the ones of the content */
  function fsPaths(kind: string) {
    return paths(kind).filter((path) => path.includes("(fs)"));
  }

  it("registers pages once without i18n", async () => {
    await routes([], fsRouterFn(modules));

    expect(fsPaths("layout")).toEqual(["/(fs)"]);
    expect(fsPaths("page")).toEqual(["/(fs)/about", "/(fs)/legal", "/(fs)/tags/[tag]"]);
    expect(route("/(fs)/tags/[tag]").staticPaths).toEqual(["react"]);
    expect(await html(route("/(fs)/about"), { path: "/about" })).toContain(
      '<link rel="canonical" href="https://example.com/about"/>',
    );
  });

  it("registers a copy per language with the lang prop", async () => {
    await routes([], fsRouterFn(modules), prefixed);

    expect(fsPaths("layout")).toEqual(["/cn/(fs)", "/en/(fs)"]);
    expect(fsPaths("page")).toEqual([
      "/(default)/(fs)/legal",
      "/cn/(fs)/about",
      "/cn/(fs)/tags/[tag]",
      "/en/(fs)/about",
      "/en/(fs)/tags/[tag]",
    ]);
    expect(route("/cn/(fs)/tags/[tag]").staticPaths).toEqual(["react"]);
    const about = await html(route("/cn/(fs)/about"), { path: "/cn/about" });
    expect(about).toContain("<p>cn</p>");
    expect(about).toContain(
      '<link rel="alternate" hrefLang="en" href="https://example.com/en/about"/>',
    );
    expect(await html(route("/(default)/(fs)/legal"), { path: "/legal" })).toContain("<p></p>");
    const layout = (route("/cn/(fs)").component as FC<{ children: string }>)({
      children: "x",
    }) as { props: { lang: string } };
    expect(layout.props.lang).toBe("cn");
  });

  it("puts the hidden default language in the default group", async () => {
    await routes([], fsRouterFn(modules), hidden);

    expect(fsPaths("layout")).toEqual(["/(default)/(fs)", "/cn/(fs)"]);
    expect(fsPaths("page")).toEqual([
      "/(default)/(fs)/about",
      "/(default)/(fs)/legal",
      "/(default)/(fs)/tags/[tag]",
      "/cn/(fs)/about",
      "/cn/(fs)/tags/[tag]",
    ]);
    expect(await html(route("/(default)/(fs)/about"), { path: "/about" })).toContain("<p>en</p>");
  });
});
