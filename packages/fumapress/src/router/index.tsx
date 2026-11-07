import { createPages } from "waku";
import { createElement, Fragment, type FC, type ReactNode } from "react";
import renderers from "virtual:fumapress/renderers";
import {
  getHomeUrl,
  stripBase,
  type ApiRoute,
  type AppShape,
  type Awaitable,
  type HeadTag,
  type PluginInfo,
  type Press,
  type PressBuildOutput,
  type PressContext,
  type PressLang,
  type RouteHandler,
  type RouteOptions,
  type RouteParams,
} from "@fumapress/core";
import {
  canonicalPath,
  createPressContext,
  matchRoute,
  methods,
  notFoundView,
  pathLocale,
  rootRedirect,
  wrapSlot,
  type PageRouteInput,
  type ServedRoute,
  type PressInput,
  type RenderTarget,
} from "@fumapress/core/runtime";
import { HomeShell } from "@fumapress/core/ui/home";
import { renderRoute } from "fumadocs-core/server";
import {
  unstable_formatRouterRequest,
  unstable_getRequest,
  unstable_notFound,
  unstable_parseRouterRequest,
  unstable_redirect,
  type CreateApi,
  type CreateInterceptor,
  type CreateRoot,
  type CreateSlice,
} from "waku/router/server";
import type { Hono } from "hono/tiny";
import type { ApiContext } from "waku/router";
import type { MiddlewareHandler } from "hono";
import stylesInline from "virtual:fumapress/css?inline";
import stylesHref from "virtual:fumapress/css?url";
import { decodePathname, joinPaths } from "@/lib/pathname";
import { PressProvider } from "@/components/provider";
import { Preload } from "@/components/preload";
import { getPageTreeFiles, pageTreePlugin } from "@/router/page-tree";
import {
  recommendedPreset,
  setPressContext,
  type AdapterServerEntry,
  type ServerEntryAdapter,
  type WakuAppShape,
  type WakuPressConfig,
  type WakuServerEntry,
} from "@/press";

/** `getConfig()` of route files; extends `RouteOptions`, where plugins declare their keys */
export interface WakuRouteConfig extends RouteOptions {
  render?: "static" | "dynamic";
  /** static paths of a static page with slugs, shared by every language of `autoI18n` */
  staticPaths?: string[] | string[][];
  /**
   * register the page (or layout) once per language if i18n is configured, under the language prefix and with a `lang`
   * prop; otherwise once without prefix, rendered in the default language
   *
   * @defaultValue true
   */
  autoI18n?: boolean;
}

/** props of custom pages and layouts: `WakuRouteProps<typeof app, "/showcase/[slug]">` types the params of the path */
export type WakuRouteProps<A extends Press<any, any> = Press, Path extends string = string> = {
  /** the rendered path, without the base path */
  path: string;
  lang: PressLang<A>;
} & (string extends Path
  ? { [param: string]: string | string[] | undefined }
  : ApiContext<Path>["params"]);

/** custom routes and the ones of `waku.createPages`, `WakuPageOptions<typeof app>` types `lang` */
export interface WakuPageOptions<A extends Press<any, any> = Press> extends Omit<
  WakuRouteConfig,
  "autoI18n"
> {
  /** pathname without language prefix */
  path: string;
  /** the language of the page, its copies in other languages share the `path` */
  lang?: PressLang<A>;
  component: FC<never>;
  /** match `path` literally, for paths with brackets */
  exactPath?: boolean;
  /** Waku's `slices`: the ids of the slices the page renders */
  slices?: string[];
  /** source file of the route, files only used by static routes are pruned from the server bundle */
  unstable_sourceFile?: string;
}

/** custom layouts and the ones of `waku.createPages` */
export type WakuLayoutOptions<A extends Press<any, any> = Press> = Pick<
  WakuPageOptions<A>,
  "path" | "lang" | "component" | "render" | "unstable_sourceFile"
>;

