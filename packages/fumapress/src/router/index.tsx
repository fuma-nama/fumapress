import { createPages as base_createPages } from "waku";
import {
  type AppContext,
  type AppShape,
  initApp,
  appContext,
  renderHeadTags,
} from "../app/context";
import { createElement, FC, Fragment, ReactNode } from "react";
import { decodePathname, joinPaths } from "@/lib/pathname";
import {
  createLocalizer,
  expandRoute,
  getHomeUrl,
  matchRoute,
  pageAlternate,
  pageLinks,
  rootRedirect,
  stripBase,
  type FrameworkPage,
  type PageAlternate,
  type PressBuildOutput,
} from "@fumapress/core";
import type { ConfigUtils } from "../config";
import { createHomeLayout } from "@/layouts/home";
import {
  unstable_formatRouterRequest,
  unstable_getRequest,
  unstable_notFound,
  unstable_parseRouterRequest,
  unstable_redirect,
} from "waku/router/server";
import type { Awaitable, PressRoute, RouteFns, RouteProps } from "../lib/types";
import type { Hono } from "hono/tiny";
import type { MiddlewareHandler } from "hono";
import type { unstable_createServerEntryAdapter } from "waku/adapter-builders";
import { methods, type ApiRoute, type RouteHandler } from "fumadocs-core/framework/plugin";

type Options = Parameters<typeof base_createPages>[1];

/** route group of pages without a language prefix, rendered inside the root layout of the default language */
const DEFAULT_GROUP = "/(default)";
const rscBase: string = import.meta.env.WAKU_CONFIG_RSC_BASE ?? "RSC";

/** the layout of views, the content of plugins outside the docs layout */
const ViewLayout = createHomeLayout();

export interface Router<C extends AppShape = AppShape> {
  createPages: (
    fn?: (this: AppContext<C>, fns: RouteFns) => Awaitable<void>,
    options?: Options,
  ) => ReturnType<typeof base_createPages>;
  createMiddlewares: () => ((opts: { app: Hono }) => MiddlewareHandler)[];
  patchAdapter: <Options>(
    adapter: ReturnType<typeof unstable_createServerEntryAdapter<Options>>,
  ) => ReturnType<typeof unstable_createServerEntryAdapter<Options>>;
}

