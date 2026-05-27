import { createPages as base_createPages } from "waku";
import { AppContext, parseConfig, appContext } from "./lib/shared";
import { FC, Fragment, ReactNode } from "react";
import type { ConfigBuilder, ConfigContext } from "./config";
import { unstable_notFound } from "waku/router/server";
import type { Awaitable, RouteFns } from "./lib/types";
import type { MiddlewareHandler } from "hono";

type Options = Parameters<typeof base_createPages>[1];

export interface Router<C extends ConfigContext = ConfigContext> {
  createPages: (
    fn?: (this: AppContext<C>, fns: RouteFns) => Awaitable<void>,
    options?: Options,
  ) => ReturnType<typeof base_createPages>;
  createMiddlewares: () => (() => MiddlewareHandler)[];
}

export function createRouter<C extends ConfigContext>(userConfig: ConfigBuilder<C>): Router<C> {
  let _ctx: Promise<AppContext<C>> | undefined;

  async function init(): Promise<AppContext<C>> {
    const context = await parseConfig<C>(userConfig);

    for (const plugin of context.plugins) {
      await plugin.init?.call(context);
    }

    return context;
  }

  async function getAppContext() {
    return await (_ctx ??= init());
  }

  function createPages(
    base?: (this: AppContext<C>, fns: RouteFns) => Awaitable<void>,
    createPagesOptions?: Options,
  ) {
    return base_createPages(async (_fns) => {
      const context = await getAppContext();

      if (import.meta.env.PROD) {
        global.appContextTemp = context as unknown as AppContext;
      }

      const layouts = context.layouts;

      const fns: RouteFns = {
        ..._fns,
        createApiIsomorphic(config) {
          if (config.render === "static") {
            _fns.createApi({
              render: "static",
              method: "GET",
              staticPaths: config.staticPaths,
              path: config.path,
              handler: config.handler,
            });
          } else {
            _fns.createApi({
              render: "dynamic",
              path: config.path,
              handlers: {
                GET: config.handler,
              },
            });
          }
        },
      };

      async function resolvePage(slugs: string[], lang?: string) {
        const source = await context.getLoader();
        let page = source.getPage(slugs, lang);
        if (!page) unstable_notFound();

        for (const plugin of context.plugins) {
          const resolved: C["loaderConfig"]["page"] | false | undefined =
            await plugin.resolvePage?.call(context, page);

          if (typeof resolved === "object") page = resolved;
          else if (resolved === false) unstable_notFound();
        }

        return page;
      }

      await base?.call(context, fns);

      for (const plugin of context.plugins) {
        await plugin.createPages?.call(context, fns);
      }

      const staticPaths: string[][] = [];
      const defaultRenderMode = context.mode === "default" ? "static" : context.mode;

      if (defaultRenderMode === "static") {
        outer: for (const page of (await context.getLoader()).getPages()) {
          for (const plugin of context.plugins) {
            const resolved = await plugin.resolvePage?.call(context, page);
            if (resolved === false) continue outer;
          }

          staticPaths.push(page.locale ? [page.locale, ...page.slugs] : page.slugs);
        }
      }

      if (context.i18nConfig) {
        fns.createRoot({
          render: defaultRenderMode,
          component: Fragment,
        });

        fns.createLayout({
          render: defaultRenderMode,
          path: "/[lang]",
          component: layouts.root,
        });

        fns.createPage({
          render: defaultRenderMode,
          path: "/[lang]/[...slugs]",
          staticPaths,
          async component({ slugs, lang }) {
            const page = await resolvePage(slugs, lang);
            let fallback: ReactNode = <layouts.page lang={lang} slugs={slugs} page={page} />;

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
          staticPaths: Object.keys(context.i18nConfig.languages),
          component: layouts.notFound,
        });

        const defaultLanguage = context.i18nConfig.defaultLanguage;
        fns.createPage({
          render: defaultRenderMode,
          path: "/404",
          staticPaths: [],
          component() {
            return <layouts.notFound lang={defaultLanguage} />;
          },
        });
      } else {
        fns.createRoot({
          render: defaultRenderMode,
          component: layouts.root,
        });

        fns.createPage({
          render: defaultRenderMode,
          path: "/[...slugs]",
          staticPaths,
          async component({ slugs }) {
            const page = await resolvePage(slugs);
            let fallback: ReactNode = <layouts.page slugs={slugs} page={page} />;

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
          component: layouts.notFound as FC,
        });
      }

      return null as never;
    }, createPagesOptions);
  }

  function contextMiddleware(): MiddlewareHandler {
    return async (_c, next) => {
      const ctx = await getAppContext();
      return appContext.run(ctx, next);
    };
  }

  function pluginsMiddleware(): MiddlewareHandler {
    async function init(): Promise<MiddlewareHandler[]> {
      const ctx = await getAppContext();
      const out: MiddlewareHandler[] = [];
      const resolved = await Promise.all(
        ctx.plugins.map((plugin) => plugin.createMiddlewares?.call(ctx)),
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

  return {
    createPages,
    createMiddlewares() {
      return [contextMiddleware, pluginsMiddleware];
    },
  };
}