/** Waku's `createPages` functions with Fumapress' `lang`; `createSlice`, `createApi`, `createInterceptor` and `createRoot` are Waku's own */
export interface WakuRouteFns<A extends Press<any, any> = Press> {
  createPage(page: WakuPageOptions<A>): void;
  createLayout(layout: WakuLayoutOptions<A>): void;
  createRoot: CreateRoot;
  createApi: CreateApi;
  createSlice: CreateSlice;
  createInterceptor: CreateInterceptor;
}

/** the tag of React's client references, exports of `'use client'` modules on the server */
const clientReference = Symbol.for("react.client.reference");
/** route group of pages without a language prefix, rendered inside the root layout of the default language */
const DEFAULT_GROUP = "/(default)";
const rscBase: string = import.meta.env.WAKU_CONFIG_RSC_BASE ?? "RSC";
const styleTag = import.meta.env.DEV ? (
  <style>{stylesInline}</style>
) : (
  <link rel="stylesheet" href={stylesHref} />
);

/** the Waku site of `press.config`, for the server entry */
export interface WakuRouter<A extends Press<any, any> = Press> {
  /** Waku's pages: `fsRoutes` are custom, then the plugins', the views, the API routes and the content */
  createPages(
    fsRoutes: (this: PressContext<A>, fns: WakuRouteFns<A>) => Awaitable<void>,
  ): ReturnType<typeof createPages>;
  createMiddlewares(): ((opts: { app: Hono }) => MiddlewareHandler)[];
  patchAdapter<Options>(adapter: ServerEntryAdapter<Options>): ServerEntryAdapter<Options>;
  /** aborts `this.signal` of plugins */
  dispose(): void;
}

