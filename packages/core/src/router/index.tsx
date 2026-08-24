import { createPages as base_createPages } from "waku";
import { type AppContext, type AppShape, initApp, appContext } from "../app/context";
import { FC, Fragment, ReactNode } from "react";
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
      const { renderRoot, renderPage, renderNotFound } = context;
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

      async function resolvePage(slugs: string[], lang?: string) {
        const source = await context.getLoader();
        const page = source.getPage(slugs, lang);
        if (!page) unstable_notFound();

        return page;
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

      const staticPaths: string[][] = [];
      const defaultRenderMode = context.mode === "default" ? "static" : context.mode;

      for (const page of (await context.getLoader()).getPages()) {
        staticPaths.push(page.locale ? [page.locale, ...page.slugs] : page.slugs);
      }

      if (context.i18nConfig) {
        fns.createRoot({
          render: defaultRenderMode,
          component: Fragment,
        });

        fns.createLayout({
          render: defaultRenderMode,
          path: "/[lang]",
          component: renderRoot as FC,
        });

        fns.createPage({
          render: defaultRenderMode,
          path: "/[lang]/[...slugs]",
          staticPaths,
          async component({ slugs, lang }) {
            const page = await resolvePage(slugs, lang);
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

            return fallback;
          },
        });

        fns.createPage({
          render: defaultRenderMode,
          path: "/[lang]/404",
          staticPaths: context.i18nConfig.languages,
          component: renderNotFound as FC,
        });

        if (context.mode !== "static") {
          fns.createPage({
            render: "dynamic",
            path: "/404",
            component: () => unstable_redirect(`/${context.i18nConfig!.defaultLanguage}`),
          });
        }
      } else {
        fns.createRoot({
          render: defaultRenderMode,
          component: renderRoot as FC,
        });

        fns.createPage({
          render: defaultRenderMode,
          path: "/[...slugs]",
          staticPaths,
          async component({ slugs }) {
            const page = await resolvePage(slugs);
            let fallback: ReactNode = renderPage({ slugs, page });

            for (const plugin of context.plugins) {
              const res: ReactNode = await plugin.renderPage?.call(context, {
                fallback,
                page,
                slugs,
              });
              if (res !== undefined) fallback = res;
            }

            return fallback;
          },
        });

        fns.createPage({
          render: defaultRenderMode,
          staticPaths: [],
          path: "/404",
          component: renderNotFound as FC,
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
      let entry = adapter(handlers, options);

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

/** forward Waku.js router primitives */
export { unstable_notFound as notFound, unstable_redirect as redirect } from "waku/router/server";