export async function createRouter<U extends ConfigUtils>(
  userConfig: U,
): Promise<Router<U["$context"]>> {
  type C = U["$context"];
  let routes: PressRoute[] = [];
  const context = await initApp<C>(userConfig, () => {
    const out: FrameworkPage[] = [];
    for (const route of routes) out.push(...route.pages);
    return out;
  });

  function createPages(
    base?: (this: AppContext<C>, fns: RouteFns) => Awaitable<void>,
    createPagesOptions?: Options,
  ) {
    const result = base_createPages(async (_fns) => {
      const { renderPage } = context;
      routes = [];
      // components rather than calls: `renderNotFound` defaults to a client component
      const Root = context.renderRoot as FC<{ lang?: string; children: ReactNode }>;
      const NotFound = context.renderNotFound as FC<{ lang?: string }>;
      const defaultRenderMode = context.mode === "default" ? "static" : context.mode;
      const i18n = context.i18nConfig;
      /** the route prefix of a language, pages outside any language join the default group */
      const getLangBasePath = (lang?: string): string => {
        const out = context.localizePath(lang, "/");
        if (out === "/" && i18n) return DEFAULT_GROUP;
        return out;
      };
      const localize = createLocalizer(context);

      const fns: RouteFns = {
        ..._fns,
        getRoutes: () => routes,
        createApiIsomorphic(config) {
          const { render = defaultRenderMode, path, handler, unstable_sourceFile } = config;
          if (render === "static") {
            _fns.createApi({ ...config, render, method: "GET" });
          } else {
            _fns.createApi({ render, path, handlers: { GET: handler }, unstable_sourceFile });
          }
        },
        createLayout({ path, lang, component, render = defaultRenderMode, ...rest }) {
          const Layout = component as FC<{ lang?: string }>;

          _fns.createLayout({
            ...rest,
            render,
            path: joinPaths(getLangBasePath(lang), path),
            component: lang ? (props: object) => <Layout {...props} lang={lang} /> : Layout,
          } as never);
        },
        createPage({
          path,
          lang,
          component,
          staticPaths,
          render = defaultRenderMode,
          exactPath,
          unstable_sourceFile,
          ...options
        }) {
          const Page = component as FC<{ lang?: string }>;
          const { pattern, pages } = expandRoute(path, staticPaths, exactPath);
          const byPath = new Map<string, PressRoute["pages"][number]>();
          const route: PressRoute = {
            ...options,
            render,
            path: context.localizePath(lang, pattern),
            lang,
            staticPaths,
            exactPath,
            unstable_sourceFile,
            component,
            meta: [
              (props) => {
                const page = byPath.get(decodePathname(props.path));
                const alternates: PageAlternate[] = [];
                if (page && page.translations.length > 1) {
                  for (const { locale, path } of page.translations) {
                    alternates.push(pageAlternate(context, locale, path));
                  }
                }
                return renderHeadTags(pageLinks(context, props.path, alternates));
              },
            ],
            pages: [],
          };

          for (const { pathname, params } of pages) {
            const page = { ...localize(lang, pathname), params };
            byPath.set(page.path, page);
            route.pages.push(page);
          }

          routes.push(route);
          _fns.createPage({
            render,
            path: joinPaths(getLangBasePath(lang), path),
            staticPaths,
            exactPath,
            unstable_sourceFile,
            component: (props: RouteProps) =>
              createElement(
                Fragment,
                null,
                ...route.meta.map((meta) => meta(props)),
                <Page {...props} lang={lang} />,
              ),
          } as never);
        },
      };

      async function renderContent(slugs: string[], lang?: string) {
        const source = await context.getLoader();
        const page = source.getPage(slugs, lang);
        if (!page) unstable_notFound();

        // the view of a plugin replaces the layout of docs pages, `renderPage` of plugins wraps either
        const view = await context.getPageView(page);
        let fallback: ReactNode = view ? (
          <ViewLayout lang={lang}>{view.node}</ViewLayout>
        ) : (
          renderPage({ lang, slugs, page })
        );
        for (const plugin of context.plugins) {
          const res: ReactNode = await plugin.renderPage?.call(context, {
            fallback,
            page,
            slugs,
            lang,
          });
          if (res !== undefined) fallback = res;
        }

        return (
          <>
            {context.renderPageMeta(page)}
            {fallback}
          </>
        );
      }

      fns.createInterceptor((next) => appContext.run(context, next));

      await base?.call(context, fns);

      for (const plugin of context.plugins) {
        await plugin.createPages?.call(context, fns);
      }

      for (const { path, lang, render, staticPaths, view } of await context.getViewRoutes()) {
        const pattern = context.localizePath(lang, expandRoute(path, undefined).pattern);
        fns.createPage({
          path,
          lang,
          render,
          staticPaths,
          component: async (props: RouteProps) => {
            const params = matchRoute(pattern, props.path);
            const content = params && (await view(params));
            if (!content) unstable_notFound();

            return (
              <>
                {content.title && <title>{content.title}</title>}
                {content.description && <meta name="description" content={content.description} />}
                <ViewLayout lang={lang}>{content.node}</ViewLayout>
              </>
            );
          },
        });
      }

      for (const plugin of context.plugins) {
        await plugin.configureRoutes?.call(context, fns);
      }

      for (const route of await context.getApiRoutes()) createApiRoute(_fns.createApi, route);

      const pages = (await context.getLoader()).getPages();

      if (i18n) {
        const slugsByLang = new Map<string, string[][]>();
        for (const page of pages) {
          const slugs = slugsByLang.get(page.locale!);
          if (slugs) slugs.push(page.slugs);
          else slugsByLang.set(page.locale!, [page.slugs]);
        }

        const createLocaleRoot = (base: string, lang: string) => {
          _fns.createLayout({
            render: defaultRenderMode,
            path: base,
            component: ({ children }) => <Root lang={lang}>{children}</Root>,
          });
        };

        _fns.createRoot({
          render: defaultRenderMode,
          component: Fragment,
        });

        // Waku renders `/404` for every unknown URL, in the language of its prefix: rendered on
        // request outside static mode, the `404.html` of static sites is the default language
        _fns.createPage({
          render: context.mode === "static" ? "static" : "dynamic",
          path: "/404",
          staticPaths: [],
          component: () => {
            // the route of the request, RSC requests included
            const route = unstable_parseRouterRequest(unstable_getRequest());
            const prefix = route?.type === "route" ? route.path.split("/")[1] : undefined;
            const lang = i18n.languages.find((lang) => lang === prefix) ?? i18n.defaultLanguage;

            return (
              <Root lang={lang}>
                <NotFound lang={lang} />
              </Root>
            );
          },
        });

        // pages outside of any language (e.g. `autoI18n: false`) still need a root layout
        if (i18n.hideLocale !== "default-locale") {
          createLocaleRoot(DEFAULT_GROUP, i18n.defaultLanguage);
        }

        for (const lang of i18n.languages) {
          const base = getLangBasePath(lang);
          createLocaleRoot(base, lang);
          _fns.createPage({
            render: defaultRenderMode,
            path: `${base}/[...slugs]` as "/[...slugs]",
            staticPaths: slugsByLang.get(lang) ?? [],
            component: ({ slugs }) => renderContent(slugs, lang),
          });
        }

        const to = await rootRedirect(context);
        if (to !== undefined) {
          if (context.mode === "static") {
            _fns.createPage({
              render: "static",
              path: "/",
              component: () => <RedirectDocument to={to} />,
            });
          } else {
            _fns.createPage({
              render: "dynamic",
              path: "/",
              // the content can change while the server runs
              component: async () =>
                unstable_redirect(await getHomeUrl(context, i18n.defaultLanguage)),
            });
          }
        }
      } else {
        const staticPaths: string[][] = [];
        for (const page of pages) staticPaths.push(page.slugs);

        _fns.createRoot({
          render: defaultRenderMode,
          component: Root,
        });

        _fns.createPage({
          render: defaultRenderMode,
          path: "/[...slugs]",
          staticPaths,
          component: ({ slugs }) => renderContent(slugs),
        });

        _fns.createPage({
          render: defaultRenderMode,
          staticPaths: [],
          path: "/404",
          component: () => <NotFound />,
        });
      }

      return null as never;
    }, createPagesOptions);
    return result;
  }

  function pluginsMiddleware(opts: { app: Hono }): MiddlewareHandler {
    async function init(): Promise<MiddlewareHandler[]> {
      const out: MiddlewareHandler[] = [];
      const resolved = await Promise.all(
        context.plugins.map((plugin) => plugin.createMiddlewares?.call(context, opts)),
      );

      for (const v of resolved) {
        if (v) out.push(...v);
      }

      return out;
    }

    const middlewaresPromise = init();

    return async (c, next) => {
      const middlewares = await middlewaresPromise;
      if (middlewares.length === 0) return next();

      let response: Response | undefined;

      const run = async (index: number) => {
        const handler = middlewares[index];
        if (handler) {
          const result = await handler(c, () => run(index + 1));
          if (result && !response) {
            response = result;
          }
        } else {
          await next();
        }
      };

      await run(0);
      return response;
    };
  }

  /**
   * The `middleware` of plugins, `next(path)` serves another path of the app.
   *
   * Client navigations request the RSC payload of a page: plugins see the request of the page, and its rewrites and redirects are addressed the way the request addressed its route.
   */
  function pressMiddleware({ app }: { app: Hono }): MiddlewareHandler {
    return async (c, next) => {
      const { raw } = c.req;
      const route = unstable_parseRouterRequest(raw);
      let request = raw;
      // RSC requests of client navigations, the query is undefined when the router's params are in the body
      if (
        route?.type === "route" &&
        route.query !== undefined &&
        new URL(raw.url).pathname.startsWith(context.withBase(`/${rscBase}/`))
      ) {
        const url = new URL(context.withBase(route.path), raw.url);
        url.search = route.query;
        request = new Request(url, raw);
      }
      /** a path of the app, like the request addressed its route */
      const address = (path: string, query?: string): URL =>
        (request !== raw && unstable_formatRouterRequest(raw, path, query)) ||
        new URL(context.withBase(path), raw.url);

      let passed: Response | undefined;
      let response = await context.handleRequest(request, async (rewrite) => {
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
            ? stripBase(target.pathname, context.withBase("/"))
            : undefined;
        if (path !== undefined) {
          response = new Response(response.body, response);
          response.headers.set("Location", address(path, target.search.slice(1)).href);
        }
      }

      // clear first, assigning over an existing response merges its headers in Hono
      c.res = undefined;
      c.res = response;
    };
  }

  function patchAdapter<Options>(
    adapter: ReturnType<typeof unstable_createServerEntryAdapter<Options>>,
  ): ReturnType<typeof unstable_createServerEntryAdapter<Options>> {
    return (handlers, options) => {
      let entry = adapter(handlers, { static: context.mode === "static", ...options } as Options);

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
        if (context.plugins.some((plugin) => plugin.build)) global.LINK_SSG_CONTEXT = { links };
        await build(utils, ...args);
        global.LINK_SSG_CONTEXT = undefined;

        await context.build({
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

      for (const plugin of context.plugins) {
        if (plugin.unstable_onServerEntry) entry = plugin.unstable_onServerEntry(entry);
      }

      return entry;
    };
  }

  return {
    createPages,
    patchAdapter,
    createMiddlewares() {
      return [pluginsMiddleware, pressMiddleware];
    },
  };
}

/** register an API route of plugins as a Waku API, static routes are generated from their `GET` handler */
function createApiRoute(createApi: RouteFns["createApi"], route: ApiRoute) {
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