/** the Waku site of `press.config`: its pages, middleware and server entry */
export async function createRouter<A extends Press<any, any>>(press: A): Promise<WakuRouter<A>> {
  const { config } = press["~press"] as PressInput<WakuPressConfig<AppShape>>;
  const controller = new AbortController();
  const ctx = await createPressContext<WakuAppShape>(press, {
    base: import.meta.env.BASE_URL,
    baseUrl: config.site?.baseUrl ?? defaultBaseUrl(),
    preset: recommendedPreset,
    defaults: [...renderers, pageTreePlugin()],
    signal: controller.signal,
    isClientReference: (value) =>
      (typeof value === "function" || (typeof value === "object" && value !== null)) &&
      "$$typeof" in value &&
      value.$$typeof === clientReference,
  });
  setPressContext(ctx);
  const { plugins } = ctx;
  const i18n = ctx.i18nConfig;

  /** the route prefix of a language, pages outside any language join the default group */
  function langBase(lang?: string): string {
    const out = ctx.localizePath(lang, "/");
    return out === "/" && i18n ? DEFAULT_GROUP : out;
  }

  async function render(target: RenderTarget) {
    await getPageTreeFiles(ctx);
    return ctx.renderPage(target);
  }

  async function Root({ lang, children }: { lang?: string; children: ReactNode }) {
    const [slots, props] = await Promise.all([ctx.getSlots({}), ctx.getProviderProps({ lang })]);
    const body = (
      <PressProvider {...props}>{wrapSlot(slots["layout.wrapper"], children)}</PressProvider>
    );
    if (config.ui?.renderRoot)
      return config.ui.renderRoot.call(ctx, { lang, head: styleTag, children: body });

    return (
      <html lang={lang ?? "en"} suppressHydrationWarning>
        <head>{styleTag}</head>
        <body data-version="1.0" className="flex flex-col min-h-screen">
          {body}
        </body>
      </html>
    );
  }

  /** the whole head of a page, one `getHead()` call per page */
  async function Head({ tags }: { tags: Promise<HeadTag[]> }) {
    return renderHeadTags(await tags);
  }

  async function ContentPage({ slugs, lang }: { slugs: string[]; lang?: string }) {
    const page = (await ctx.getLoader()).getPage(slugs, lang);
    if (!page) unstable_notFound();

    return (
      <>
        <Head tags={ctx.getHead({ page })} />
        {await render({ lang, page })}
      </>
    );
  }

  /** `path` as the router passes it, encoded */
  async function viewPage(route: ServedRoute<WakuAppShape>, path: string) {
    const { view, lang } = route;
    const params = matchRoute(route.path, path);
    const out =
      view &&
      params &&
      (await (view.render === "dynamic"
        ? view.view(params, { lang, request: unstable_getRequest() })
        : view.view(params, { lang })));
    if (!out) unstable_notFound();

    return (
      <>
        <Head tags={ctx.getHead({ route, path: decodePathname(path), view: out })} />
        {await render({ lang, view: out, path })}
      </>
    );
  }

  /** the default 404 page: the Home Layout with Fumadocs' not-found content */
  async function notFoundPage(lang: string | undefined) {
    const { DefaultNotFound } = await import("fumadocs-ui/layouts/home/not-found");
    return (
      <>
        <Head tags={ctx.getHead({})} />
        <HomeShell baseOptions={await ctx.getBaseOptions({ lang })}>
          <DefaultNotFound />
        </HomeShell>
      </>
    );
  }

  /**
   * Hono middlewares: the `waku.honoMiddleware` of plugins in layer order, around the `middleware` of plugins, where
   * `next(path)` serves another path of the app.
   *
   * Client navigations request the RSC payload of a page: plugins see the request of the page, and its rewrites and redirects
   * are addressed the way the request addressed its route.
   */
  function createMiddlewares(): ((opts: { app: Hono }) => MiddlewareHandler)[] {
    const out: ((opts: { app: Hono }) => MiddlewareHandler)[] = [];
    for (const plugin of plugins) {
      const hook = plugin.waku?.honoMiddleware;
      if (hook) out.push((opts) => hook.call(ctx, opts));
    }

    out.push(({ app }) => async (c, next) => {
      const { raw } = c.req;
      const { pathname, search } = new URL(raw.url);
      // Waku's router throws on paths outside of its base path, the base path without its trailing slash included
      const path = stripBase(pathname, ctx.withBase("/"));
      if (path === undefined) return c.notFound();
      if (path === "/" && !pathname.endsWith("/")) return c.redirect(`${pathname}/${search}`, 308);

      const route = unstable_parseRouterRequest(raw);
      let request = raw;
      // RSC requests of client navigations address the page in their own URL: middleware checks the page, Waku reads the body of `raw`
      if (route?.type === "route" && pathname.startsWith(ctx.withBase(`/${rscBase}/`))) {
        const url = new URL(raw.url);
        url.pathname = ctx.withBase(route.path);
        url.search = route.query ?? "";
        request = new Request(url, { method: raw.method, headers: raw.headers });
      }
      /** a path of the app, like the request addressed its route */
      const address = (path: string, query?: string): URL =>
        (request !== raw && unstable_formatRouterRequest(raw, path, query)) ||
        new URL(ctx.withBase(path), raw.url);

      let passed: Response | undefined;
      let response = await ctx.handleRequest(request, async (rewrite) => {
        if (rewrite !== undefined) return app.fetch(new Request(address(rewrite), raw));

        await next();
        return (passed = c.res);
      });
      if (response === passed) return;

      const location = response.headers.get("Location");
      if (request !== raw && location && response.status >= 300 && response.status < 400) {
        const target = new URL(location, request.url);
        const path =
          target.origin === new URL(raw.url).origin
            ? stripBase(target.pathname, ctx.withBase("/"))
            : undefined;
        if (path !== undefined) {
          response = new Response(response.body, response);
          response.headers.set("Location", address(path, target.search.slice(1)).href);
        }
      }

      // clear first, assigning over an existing response merges its headers in Hono
      c.res = undefined;
      c.res = response;
    });
    return out;
  }

  /** the adapter with Fumapress' own entry innermost, then the `waku.unstable_serverEntry` of plugins, the first outermost */
  function patchAdapter<Options>(
    adapter: ServerEntryAdapter<Options>,
  ): ServerEntryAdapter<Options> {
    return (handlers, options) => {
      const entry: AdapterServerEntry = adapter(handlers, options);

      const platform = import.meta.env.FUMAPRESS_PLATFORM;
      if (platform === "cloudflare" || platform === "netlify") {
        entry.buildOptions = {
          ...entry.buildOptions,
          FUMAPRESS_BASE_PATH: import.meta.env.WAKU_CONFIG_BASE_PATH,
          FUMAPRESS_PLATFORM: platform,
        };
        entry.buildEnhancers = [
          ...(entry.buildEnhancers ?? []),
          "fumapress/router/deploy.enhancer",
        ];
      }

      const { build, fetch } = entry;
      const llms = plugins.find((plugin) => plugin.provides?.some((name) => name === "llms"));
      entry.fetch = (raw, ...args) => {
        const { pathname } = new URL(raw.url);
        const serve = async (rewrite?: string) => {
          const request =
            rewrite === undefined ? raw : new Request(new URL(ctx.withBase(rewrite), raw.url), raw);
          const response = await fetch(request, ...args);
          // static files of adapters with a server have no Markdown type
          return response.headers.get("Content-Type") === "application/octet-stream" &&
            (rewrite ?? pathname).endsWith(".md")
            ? withHeader(response, "Content-Type", "text/markdown; charset=utf-8")
            : response;
        };
        // adapters with a server serve static files before middleware, so the plugin negotiates here too. `.md` URLs stay
        // with the whole chain: the plugin answers them on demand, before the plugins after it. So do other spellings of
        // a path, which redirect
        return llms?.middleware &&
          raw.method === "GET" &&
          !pathname.endsWith(".md") &&
          canonicalPath(pathname) === pathname
          ? llms.middleware.call(ctx, raw, serve)
          : serve();
      };

      entry.build = async (utils, ...args) => {
        const links: PressBuildOutput["links"] = [];
        // only read by the `build` of plugins, like link validation
        if (plugins.some((plugin) => plugin.build)) global.LINK_SSG_CONTEXT = { links };
        await build(utils, ...args);
        global.LINK_SSG_CONTEXT = undefined;

        await ctx.build({
          links,
          fetch: (request) => entry.fetch(request),
          emitFile: (path, content) =>
            // a copy of bytes, the body of responses can't be a view of shared memory
            utils.emitFile(
              path,
              new Response(typeof content === "string" ? content : content.slice()).body!,
            ),
        });
      };

      let out: WakuServerEntry = entry;
      for (let i = plugins.length - 1; i >= 0; i--) {
        const hook = plugins[i]!.waku?.unstable_serverEntry;
        if (hook) out = hook.call(ctx, out);
      }
      return out as AdapterServerEntry;
    };
  }

  const router: WakuRouter<any> = {
    createPages(fsRoutes) {
      return createPages(async (waku) => {
        /** custom pages and the pages of plugins, core picks the ones served */
        const runtimeRoutes: PageRouteInput<WakuAppShape>[] = [];
        /** the Waku page of a route, once core picked it */
        const wakuPages = new Map<
          object,
          (route: ServedRoute<WakuAppShape>) => { component: FC<WakuRouteProps> }
        >();
        /** with i18n, the page at `/404` of each language: Waku only renders `/404` for unknown URLs */
        const notFoundPages = new Map<string | undefined, FC<WakuRouteProps>>();
        /** your own win over the ones of plugins, Waku refuses two plugins on one */
        const ownLayouts = new Set<string>();
        const ownSlices = new Set<string>();

        function createPage(plugin: PluginInfo | undefined, page: WakuPageOptions) {
          const {
            path,
            lang,
            component,
            staticPaths,
            render = "static",
            exactPath,
            slices,
            unstable_sourceFile,
            ...options
          } = page;
          const Page = component as FC<WakuRouteProps>;
          const input: PageRouteInput<WakuAppShape> = {
            path,
            lang,
            render,
            staticPaths,
            exactPath,
            options,
            plugin,
            markdown: (path, params) =>
              renderRoute(createElement(Page, { ...params, path, lang } as WakuRouteProps)),
          };
          runtimeRoutes.push(input);
          wakuPages.set(input, (route) => ({
            render,
            path: joinPaths(langBase(lang), path),
            staticPaths,
            exactPath,
            slices,
            unstable_sourceFile,
            component: (props: WakuRouteProps) => (
              <>
                <Head tags={ctx.getHead({ route, path: decodePathname(props.path) })} />
                <Page {...props} lang={lang} />
              </>
            ),
          }));
        }

        function createLayout(
          plugin: PluginInfo | undefined,
          { path, lang, component, render = "static", unstable_sourceFile }: WakuLayoutOptions,
        ) {
          const fullPath = joinPaths(langBase(lang), path);
          if (!plugin) ownLayouts.add(fullPath);
          else if (ownLayouts.has(fullPath)) return;
          const Layout = component as FC<{ lang?: string }>;
          waku.createLayout({
            render,
            path: fullPath,
            unstable_sourceFile,
            component: (props: object) => <Layout {...props} lang={lang} />,
          } as never);
        }

        await fsRoutes.call(ctx as never, {
          ...waku,
          createPage: (page) => createPage(undefined, page),
          createLayout: (layout) => createLayout(undefined, layout),
          createSlice(slice) {
            if ("id" in slice) ownSlices.add(slice.id);
            waku.createSlice(slice);
          },
        });

        for (const plugin of plugins) {
          const hook = plugin.waku?.createPages;
          if (!hook) continue;
          await hook.call(ctx, {
            createPage: (page) => createPage(plugin, page),
            createLayout(layout) {
              if (!/^\/\([^/)]+\)/.test(layout.path)) {
                const owner = plugin.name ? `the plugin "${plugin.name}"` : "a plugin";
                throw new Error(
                  `[Fumapress] ${owner} creates a layout at "${layout.path}": plugin layouts go in a route group like "/(name)", the site owns its other pages.`,
                );
              }
              createLayout(plugin, layout);
            },
            createSlice(slice) {
              if (!("id" in slice) || !ownSlices.has(slice.id)) waku.createSlice(slice);
            },
            createInterceptor: waku.createInterceptor,
          });
        }

        ctx.setRuntimeRoutes(runtimeRoutes);
        const [served, apiRoutes] = await Promise.all([ctx.getPageRoutes(), ctx.getApiRoutes()]);
        let hasNotFound = false;
        for (const route of served) {
          const { view, input, lang } = route;
          if (!i18n && route.path === "/404") hasNotFound = true;
          const page = input && wakuPages.get(input)?.(route);
          // with i18n, the pages and views at `/404` are rendered by the 404 page in the language of the URL
          if (page && i18n && route.path === ctx.localizePath(lang, "/404"))
            notFoundPages.set(lang ?? i18n.defaultLanguage, page.component);
          else if (page) waku.createPage(page as never);
          // the view of the default language at `/404` with a hidden locale, the 404 page renders it
          if (!view || (i18n && route.path === "/404")) continue;
          waku.createPage({
            render: route.render,
            path: joinPaths(langBase(route.lang), view.path),
            staticPaths: view.staticPaths,
            component: (props: WakuRouteProps) => viewPage(route, props.path),
          } as never);
        }

        // Waku refuses a static route after a dynamic one on a path
        for (const route of apiRoutes)
          if (route.render === "static") createApiRoute(waku.createApi, route);
        for (const route of apiRoutes)
          if (route.render === "dynamic") createApiRoute(waku.createApi, route);

        const contentRender = ctx.getContentRender();
        const hasDynamicRoute =
          contentRender === "dynamic" ||
          served.some((route) => route.render === "dynamic") ||
          apiRoutes.some((route) => route.render === "dynamic");

        const slugsByLang = new Map<string | undefined, string[][]>();
        for (const page of (await ctx.getLoader()).getPages()) {
          // the catch-all route below renders the pages of dynamic sources
          if (ctx.getContentRender(page.type) === "dynamic") continue;
          const slugs = slugsByLang.get(page.locale);
          if (slugs) slugs.push(page.slugs);
          else slugsByLang.set(page.locale, [page.slugs]);
        }
        const createLangRoot = (path: string, lang: string) =>
          waku.createLayout({
            render: "static",
            path,
            component: ({ children }) => <Root lang={lang}>{children}</Root>,
          });

        waku.createRoot({ render: "static", component: i18n ? Fragment : Root });
        // pages outside of any language (e.g. `autoI18n: false`) still need a root layout
        if (i18n && i18n.hideLocale !== "default-locale")
          createLangRoot(DEFAULT_GROUP, i18n.defaultLanguage);
        for (const lang of ctx.languages) {
          const base = langBase(lang);
          if (lang) createLangRoot(base, lang);
          const path = joinPaths(base, "/[...slugs]") as "/[...slugs]";
          const component = ({ slugs }: { slugs: string[] }) => (
            <ContentPage slugs={slugs} lang={lang} />
          );
          const staticPaths = slugsByLang.get(lang) ?? [];
          if (staticPaths.length > 0 || contentRender === "static")
            waku.createPage({ render: "static", path, staticPaths, component });
          if (contentRender === "static") continue;
          waku.createPage({ render: "dynamic", path, component });
          // a wildcard route of Waku needs a segment after its prefix
          if (
            ctx.localizePath(lang, "/") !== "/" &&
            !served.some((route) => route.path === base) &&
            !staticPaths.some((slugs) => slugs.length === 0)
          )
            waku.createPage({
              render: "dynamic",
              path: base as "/",
              component: () => <ContentPage slugs={[]} lang={lang} />,
            });
        }

        if (!i18n) {
          if (!hasNotFound)
            waku.createPage({
              render: "static",
              staticPaths: [],
              path: "/404",
              component: () => notFoundPage(undefined),
            });
          return null as never;
        }

        // Waku renders `/404` for every unknown URL: in the language of its prefix, rendered on demand on a server; the
        // `404.html` of static sites is the default language
        waku.createPage({
          render: hasDynamicRoute ? "dynamic" : "static",
          path: "/404",
          staticPaths: [],
          component: () => {
            const route = unstable_parseRouterRequest(unstable_getRequest());
            const lang =
              route?.type === "route" ? pathLocale(ctx, route.path) : i18n.defaultLanguage;
            const Page = notFoundPages.get(lang) ?? notFoundPages.get(i18n.defaultLanguage);
            return (
              <Root lang={lang}>
                {Page ? (
                  <Page path={ctx.localizePath(lang, "/404")} lang={lang} />
                ) : (
                  notFoundView(ctx, lang).then((route) =>
                    route ? viewPage(route, route.path) : notFoundPage(lang),
                  )
                )}
              </Root>
            );
          },
        });

        const to = await rootRedirect(ctx);
        if (to !== undefined) {
          if (!hasDynamicRoute) {
            waku.createPage({
              render: "static",
              path: "/",
              component: () => <RedirectDocument to={to} />,
            });
          } else {
            waku.createPage({
              render: "dynamic",
              path: "/",
              // the content can change while the server runs
              component: async () => unstable_redirect(await getHomeUrl(ctx, i18n.defaultLanguage)),
            });
          }
        }

        return null as never;
      });
    },
    createMiddlewares,
    patchAdapter,
    dispose: () => controller.abort(),
  };
  return router;
}

