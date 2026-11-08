import { describe, expect, it, vi } from "vitest";
import { createElement, type FC, type ReactNode } from "react";
import { Hono } from "hono/tiny";
import { renderToReadableStream } from "react-dom/server.edge";
import { createRouter, type WakuRouteFns } from "@/router";
import { fsRouterFn } from "@/router/fs";
import { createPress, getPressContext } from "@/press";
import type { AppShape, Awaitable, Context, Plugin } from "@fumapress/core";
import { llmsPlugin } from "@fumapress/core/plugins/llms.txt";
import type { I18nConfig } from "fumadocs-core/i18n";
import type { _Internal, VirtualFile } from "fumadocs-core/source";

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
        createInterceptor: record("interceptor"),
      };
    },
  });
});

/** the env Waku's adapters set, `unstable_setAllEnv` of their builder */
const wakuEnv = vi.hoisted(() => ({ current: undefined as unknown }));
vi.mock("waku/adapter-builders", () => ({
  unstable_createServerEntryAdapter:
    (fn: (input: object, options: unknown) => unknown) => (handlers: unknown, options: unknown) =>
      fn({ handlers, unstable_setAllEnv: (env: unknown) => (wakuEnv.current = env) }, options),
}));

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
    getRequest: () => recorded.request,
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

const dynamic: _Internal.AnyInput = { files: () => files };
/** `guide` is prerendered, `status` renders on demand */
const mixed: _Internal.AnyInput = {
  docs: { files: [{ type: "page", path: "guide.mdx", data: { title: "Guide" } }] },
  live: { files: () => [{ type: "page", path: "status.mdx", data: { title: "Status" } }] },
};
const dynamicApi: Plugin = {
  name: "api",
  routes: ({ createApi }) => createApi({ path: "/api/x", GET: () => new Response() }),
};

