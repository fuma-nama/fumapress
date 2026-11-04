import { createPages } from "waku";
import { createElement, Fragment, type FC, type ReactNode } from "react";
import { uiTranslations } from "fumadocs-ui/i18n";
import {
  getHomeUrl,
  stripBase,
  type ApiRoute,
  type AppShape,
  type Awaitable,
  type Context,
  type HeadTag,
  type PageRoute,
  type Plugin,
  type PluginInfo,
  type Press,
  type PressBuildOutput,
  type RouteHandler,
  type RouteOptions,
} from "@fumapress/core";
import {
  createLocalizer,
  createPressContext,
  expandRoute,
  matchRoute,
  methods,
  notFoundView,
  pathLocale,
  renderPage,
  rootRedirect,
  wrapSlot,
  type PressInput,
  type RenderTarget,
  type RoutedView,
  type RuntimeRoute,
} from "@fumapress/core/runtime";
import { HomeShell, mergeI18n, renderDefault, siteI18n } from "@fumapress/core/runtime/ui";
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
import stylesInline from "virtual:root.css?inline";
import stylesHref from "virtual:root.css?url";
import { decodePathname, joinPaths } from "@/lib/pathname";
import { PressProvider, type PressProviderProps } from "@/components/provider";
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

type LangOf<A extends Press<any, any>> = NonNullable<A["~types"]>["content"]["lang"];

/** props of your own pages and layouts: `WakuRouteProps<typeof app, "/showcase/[slug]">` types the params of the path */
export type WakuRouteProps<A extends Press<any, any> = Press, Path extends string = string> = {
  /** the rendered path, without the base path */
  path: string;
  lang: LangOf<A>;
} & (string extends Path
  ? { [param: string]: string | string[] | undefined }
  : ApiContext<Path>["params"]);

/** your own routes and the ones of `waku.createPages`, `WakuPageOptions<typeof app>` types `lang` */
export interface WakuPageOptions<A extends Press<any, any> = Press> extends Omit<
  WakuRouteConfig,
  "autoI18n"
> {
  /** pathname without language prefix */
  path: string;
  /** the language of the page, its copies in other languages share the `path` */
  lang?: LangOf<A>;
  component: FC<never>;
  /** match `path` literally, for paths with brackets */
  exactPath?: boolean;
  /** Waku's `slices`: the ids of the slices the page renders */
  slices?: string[];
  /** source file of the route, files only used by static routes are pruned from the server bundle */
  unstable_sourceFile?: string;
}

/** your own layouts and the ones of `waku.createPages` */
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

export interface WakuRouterOptions {
  /** the content renderers, the last layer: `mdxPlugin({ components })` of `fumadocs-mdx/press` with the MDX components module */
  renderers?: Plugin<WakuAppShape>[];
}

/** the Waku site of `press.config`, for the server entry */
export interface WakuRouter {
  /** Waku's pages: `fsRoutes` are your own, then the plugins', the views, the API routes and the content */
  createPages(
    fsRoutes: (this: Context, fns: WakuRouteFns) => Awaitable<void>,
  ): ReturnType<typeof createPages>;
  createMiddlewares(): ((opts: { app: Hono }) => MiddlewareHandler)[];
  patchAdapter<Options>(adapter: ServerEntryAdapter<Options>): ServerEntryAdapter<Options>;
  /** aborts `this.signal` of plugins */
  dispose(): void;
}