function withHeader(response: Response, name: string, value: string): Response {
  const out = new Response(response.body, response);
  out.headers.set(name, value);
  return out;
}

/** the URL of the site on the development server, without `site.baseUrl` */
function defaultBaseUrl(): string | undefined {
  const platform =
    import.meta.env.FUMAPRESS_PLATFORM === "cloudflare"
      ? " and Cloudflare Workers Builds does not expose the site URL"
      : "";
  console.warn(
    `[Fumapress] "site.baseUrl" is not set${platform}; sitemap and RSS will fall back to relative URLs, self-hosted images stay as they are.`,
  );
  if (import.meta.env.DEV) return joinPaths("http://localhost:3000", import.meta.env.BASE_URL);
}

/** React props of the HTML attributes that React names differently */
const reactProps = new Map([
  ["charset", "charSet"],
  ["crossorigin", "crossOrigin"],
  ["fetchpriority", "fetchPriority"],
  ["hreflang", "hrefLang"],
  ["http-equiv", "httpEquiv"],
  ["itemprop", "itemProp"],
  ["nomodule", "noModule"],
  ["referrerpolicy", "referrerPolicy"],
]);

/** the attributes of a `<link rel="preload">` that React's `preload()` takes */
const preloadAttrs = new Set([
  "rel",
  "href",
  "as",
  "crossorigin",
  "integrity",
  "type",
  "fetchpriority",
  "referrerpolicy",
  "imagesrcset",
  "imagesizes",
  "media",
  "nonce",
]);

