import { createPages as base_createPages } from "waku";
import { type AppContext, type AppShape, initApp, appContext } from "../app/context";
import { FC, Fragment, ReactNode } from "react";
import { DEFAULT_GROUP, hiddenLocale, localeRoutes } from "@/lib/i18n";
import { resolveBaseUrl } from "@/lib/pathname";
import type { ConfigUtils } from "../config";
import { unstable_notFound, unstable_redirect } from "waku/router/server";
import type { Awaitable, RouteFns } from "../lib/types";
import type { Hono } from "hono/tiny";
import type { MiddlewareHandler } from "hono";
import type { unstable_createServerEntryAdapter } from "waku/adapter-builders";

type Options = Parameters<typeof base_createPages>[1];

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
      // components rather than calls: `renderNotFound` defaults to a client component
      const Root = context.renderRoot as FC<{ lang?: string; children: ReactNode }>;
      const NotFound = context.renderNotFound as FC<{ lang?: string }>;
      let fns: RouteFns = {
        ..._fns,
        unstable_getCreated() {
          return result;
        },
        createApiIsomorphic(config) {
          if (config.render === "static") {
            _fns.createApi({
              render: "static",
              method: "GET",
              staticPaths: config.staticPaths,
              path: config.path,
              handler: config.handler,
              unstable_sourceFile: config.unstable_sourceFile,
            });
          } else {
            _fns.createApi({
              render: "dynamic",
              path: config.path,
              handlers: {
                GET: config.handler,
              },
              unstable_sourceFile: config.unstable_sourceFile,
            });
          }
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

      for (const plugin of context.plugins) {
        const out = await plugin.prepareCreatePages?.call(context, fns);
        if (out) fns = out;
      }

      fns.createInterceptor((next) => appContext.run(context, next));

      await base?.call(context, fns);

      for (const plugin of context.plugins) {
        await plugin.createPages?.call(context, fns);
      }

      const defaultRenderMode = context.mode === "default" ? "static" : context.mode;
      const pages = (await context.getLoader()).getPages();
      const i18n = context.i18nConfig;

      if (i18n) {
        const hidden = hiddenLocale(i18n);
        const slugsByLang = new Map<string, string[][]>();
        for (const page of pages) {
          const slugs = slugsByLang.get(page.locale!);
          if (slugs) slugs.push(page.slugs);
          else slugsByLang.set(page.locale!, [page.slugs]);
        }

        const createLocaleRoot = (base: string, lang: string) => {
          fns.createLayout({
            render: defaultRenderMode,
            path: base,
            component: ({ children }) => <Root lang={lang}>{children}</Root>,
          });

          fns.createPage({
            render: defaultRenderMode,
            path: `${base}/404` as "/404",
            staticPaths: [],
            component: () => <NotFound lang={lang} />,
          });
        };

        fns.createRoot({
          render: defaultRenderMode,
          component: Fragment,
        });

        // pages outside of any language (e.g. `autoI18n: false`) still need a root layout
        if (!hidden) createLocaleRoot(DEFAULT_GROUP, i18n.defaultLanguage);

        for (const { base, lang } of localeRoutes(i18n)) {
          createLocaleRoot(base, lang);
          fns.createPage({
            render: defaultRenderMode,
            path: `${base}/[...slugs]` as "/[...slugs]",
            staticPaths: slugsByLang.get(lang) ?? [],
            component: ({ slugs }) => renderContent(slugs, lang),
          });
        }

        if (!hidden) {
          const to = `/${i18n.defaultLanguage}`;

          if (context.mode === "static") {
            fns.createPage({
              render: "static",
              path: "/",
              component: () => <RedirectDocument to={to} />,
            });
          } else {
            fns.createPage({
              render: "dynamic",
              path: "/",
              component: () => unstable_redirect(to),
            });
          }
        }
      } else {
        const staticPaths: string[][] = [];
        for (const page of pages) staticPaths.push(page.slugs);

        fns.createRoot({
          render: defaultRenderMode,
          component: Root,
        });

        fns.createPage({
          render: defaultRenderMode,
          path: "/[...slugs]",
          staticPaths,
          component: ({ slugs }) => renderContent(slugs),
        });

        fns.createPage({
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
  const href = resolveBaseUrl(import.meta.env.BASE_URL, to);

  return (
    <html>
      <head>
        <meta charSet="utf-8" />
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