/** the Waku site of `press.config`: its pages, middleware and server entry */
export async function createRouter(
  press: Press<WakuAppShape, any>,
  { renderers = [] }: WakuRouterOptions = {},
): Promise<WakuRouter> {
  const input = press["~press"] as PressInput<WakuPressConfig<AppShape>>;
  const { config } = input;
  const controller = new AbortController();
  const site = { ...config.site, baseUrl: config.site?.baseUrl ?? defaultBaseUrl() };
  const ctx = await createPressContext<WakuAppShape>(
    { ...press, "~press": { ...input, config: { ...config, site } } },
    {
      base: import.meta.env.BASE_URL,
      preset: recommendedPreset,
      defaults: [...renderers, { name: "waku:ui-translations", translations: uiTranslations() }],
      signal: controller.signal,
      isClientReference: (value) =>
        (typeof value === "function" || (typeof value === "object" && value !== null)) &&
        "$$typeof" in value &&
        value.$$typeof === clientReference,
    },
  );
  setPressContext(ctx);
  const { plugins } = ctx;
  const defaultRender = ctx.mode === "default" ? "static" : ctx.mode;
  const i18n = ctx.i18nConfig;
  const localize = createLocalizer(ctx);

  /** the route prefix of a language, pages outside any language join the default group */
  function langBase(lang?: string): string {
    const out = ctx.localizePath(lang, "/");
    return out === "/" && i18n ? DEFAULT_GROUP : out;
  }

  function render(target: RenderTarget) {
    return renderPage(ctx, press, target, renderDefault);
  }

  async function Root({ lang, children }: { lang?: string; children: ReactNode }) {
    const [slots, base] = await Promise.all([ctx.getSlots({}), ctx.getProviderProps({ lang })]);
    const props: PressProviderProps = {
      ...base,
      i18n: mergeI18n(siteI18n(ctx, { lang }), base.i18n),
      children: wrapSlot(slots["layout.wrapper"], children),
    };
    if (i18n?.hideLocale === "default-locale") props.hiddenLocale ??= i18n.defaultLanguage;

    const head = (
      <>
        {styleTag}
        {config.meta?.root?.call(ctx)}
      </>
    );
    const body = <PressProvider {...props} />;
    if (config.ui?.renderRoot)
      return config.ui.renderRoot.call(ctx, { lang, head, children: body });

    return (
      <html lang={lang ?? "en"} suppressHydrationWarning>
        <head>{head}</head>
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
        {config.meta?.page?.call(ctx, page)}
        {await render({ lang, page })}
      </>
    );
  }

  /** `path` as the router passes it, encoded */
  async function viewPage({ route, view }: RoutedView<WakuAppShape>, path: string) {
    const params = matchRoute(route.path, path);
    const out =
      params &&
      (await (view.render === "dynamic"
        ? view.view(params, { lang: route.lang, request: unstable_getRequest() })
        : view.view(params, { lang: route.lang })));
    if (!out) unstable_notFound();

    return (
      <>
        <Head tags={ctx.getHead({ route, path: decodePathname(path), view: out })} />
        {await render({ lang: route.lang, view: out })}
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
      const route = unstable_parseRouterRequest(raw);
      let request = raw;
      // RSC requests of client navigations, the query is undefined when the router's params are in the body
      if (
        route?.type === "route" &&
        route.query !== undefined &&
        new URL(raw.url).pathname.startsWith(ctx.withBase(`/${rscBase}/`))
      ) {
        const url = new URL(ctx.withBase(route.path), raw.url);
        url.search = route.query;
        request = new Request(url, raw);
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
      const entry: AdapterServerEntry = adapter(handlers, {
        static: ctx.mode === "static",
        ...options,
      } as Options);

      const platform = import.meta.env.FUMAPRESS_PLATFORM;
      if (platform === "cloudflare" || platform === "netlify") {
        entry.buildOptions = {
          ...entry.buildOptions,
          FUMAPRESS_BASE_PATH: import.meta.env.WAKU_CONFIG_BASE_PATH,
        };
        entry.buildEnhancers = [
          ...(entry.buildEnhancers ?? []),
          "fumapress/router/deploy.enhancer",
        ];
      }

      const { build } = entry;
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
      /** `buildOptions` keys by the layer that set them */
      const setters = new Map<string, string>();
      for (const key in entry.buildOptions) setters.set(key, "Fumapress");
      for (let i = plugins.length - 1; i >= 0; i--) {
        const plugin = plugins[i]!;
        const hook = plugin.waku?.unstable_serverEntry;
        if (!hook) continue;
        const next = hook.call(ctx, out);
        const name = plugin.name ? `the plugin "${plugin.name}"` : "a plugin";
        for (const key in next.buildOptions) {
          const setter = setters.get(key);
          if (setter && setter !== name && next.buildOptions[key] !== out.buildOptions?.[key])
            throw new Error(
              `[Fumapress] ${name} overwrites the build option "${key}" of ${setter}: an inner layer's value has one writer.`,
            );
          setters.set(key, setter ?? name);
        }
        out = next;
      }
      return out as AdapterServerEntry;
    };
  }

  const router: WakuRouter = {
    createPages(fsRoutes) {
      return createPages(async (waku) => {
        /** your own pages and the pages of plugins, core picks the ones served */
        const runtimeRoutes: RuntimeRoute<WakuAppShape>[] = [];
        /** registers the Waku page of a route, once core picked it */
        const registers = new Map<PageRoute<WakuAppShape>, () => void>();
        /** layout paths and slice ids, by their owner */
        const owners = new Map<string, string>();
        const own = "your own pages";

        /** a layout or slice has one owner: your own wins over a plugin's, two plugins are an error naming both */
        function claim(key: string, owner: string): boolean {
          const other = owners.get(key);
          if (other === undefined || other === owner) {
            owners.set(key, owner);
            return true;
          }
          if (other === own) return false;
          throw new Error(
            `[Fumapress] ${other} and ${owner} both create the ${key}: a layout path or slice id has one owner.`,
          );
        }

        function createPage(plugin: PluginInfo | undefined, page: WakuPageOptions) {
          const {
            path,
            lang,
            component,
            staticPaths,
            render = defaultRender,
            exactPath,
            slices,
            unstable_sourceFile,
            ...options
          } = page;
          const { pattern, pages } = expandRoute(path, staticPaths, exactPath);
          const Page = component as FC<WakuRouteProps>;
          const routePages: PageRoute["pages"][number][] = [];
          for (const { pathname, params } of pages)
            routePages.push({ ...localize(lang, withoutGroups(pathname)), params });
          const route: PageRoute<WakuAppShape> = {
            path: ctx.localizePath(lang, withoutGroups(pattern)),
            lang,
            render,
            pages: routePages,
            options,
            markdown: (path, params) =>
              renderRoute(createElement(Page, { ...params, path, lang } as WakuRouteProps)),
          };
          runtimeRoutes.push({ route, plugin });
          registers.set(route, () =>
            waku.createPage({
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
            } as never),
          );
        }

        function createLayout(
          owner: string,
          { path, lang, component, render = defaultRender, unstable_sourceFile }: WakuLayoutOptions,
        ) {
          const fullPath = joinPaths(langBase(lang), path);
          if (!claim(`layout ${fullPath}`, owner)) return;
          const Layout = component as FC<{ lang?: string }>;
          waku.createLayout({
            render,
            path: fullPath,
            unstable_sourceFile,
            component: (props: object) => <Layout {...props} lang={lang} />,
          } as never);
        }

        await fsRoutes.call(ctx, {
          ...waku,
          createPage: (page) => createPage(undefined, page),
          createLayout: (layout) => createLayout(own, layout),
          createSlice(slice) {
            if ("id" in slice) claim(`slice ${slice.id}`, own);
            waku.createSlice(slice);
          },
        });

        for (const plugin of plugins) {
          const hook = plugin.waku?.createPages;
          if (!hook) continue;
          const owner = plugin.name ? `the plugin "${plugin.name}"` : "a plugin";
          await hook.call(ctx, {
            createPage: (page) => createPage(plugin, page),
            createLayout(layout) {
              if (!/^\/\([^/)]+\)/.test(layout.path))
                throw new Error(
                  `[Fumapress] ${owner} creates a layout at "${layout.path}": plugin layouts go in a route group like "/(name)", the site owns its other pages.`,
                );
              createLayout(owner, layout);
            },
            createSlice(slice) {
              if (!("id" in slice) || claim(`slice ${slice.id}`, owner)) waku.createSlice(slice);
            },
            createInterceptor: waku.createInterceptor,
          });
        }

        ctx.setRuntimeRoutes(runtimeRoutes);
        const [served, views, apiRoutes] = await Promise.all([
          ctx.getRoutes(),
          ctx.getViewRoutes(),
          ctx.getApiRoutes(),
        ]);
        let hasNotFound = false;
        for (const route of served) {
          registers.get(route)?.();
          // with i18n, the views at `/404` are rendered by the 404 page in the language of the URL
          if (route.path === "/404" && (!i18n || registers.has(route))) hasNotFound = true;
        }

        for (const routed of views) {
          const { route, view } = routed;
          // the view of the default language at `/404` with a hidden locale, the 404 page renders it
          if (i18n && route.path === "/404") continue;
          waku.createPage({
            render: route.render,
            path: joinPaths(langBase(route.lang), view.path),
            staticPaths: view.staticPaths,
            component: (props: WakuRouteProps) => viewPage(routed, props.path),
          } as never);
        }

        for (const route of apiRoutes) createApiRoute(waku.createApi, route);

        const pages = (await ctx.getLoader()).getPages();
        if (i18n) {
          const slugsByLang = new Map<string, string[][]>();
          for (const page of pages) {
            const slugs = slugsByLang.get(page.locale!);
            if (slugs) slugs.push(page.slugs);
            else slugsByLang.set(page.locale!, [page.slugs]);
          }
          const createLangRoot = (path: string, lang: string) =>
            waku.createLayout({
              render: defaultRender,
              path,
              component: ({ children }) => <Root lang={lang}>{children}</Root>,
            });

          waku.createRoot({ render: defaultRender, component: Fragment });
          // pages outside of any language (e.g. `autoI18n: false`) still need a root layout
          if (i18n.hideLocale !== "default-locale")
            createLangRoot(DEFAULT_GROUP, i18n.defaultLanguage);
          for (const lang of i18n.languages) {
            const base = langBase(lang);
            createLangRoot(base, lang);
            waku.createPage({
              render: defaultRender,
              path: `${base}/[...slugs]` as "/[...slugs]",
              staticPaths: slugsByLang.get(lang) ?? [],
              component: ({ slugs }) => <ContentPage slugs={slugs} lang={lang} />,
            });
          }

          // Waku renders `/404` for every unknown URL: in the language of its prefix, rendered on request outside static
          // mode; the `404.html` of static sites is the default language
          if (!hasNotFound) {
            waku.createPage({
              render: ctx.mode === "static" ? "static" : "dynamic",
              path: "/404",
              staticPaths: [],
              component: () => {
                const route = unstable_parseRouterRequest(unstable_getRequest());
                const lang =
                  route?.type === "route" ? pathLocale(ctx, route.path) : i18n.defaultLanguage;
                return (
                  <Root lang={lang}>
                    {notFoundView(ctx, lang).then((view) =>
                      view ? viewPage(view, view.route.path) : notFoundPage(lang),
                    )}
                  </Root>
                );
              },
            });
          }

          const to = await rootRedirect(ctx);
          if (to !== undefined) {
            if (ctx.mode === "static") {
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
                component: async () =>
                  unstable_redirect(await getHomeUrl(ctx, i18n.defaultLanguage)),
              });
            }
          }
        } else {
          const staticPaths: string[][] = [];
          for (const page of pages) staticPaths.push(page.slugs);

          waku.createRoot({ render: defaultRender, component: Root });
          waku.createPage({
            render: defaultRender,
            path: "/[...slugs]",
            staticPaths,
            component: ({ slugs }) => <ContentPage slugs={slugs} />,
          });
          if (!hasNotFound)
            waku.createPage({
              render: defaultRender,
              staticPaths: [],
              path: "/404",
              component: () => notFoundPage(undefined),
            });
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

/** the URL of the site on the development server, without `site.baseUrl` */
function defaultBaseUrl(): string | undefined {
  const platform =
    import.meta.env.FUMAPRESS_PLATFORM === "cloudflare"
      ? " and Cloudflare Workers Builds does not expose the site URL"
      : "";
  console.warn(
    `[Fumapress] "site.baseUrl" is not set${platform}; sitemap and RSS will fall back to relative URLs.`,
  );
  if (import.meta.env.DEV) return joinPaths("http://localhost:3000", import.meta.env.BASE_URL);
}

/** a Waku page path without its route groups, like `/(acme)/showcase` → `/showcase` */
function withoutGroups(path: string): string {
  return path.replace(/\/\([^/)]+\)/g, "") || "/";
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

/** head tags as React elements, React hoists them into `<head>` */
function renderHeadTags(tags: HeadTag[]): ReactNode[] {
  const out: ReactNode[] = [];
  for (const [key, { tag, attrs, children }] of tags.entries()) {
    const props: Record<string, unknown> = { key };
    for (const name in attrs) props[reactProps.get(name) ?? name] = attrs[name];
    // React hoists stylesheets into `<head>` only with a precedence
    if (tag === "link" && attrs?.rel === "stylesheet") props.precedence ??= "default";
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
    if (GET) createApi({ render: "static", path, method: "GET", staticPaths, handler: toApi(GET) });
    return;
  }

  const handlers: Record<string, ReturnType<typeof toApi>> = {};
  for (const method of methods) {
    const handler = route[method];
    if (handler) handlers[method] = toApi(handler);
  }
  if (route.ALL) handlers.all = toApi(route.ALL);
  createApi({ render: "dynamic", path, handlers });
}

/** Waku handlers return a promise */
function toApi(handler: RouteHandler) {
  return async (...args: Parameters<RouteHandler>) => handler(...args);
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