/** whether `Preload` can take the link */
function isPreload(attrs: Record<string, string>): boolean {
  const { rel, href, as } = attrs;
  if (!href || (rel !== "modulepreload" && (rel !== "preload" || !as))) return false;
  return Object.keys(attrs).every((name) => preloadAttrs.has(name));
}

/** head tags as React elements, React hoists them into `<head>` */
function renderHeadTags(tags: HeadTag[]): ReactNode[] {
  const out: ReactNode[] = [];
  for (const [index, { tag, attrs, children }] of tags.entries()) {
    if (tag === "link" && attrs && isPreload(attrs)) {
      out.push(createElement(Preload, { key: index, attrs }));
      continue;
    }
    const props: Record<string, unknown> = { key: index };
    for (const name in attrs) props[reactProps.get(name) ?? name] = attrs[name];
    if (tag === "link" && attrs?.rel === "stylesheet") {
      // React hoists stylesheets into `<head>` only with a precedence, and can't update another `<link>` into one
      props.precedence ??= "default";
      props.key = attrs.href;
    }
    if (tag === "title") {
      out.push(createElement(tag, props, children));
      continue;
    }

    // the text of scripts and styles is not escaped
    if (children !== undefined) props.dangerouslySetInnerHTML = { __html: children };
    out.push(createElement(tag, props));
  }
  return out;
}