function site(
  plugins: Plugin<AppShape, any>[] = [],
  i18n?: I18nConfig,
  content: _Internal.AnyInput = { files },
  config: object = {},
) {
  return createPress(content, { i18n: i18n as never })
    .plugins(...plugins)
    .config({
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
  content?: _Internal.AnyInput,
) {
  const router = await createRouter(site(plugins, i18n, content));
  router.createPages(own);
  await recorded.pending;
  return router;
}

function paths(kind: string) {
  const out: string[] = [];
  for (const route of recorded.routes) if (route.kind === kind) out.push(route.path ?? route.id!);
  return out.sort();
}

/** the page routes at `path`: a static one and a dynamic one can share a pattern */
function pagesAt(path: string) {
  const out: Pick<Route, "render" | "staticPaths">[] = [];
  for (const { kind, path: routePath, render, staticPaths } of recorded.routes)
    if (kind === "page" && routePath === path) out.push({ render, staticPaths });
  return out;
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
const xView = (node: string) => ({ type: "x" as const, props: {}, node });

const Page: FC = () => null;
const Lang: FC<{ lang?: string }> = ({ lang }) => createElement("p", null, lang);

describe("createPages", () => {
  it("registers a static API route before a dynamic one on its pattern, Waku refuses the other order", async () => {
    const GET = () => new Response();
    await routes([
      {
        routes({ createApi }) {
          createApi({ path: "/og/[...slugs]", GET });
          createApi({ path: "/og/[...slugs]", render: "static", staticPaths: [["a"]], GET });
        },
      },
    ]);
    expect(recorded.routes.filter((route) => route.path === "/og/[...slugs]")).toMatchObject([
      { render: "static" },
      { render: "dynamic" },
    ]);
  });

  it("prefixes every language and renders content through `ui.renderPage`", async () => {
    await routes([], undefined, prefixed);
    expect(paths("layout")).toEqual(["/(default)", "/cn", "/en"]);
    expect(paths("page")).toEqual(["/", "/404", "/cn/[...slugs]", "/en/[...slugs]"]);

    const [, page] = await contentPage("/en/[...slugs]", ["guide"]);
    expect(page).toBe("en:undefined:guide");
  });

  it("renders content pages like their source, a site can mix both", async () => {
    await routes();
    expect(pagesAt("/[...slugs]")).toEqual([
      { render: "static", staticPaths: [[], ["index.cn"], ["guide"]] },
    ]);

    await routes([], undefined, undefined, dynamic);
    expect(pagesAt("/[...slugs]")).toEqual([{ render: "dynamic", staticPaths: undefined }]);

    await routes([], undefined, undefined, mixed);
    expect(pagesAt("/[...slugs]")).toEqual([
      { render: "static", staticPaths: [["guide"]] },
      { render: "dynamic", staticPaths: undefined },
    ]);
    const [, page] = await contentPage("/[...slugs]", ["status"]);
    expect(page).toBe("undefined:live:status");
  });

  it("serves content pages at the URLs of the loader's `url` option", async () => {
    const press = createPress(
      { files },
      { url: (slugs) => `/docs/${slugs.join("/")}`.replace(/\/$/, "") },
    ).config({
      preset: [],
      ui: { renderPage: (props) => `${props.lang}:${props.type}:${props.slugs?.join("/")}` },
    });
    (await createRouter(press)).createPages(() => {});
    await recorded.pending;
    expect(pagesAt("/[...slugs]")).toEqual([
      { render: "static", staticPaths: [["docs"], ["docs", "index.cn"], ["docs", "guide"]] },
    ]);

    const [, page] = await contentPage("/[...slugs]", ["docs", "guide"]);
    expect(page).toBe("undefined:undefined:guide");
  });

  it("makes custom pages static by default, on any content", async () => {
    await routes(
      [],
      ({ createPage }) => createPage({ path: "/(fs)/about", component: Page }),
      undefined,
      dynamic,
    );
    expect(route("/(fs)/about").render).toBe("static");
  });

  it("redirects the root in the way the site is served", async () => {
    await routes([], undefined, prefixed);
    expect(route("/").render).toBe("static");

    await routes([dynamicApi], undefined, prefixed);
    expect(route("/").render).toBe("dynamic");

    // routes reaching Waku without core count too
    await routes(
      [],
      ({ createApi }) => createApi({ path: "/x", render: "dynamic", handlers: {} }),
      prefixed,
    );
    expect(route("/").render).toBe("dynamic");

    await routes([], undefined, prefixed, dynamic);
    expect(route("/").render).toBe("dynamic");
  });

  it("routes the root of a language rendered on demand, unless a custom page has it", async () => {
    await routes([], undefined, prefixed, dynamic);
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
      dynamic,
    );
    const roots = paths("page").filter((path) => path === "/cn");
    expect(roots).toEqual(["/cn"]);
    expect(paths("page")).not.toContain("/(default)");
  });

  it("keeps plugin layouts in route groups, custom pages win, two plugins on one path fail", async () => {
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

  it("registers a view without the pages custom pages take", async () => {
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
    await routes([view]);
    recorded.request = new Request("https://example.com/tags/x");
    for (const path of ["/tags/100%25", "/tags/a%2Fb", "/tags/a%252Fb"])
      await html(route("/tags/[tag]"), { path });
    expect(tags).toEqual(["100%", "a/b", "a%2Fb"]);
  });

  it("gives custom layouts and slices their path and id, a plugin's are skipped", async () => {
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

  it("renders the head of views from core, with the title and description of their data", async () => {
    const view = views(({ createView }) =>
      createView({
        path: "/blog",
        data: { title: "Blog", description: "Posts" },
        view: () => xView("posts"),
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

    await routes([dynamicApi], undefined, hidden);
    expect(route("/404").render).toBe("dynamic");
    expect(notFound("/cn")).toBe("cn");
    expect(notFound("/missing")).toBe("en");

    await routes([], undefined, hidden, dynamic);
    expect(route("/404").render).toBe("dynamic");
  });
});

describe("Root", () => {
  /** what the document gets at the layout `path` */
  async function renderRoot(
    config: { meta?: object; ui?: object },
    i18n: I18nConfig,
    path: string,
  ) {
    let props: { children: { props: { i18n?: object } } };
    const router = await createRouter(
      site([], i18n, undefined, {
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

  it.each([
    ["default-locale", hidden, "default-locale"],
    ["never", prefixed, undefined],
  ])(
    "gives a custom `i18n` the URLs of the site without translations: %s",
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

describe("the root", () => {
  it("renders the `banner` items above every page", async () => {
    const Banner = () => createElement("p", { id: "banner" }, "banner");
    await routes([
      {
        slots: ({ page }) =>
          page ? undefined : [{ name: "test:banner", region: "banner", component: Banner }],
      },
    ]);
    const root = recorded.routes.find((item) => item.kind === "root")!;
    const out = await html(root, { children: createElement("main", null, "page") });

    expect(out).toContain('<p id="banner">banner</p><main>page</main>');
  });
});

describe("patchAdapter", () => {
  it("negotiates the static files adapters serve before middleware, with their type", async () => {
    const adapter = () =>
      ({
        fetch: async (request: Request) =>
          new URL(request.url).pathname === "/page.md"
            ? new Response("md", { headers: { "Content-Type": "application/octet-stream" } })
            : new Response("html", { headers: { "Content-Type": "text/html" } }),
        build: async () => {},
      }) as never;
    const router = await routes([llmsPlugin()]);
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
    const router = await routes(plugins);
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

  it("runs the middleware of plugins on a request preferring Markdown, and again on its rewrite", async () => {
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
    expect(seen).toEqual(["/live", "/live.md"]);

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
    const router = await routes();
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
});

describe("middleware", () => {
  /** the `fetch` of an adapter answering with the URL it serves, after the middleware of `plugins` */
  async function serve(
    plugins: Plugin<AppShape, any>[],
    fetch = async (req: Request) => new Response(req.url),
  ) {
    const router = await routes(plugins);
    const entry = router.patchAdapter(() => ({ fetch, build: async () => {} }) as never)(
      {} as never,
      {} as never,
    );
    return (url: string, init?: RequestInit) => entry.fetch(new Request(url, init));
  }

  it("runs the middleware of plugins on the page of client navigations, addressing redirects and rewrites like the request", async () => {
    const seen: string[] = [];
    const request = await serve([
      {
        async middleware(request, next) {
          seen.push(request.url);
          const { pathname } = new URL(request.url);
          if (pathname === "/old") return Response.redirect(new URL("/new?a=1", request.url), 308);
          if (pathname === "/away") return Response.redirect("https://example.org/", 307);
          if (pathname === "/alias") return next("/guide");
          return next();
        },
      },
    ]);

    const location = async (url: string) => (await request(url)).headers.get("Location");

    const redirect = await request("http://localhost/RSC/R/old.txt?query=");
    expect(redirect.status).toBe(308);
    expect(redirect.headers.get("Location")).toBe("http://localhost/RSC/R/new.txt?query=a%3D1");
    expect(await location("http://localhost/RSC/R/away.txt?query=")).toBe("https://example.org/");
    expect(await (await request("http://localhost/RSC/R/alias.txt?query=x")).text()).toBe(
      "http://localhost/RSC/R/guide.txt?query=x",
    );
    expect(await (await request("http://localhost/RSC/R/guide.txt?query=")).text()).toBe(
      "http://localhost/RSC/R/guide.txt?query=",
    );
    expect(seen).toEqual([
      "http://localhost/old",
      "http://localhost/away",
      "http://localhost/alias?x",
      // a rewrite re-enters the chain
      "http://localhost/guide?x",
      "http://localhost/guide",
    ]);

    // document requests are the page itself, as requested
    expect(await location("http://localhost/old")).toBe("http://localhost/new?a=1");
    seen.length = 0;
    await request("http://localhost/guide?flag");
    expect(seen).toEqual(["http://localhost/guide?flag"]);
  });

  it("sees the prerendered pages and static files a server serves, before the adapter", async () => {
    const seen: string[] = [];
    // like Node's adapter: `serveStatic` first, then Waku
    const request = await serve(
      [
        {
          middleware(request, next) {
            const { pathname } = new URL(request.url);
            seen.push(pathname);
            return pathname === "/private"
              ? Promise.resolve(new Response(null, { status: 401 }))
              : next();
          },
        },
      ],
      async (req) => new Response(`file ${new URL(req.url).pathname}`),
    );

    expect(await (await request("http://localhost/guide")).text()).toBe("file /guide");
    expect(await (await request("http://localhost/assets/app.js")).text()).toBe(
      "file /assets/app.js",
    );
    expect((await request("http://localhost/private")).status).toBe(401);
    expect(seen).toEqual(["/guide", "/assets/app.js", "/private"]);
  });

  it("runs on the `fetch` of `defaultExport` after Cloudflare sets the env of Waku, never on the loopback of Waku's build", async () => {
    const seen: unknown[] = [];
    const router = await routes([
      {
        middleware: async () => {
          seen.push(wakuEnv.current);
          return new Response(null, { status: 401 });
        },
      },
    ]);
    const adapterFetch = async () => new Response("adapter");
    const entry = router.patchAdapter(
      () =>
        ({
          fetch: adapterFetch,
          build: async () => {},
          defaultExport: { fetch: adapterFetch, queue: 1 },
        }) as never,
    )({} as never, {} as never);
    const defaultExport = entry.defaultExport as {
      fetch: (request: Request, env: object) => Promise<Response>;
      queue: number;
    };

    expect((await defaultExport.fetch(new Request("http://localhost/"), { KEY: "v" })).status).toBe(
      401,
    );
    expect(seen).toEqual([{ KEY: "v" }]);
    expect(defaultExport.queue).toBe(1);
    const loopback = new Request("http://localhost/__waku_internal_build_static_files");
    expect(await (await entry.fetch(loopback)).text()).toBe("adapter");
    expect(await (await defaultExport.fetch(loopback, {})).text()).toBe("adapter");
  });

  it("gives the build of plugins the pages as built, without the middleware", async () => {
    let built: string | undefined;
    const router = await routes([
      {
        middleware: async () => new Response(null, { status: 401 }),
        async build({ fetch }) {
          built = await (await fetch(new Request("http://localhost/"))).text();
        },
      },
    ]);
    const entry = router.patchAdapter(
      () => ({ fetch: async () => new Response("page"), build: async () => {} }) as never,
    )({} as never, {} as never);
    await entry.build({ emitFile: async () => {} } as never, { serverless: true } as never);

    expect(built).toBe("page");
  });
});

describe("build", () => {
  /** the `serverless` option of a platform adapter after the build, and the warnings */
  async function build(plugins: Plugin<AppShape, any>[], serverless = true, config: object = {}) {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const router = await createRouter(site(plugins, undefined, undefined, config));
    router.createPages(() => {});
    await recorded.pending;
    const entry = router.patchAdapter(
      () => ({ fetch: async () => new Response(), build: async () => {} }) as never,
    )({} as never, {} as never);
    const options = { serverless };
    await entry.build({ emitFile: async () => {} } as never, options);
    const warnings = warn.mock.calls.map(([message]) => String(message));
    warn.mockRestore();
    return { serverless: options.serverless, warnings };
  }

  const guard: Plugin = { name: "guard", middleware: (_, next) => next() };

  it("deploys a function for the middleware of plugins, not for a static site", async () => {
    expect(await build([])).toEqual({ serverless: false, warnings: [] });
    expect(await build([guard])).toEqual({ serverless: true, warnings: [] });
    expect((await build([dynamicApi])).serverless).toBe(true);
    // the preset's middleware, like Markdown negotiation, degrades on a static site
    expect(await build([], true, { preset: [() => guard] })).toEqual({
      serverless: false,
      warnings: [],
    });
  });

  it("warns when the middleware of plugins never runs, on a build without a server", async () => {
    const { serverless, warnings } = await build(
      [guard, { middleware: (_, next) => next() }],
      false,
    );
    expect(serverless).toBe(false);
    expect(warnings).toEqual([
      expect.stringContaining('the `middleware` of "guard", an unnamed plugin never runs'),
    ]);
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

  it("skips the ignored directories of Waku and registers interceptors", async () => {
    await routes(
      [],
      fsRouterFn({
        "./pages/_actions/save.ts": async () => ({ save() {} }),
        "./pages/_interceptors/log.ts": async () => ({ default: async () => {} }),
        "./pages/about.tsx": async () => ({ default: Lang }),
      }),
    );
    expect(fsPaths("page")).toEqual(["/(fs)/about"]);
    expect(recorded.routes.filter((route) => route.kind === "interceptor")).toHaveLength(1);
  });

  it("makes pages static and API routes dynamic by default", async () => {
    const GET = async () => new Response();
    await routes(
      [],
      fsRouterFn({
        "./pages/about.tsx": async () => ({ default: Lang }),
        "./pages/live.tsx": async () => ({
          default: Lang,
          getConfig: () => ({ render: "dynamic" }),
        }),
        "./pages/_api/own.ts": async () => ({ GET }),
      }),
    );
    expect(route("/(fs)/about").render).toBe("static");
    expect(route("/(fs)/live").render).toBe("dynamic");
    expect(route("/own").render).toBe("dynamic");
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
