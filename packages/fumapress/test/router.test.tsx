import { describe, expect, it, vi } from "vitest";
import { createElement, type FC, type ReactNode } from "react";
import { Hono } from "hono/tiny";
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
  registerClientReference: (value: object) =>
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
  config: object = {},
) {
  return createPress({ files }, { i18n: i18n as never })
    .plugins(...plugins)
    .config({
      mode,
      preset: [],
      site: { baseUrl: "https://example.com" },
      ui: { renderPage: (props) => `${props.lang}:${props.type}:${props.slugs?.join("/")}` },
      ...config,
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

/** the children of a content page: its head, then the page */
async function contentPage(path: string, slugs: string[]) {
  const element = (route(path).component as FC<{ slugs: string[] }>)({ slugs }) as {
    type: FC<{ slugs: string[]; lang: string }>;
    props: { slugs: string[]; lang: string };
  };
  const rendered = (await element.type(element.props)) as { props: { children: unknown[] } };
  return rendered.props.children;
}

type ViewPlugin = Plugin<AppShape, { views: { x: {} } }>;
const views = (routes: ViewPlugin["routes"]): ViewPlugin => ({ name: "views", routes });
const xView = (node: string, head?: { title: string; description: string }) => ({
  type: "x" as const,
  props: {},
  node,
  ...head,
});

const Page: FC = () => null;
const Lang: FC<{ lang?: string }> = ({ lang }) => createElement("p", null, lang);

describe("createPages", () => {
  it("prefixes every language and renders content through `ui.renderPage`", async () => {
    await routes([], undefined, prefixed);
    expect(paths("layout")).toEqual(["/(default)", "/cn", "/en"]);
    expect(paths("page")).toEqual(["/", "/404", "/cn/[...slugs]", "/en/[...slugs]"]);

    const [, , page] = await contentPage("/en/[...slugs]", ["guide"]);
    expect(page).toBe("en:undefined:guide");
  });

  it("keys stylesheets in head by URL, pages have other tags before them", async () => {
    const stylesheet: Plugin = {
      name: "stylesheet",
      head: () => [{ tag: "link", attrs: { rel: "stylesheet", href: "/a.css" } }],
    };
    await routes([stylesheet], undefined, prefixed);
    const [head] = (await contentPage("/en/[...slugs]", ["guide"])) as {
      type: FC<object>;
      props: object;
    }[];
    const tags = (await head!.type(head!.props)) as unknown as { key: string; props: object }[];
    const link = tags.find((tag) => "precedence" in tag.props);
    expect(link?.key).toBe("/a.css");
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
    await routes([page("a")]);
    expect(paths("page")).toContain("/(acme)/x");

    await routes([page("a")], ({ createPage }) => createPage({ path: "/(fs)/x", component: Page }));
    expect(paths("page")).toEqual(["/(fs)/x", "/404", "/[...slugs]"]);

    await expect(routes([page("a"), page("b")])).rejects.toThrow(
      /"a" and "b" both take the path "\/x"/,
    );
  });

  it("keeps a static path that looks like a route group", async () => {
    await routes([], ({ createPage }) =>
      createPage({ path: "/(fs)/tags/[tag]", staticPaths: ["(draft)"], component: Page }),
    );
    const [route] = await getPressContext().getPageRoutes();
    expect(route?.path).toBe("/tags/[tag]");
    expect(route?.pages[0]?.path).toBe("/tags/(draft)");
  });

  it("replaces the routes on every run, like dev reruns", async () => {
    const router = await createRouter(site());
    for (const path of ["/(fs)/a", "/(fs)/b"]) {
      router.createPages(({ createPage }) => createPage({ path, component: Page }));
      await recorded.pending;
    }
    const served: string[] = [];
    for (const route of await getPressContext().getPageRoutes()) served.push(route.path);
    expect(served).toEqual(["/b"]);
  });

  it("makes a view at `/404` the not found page", async () => {
    const view = views(function ({ createView }) {
      for (const lang of this.languages)
        createView({ lang, path: "/404", view: () => xView("gone") });
    });
    await routes([view]);
    expect(paths("page").filter((path) => path === "/404")).toHaveLength(1);

    // with i18n, the 404 page renders the view in the language of the URL, also with a hidden locale
    await routes([view], undefined, hidden);
    expect(paths("page")).toEqual(["/(default)/[...slugs]", "/404", "/cn/404", "/cn/[...slugs]"]);
  });

  it("registers a view without the pages your own pages take", async () => {
    const tags = views(({ createView }) =>
      createView({ path: "/tags/[tag]", staticPaths: ["a", "b"], view: () => xView("tag") }),
    );
    await routes([tags], ({ createPage }) => createPage({ path: "/(fs)/tags/a", component: Page }));
    expect(route("/tags/[tag]").staticPaths).toEqual([["b"]]);
  });

  it("matches views on the encoded path of the router, decoding it once", async () => {
    const tags: string[] = [];
    const view = views(({ createView }) =>
      createView({
        path: "/tags/[tag]",
        render: "dynamic",
        view: ({ tag }) => (tags.push(String(tag)), xView("tag")),
      }),
    );
    await routes([view], undefined, undefined, "default");
    recorded.request = new Request("https://example.com/tags/x");
    for (const path of ["/tags/100%25", "/tags/a%2Fb", "/tags/a%252Fb"])
      await html(route("/tags/[tag]"), { path });
    expect(tags).toEqual(["100%", "a/b", "a%2Fb"]);
  });

  it("gives your own layouts and slices their path and id, a plugin's are skipped", async () => {
    const plugin: Plugin = {
      name: "banner",
      waku: {
        createPages({ createLayout, createSlice }) {
          createLayout({ path: "/(acme)", component: Page });
          createLayout({ path: "/(other)", component: Page });
          createSlice({ id: "banner", component: Page, render: "static" } as never);
          createSlice({ id: "other", component: Page, render: "static" } as never);
        },
      },
    };
    await routes([plugin], ({ createLayout, createSlice }) => {
      createLayout({ path: "/(acme)", component: Lang });
      createSlice({ id: "banner", component: Lang, render: "static" } as never);
    });
    expect(paths("layout")).toEqual(["/(acme)", "/(other)"]);
    expect(paths("slice")).toEqual(["banner", "other"]);
    expect(recorded.routes.find((item) => item.id === "banner")?.component).toBe(Lang);

    const layout = route("/(acme)").component as FC<{ children: string }>;
    expect((layout({ children: "x" }) as { type: unknown }).type).toBe(Lang);
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
    const view = views(({ createView }) =>
      createView({
        path: "/blog",
        view: () => xView("posts", { title: "Blog", description: "Posts" }),
      }),
    );
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

describe("Root", () => {
  /** what the document gets at the layout `path` */
  async function renderRoot(
    config: { meta?: object; ui?: object },
    i18n: I18nConfig,
    path: string,
  ) {
    let props: { head: { props: { children: unknown[] } }; children: { props: { i18n?: object } } };
    const router = await createRouter(
      site([], i18n, "static", {
        ...config,
        ui: { ...config.ui, renderRoot: (root: never) => ((props = root), null) },
      }),
    );
    router.createPages(() => {});
    await recorded.pending;
    const element = (route(path).component as FC<{ children: string }>)({ children: "x" }) as {
      type: FC<object>;
      props: object;
    };
    await element.type(element.props);
    return props!;
  }

  it("renders the deprecated `meta`", async () => {
    const meta = { root: () => "root meta", page: () => "page meta" };
    const { head } = await renderRoot({ meta }, prefixed, "/en");
    expect(head.props.children[1]).toBe("root meta");
    const [, tag] = await contentPage("/en/[...slugs]", ["guide"]);
    expect(tag).toBe("page meta");
  });

  it.each([
    ["default-locale", hidden, "default-locale"],
    ["never", prefixed, undefined],
  ])(
    "gives your own `i18n` the URLs of the site without translations: %s",
    async (_, i18n, hide) => {
      const locales = [{ locale: "en", name: "English" }];
      const { children } = await renderRoot(
        { ui: { providerProps: () => ({ i18n: { locales } }) } },
        i18n,
        "/cn",
      );
      expect(children.props.i18n).toMatchObject({
        locale: "cn",
        locales,
        defaultLanguage: "en",
        hideLocale: hide,
      });
    },
  );
});

describe("patchAdapter", () => {
  it("nests server entries, the first plugin outermost", async () => {
    const order: string[] = [];
    const wrap = (name: string): Plugin => ({
      name,
      waku: {
        unstable_serverEntry(entry): WakuServerEntry {
          order.push(name);
          return entry;
        },
      },
    });
    const adapter = () => ({ fetch: async () => new Response(), build: async () => {} }) as never;

    const router = await routes([wrap("outer"), wrap("inner")]);
    router.patchAdapter(adapter)({} as never, {} as never);
    expect(order).toEqual(["inner", "outer"]);
  });

  it("negotiates the static files adapters serve before middleware, with their type", async () => {
    const adapter = () =>
      ({
        fetch: async (request: Request) =>
          new URL(request.url).pathname === "/page.md"
            ? new Response("md", { headers: { "Content-Type": "application/octet-stream" } })
            : new Response("html", { headers: { "Content-Type": "text/html" } }),
        build: async () => {},
      }) as never;
    const router = await routes([llmsPlugin()], undefined, undefined, "default");
    const { fetch } = router.patchAdapter(adapter)({} as never, {} as never);
    const request = (path: string, accept = "*/*") =>
      fetch(new Request(`http://localhost${path}`, { headers: { Accept: accept } }));

    const file = await request("/page.md");
    expect(file.headers.get("Content-Type")).toBe("text/markdown; charset=utf-8");

    const negotiated = await request("/page", "text/markdown");
    expect(await negotiated.text()).toBe("md");
    expect(negotiated.headers.get("Content-Type")).toBe("text/markdown; charset=utf-8");
    expect(negotiated.headers.get("Vary")).toBe("Accept");

    const html = await request("/page", "text/html");
    expect(await html.text()).toBe("html");
    expect(html.headers.get("Vary")).toBe("Accept");
  });

  /** an adapter with a server: static files first, then the middleware of the router */
  async function server(plugins: Plugin<AppShape, any>[], headers?: HeadersInit) {
    const router = await routes(plugins, undefined, undefined, "default");
    const app = new Hono();
    for (const middleware of router.createMiddlewares()) app.use(middleware({ app }));
    app.all("*", (c) =>
      c.req.path.endsWith(".md")
        ? new Response("md", { headers: { "Content-Type": "text/markdown" } })
        : c.html("rendered"),
    );
    const adapter = () =>
      ({
        fetch: async (request: Request) =>
          new URL(request.url).pathname === "/static"
            ? new Response("html", { headers: { "Content-Type": "text/html", ...headers } })
            : app.fetch(request),
        build: async () => {},
      }) as never;
    const { fetch } = router.patchAdapter(adapter)({} as never, {} as never);
    return (path: string, init?: RequestInit) =>
      fetch(new Request(`http://localhost${path}`, init));
  }

  it("runs the middleware of plugins once on a request preferring Markdown", async () => {
    const seen: string[] = [];
    const request = await server([
      {
        middleware(request, next) {
          seen.push(new URL(request.url).pathname);
          return next();
        },
      },
      llmsPlugin(),
    ]);

    const headers = { Accept: "text/markdown" };
    expect(await (await request("/live", { headers })).text()).toBe("md");
    expect(seen).toEqual(["/live.md"]);

    seen.length = 0;
    await request("/live.md");
    expect(seen).toEqual(["/live.md"]);

    seen.length = 0;
    await request("/live", { method: "POST", headers, body: "body" });
    expect(seen).toEqual(["/live"]);
  });

  it("adds `Vary` only where the plugin negotiates, to the fields of the response", async () => {
    const request = await server([llmsPlugin({ autoRedirect: false })]);
    expect((await request("/static")).headers.get("Vary")).toBeNull();

    const varying = await server([llmsPlugin()], { Vary: "Accept-Encoding" });
    expect((await varying("/static")).headers.get("Vary")).toBe("Accept-Encoding, Accept");
    expect((await varying("/live")).headers.get("Vary")).toBe("Accept");
  });
});

describe("createMiddlewares", () => {
  it("answers paths outside of the base path before Waku's router throws on them", async () => {
    vi.stubEnv("BASE_URL", "/repo/");
    const router = await routes([], undefined, undefined, "default");
    const app = new Hono();
    for (const middleware of router.createMiddlewares()) app.use(middleware({ app }));
    app.all("*", (c) => c.text("page"));
    vi.unstubAllEnvs();

    expect((await app.fetch(new Request("http://localhost/repo/a"))).status).toBe(200);
    expect((await app.fetch(new Request("http://localhost/repox"))).status).toBe(404);
    expect((await app.fetch(new Request("http://localhost/a"))).status).toBe(404);
    const root = await app.fetch(new Request("http://localhost/repo?a=1"));
    expect(root.status).toBe(308);
    expect(root.headers.get("Location")).toBe("/repo/?a=1");
  });

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

    const location = async (url: string) => (await request(url)).headers.get("Location");

    const redirect = await request("http://localhost/RSC/R/old.txt?query=");
    expect(redirect.status).toBe(308);
    expect(redirect.headers.get("Location")).toBe("http://localhost/RSC/R/new.txt?query=a%3D1");
    expect(await location("http://localhost/RSC/R/away.txt?query=")).toBe("https://example.org/");
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
    expect(await location("http://localhost/old")).toBe("http://localhost/new?a=1");
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

  it("generates the static paths of API routes", async () => {
    const GET = async () => new Response();
    await routes(
      [],
      fsRouterFn({
        "./pages/_api/og/[...slugs].ts": async () => ({
          GET,
          getConfig: () => ({ render: "static", staticPaths: [["a.webp"]] }),
        }),
      }),
    );
    expect(route("/og/[...slugs]").staticPaths).toEqual([["a.webp"]]);
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