/** register an API route of plugins as a Waku API, static routes are generated from their `GET` handler */
function createApiRoute(createApi: CreateApi, route: ApiRoute) {
  const { path, staticPaths, GET } = route;
  if (route.render === "static") {
    if (GET)
      createApi({ render: "static", path, method: "GET", staticPaths, handler: toApi(path, GET) });
    return;
  }

  const handlers: Record<string, ReturnType<typeof toApi>> = {};
  for (const method of methods) {
    const handler = route[method];
    if (handler) handlers[method] = toApi(path, handler);
  }
  if (route.ALL) handlers.all = toApi(path, route.ALL);
  createApi({ render: "dynamic", path, handlers });
}

/** Waku handlers return a promise, and get the params encoded like the URL */
function toApi(path: string, handler: RouteHandler) {
  return async (request: Request, { params }: { params: RouteParams }) =>
    handler(request, { params: matchRoute(path, new URL(request.url).pathname) ?? params });
}

/** the site has no root layout at `/`, so the page is a document of its own */
function RedirectDocument({ to }: { to: string }) {
  const href = joinPaths("/", import.meta.env.BASE_URL, to);

  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="robots" content="noindex" />
        <meta httpEquiv="refresh" content={`0; url=${href}`} />
        <link rel="canonical" href={href} />
      </head>
      <body>
        <a href={href}>{href}</a>
      </body>
    </html>
  );
}

/** forward Waku.js router primitives */
export { unstable_notFound as notFound, unstable_redirect as redirect } from "waku/router/server";
