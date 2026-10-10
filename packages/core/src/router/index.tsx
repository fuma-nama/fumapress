import { createPages as base_createPages } from "waku";
import {
  type AppContext,
  type AppShape,
  initApp,
  appContext,
  PageLinks,
  pageAlternate,
  type PageAlternate,
} from "../app/context";
import { createElement, FC, Fragment, ReactNode } from "react";
import { localizePath } from "@/lib/i18n";
import { decodePathname, joinPaths } from "@/lib/pathname";
import { expandRoute } from "@/lib/routes";
import type { ConfigUtils } from "../config";
import { unstable_notFound, unstable_redirect } from "waku/router/server";
import type { Awaitable, PressRoute, RouteFns, RouteProps } from "../lib/types";
import type { Hono } from "hono/tiny";
import type { MiddlewareHandler } from "hono";
import type { unstable_createServerEntryAdapter } from "waku/adapter-builders";

type Options = Parameters<typeof base_createPages>[1];

/** route group of pages without a language prefix, rendered inside the root layout of the default language */
const DEFAULT_GROUP = "/(default)";

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
  const context = await initApp<C>(userConfig);

  function createPages(
    base?: (this: AppContext<C>, fns: RouteFns) => Awaitable<void>,
    createPagesOptions?: Options,
  ) {
    const result = base_createPages(async (_fns) => {
      const { renderPage } = context;
      const routes: PressRoute[] = [];
      // components rather than calls: `renderNotFound` defaults to a client component
      const Root = context.renderRoot as FC<{ lang?: string; children: ReactNode }>;
      const NotFound = context.renderNotFound as FC<{ lang?: string }>;
      const defaultRenderMode = context.mode === "default" ? "static" : context.mode;
      const i18n = context.i18nConfig;
      /** the route prefix of a language, pages outside any language join the default group */
      const getLangBasePath = (lang?: string): string => {
        const out = localizePath(i18n, lang, "/");
        if (out === "/" && i18n) return DEFAULT_GROUP;
        return out;
      };
      // the pages of the languages by path, then by pathname: they are translations
      const translations = new Map<
        string,
        Map<string, PressRoute["pages"][number]["translations"]>
      >();

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
          let siblingsOf = translations.get(path);
          if (!siblingsOf) translations.set(path, (siblingsOf = new Map()));
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
                return <PageLinks pathname={props.path} alternates={alternates} />;
              },
            ],
            pages: [],
          };

          for (const { pathname, params } of pages) {
            let siblings = siblingsOf.get(pathname);
            if (!siblings) siblingsOf.set(pathname, (siblings = []));
            const page = {
              path: context.localizePath(lang, pathname),
              params,
              translations: siblings,
            };
            if (lang) siblings.push({ locale: lang, path: page.path });
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

        let fallback: ReactNode = renderPage({ lang, slugs, page });
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

      for (const plugin of context.plugins) {
        await plugin.configureRoutes?.call(context, fns);
      }

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

          _fns.createPage({
            render: defaultRenderMode,
            path: `${base}/404` as "/404",
            staticPaths: [],
            component: () => <NotFound lang={lang} />,
          });
        };

        _fns.createRoot({
          render: defaultRenderMode,
          component: Fragment,
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

        if (i18n.hideLocale !== "default-locale") {
          const to = `/${i18n.defaultLanguage}`;

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
              component: () => unstable_redirect(to),
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
      return [pluginsMiddleware];
    },
  };
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
