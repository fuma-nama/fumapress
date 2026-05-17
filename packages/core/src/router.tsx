import * as waku from "waku";
import { AppContext, parseConfig } from "./lib/shared";
import { Fragment } from "react";
import type { Config, ConfigContext, Layouts } from "./config";
import { unstable_notFound, unstable_redirect } from "waku/router/server";
import type { Awaitable, CreatePagesContext, RouteFns } from "./lib/types";

type Options = Parameters<typeof waku.createPages>[1];

export function createRouter<C extends ConfigContext>(
  userConfig: Config<C>,
): {
  createPages: (
    fn?: (this: AppContext<C>, fns: RouteFns) => Awaitable<void>,
    options?: Options,
  ) => ReturnType<typeof waku.createPages>;
} {
  async function init(): Promise<{ context: AppContext<C> } & Layouts<C>> {
    const context = parseConfig<C>(userConfig);

    for (const plugin of context.plugins) {
      await plugin.init?.call(context);
    }

    return {
      context,
      root: context.layouts.root ?? (await import("./layouts/root")).createRootLayout<C>(),
      page: context.layouts.page ?? (await import("./layouts/docs")).createDocsLayoutPage<C>(),
      notFound:
        context.layouts.notFound ??
        (await import("fumadocs-ui/layouts/home/not-found")).DefaultNotFound,
    };
  }

  const createPages = (
    base?: (this: AppContext<C>, fns: RouteFns) => Awaitable<void>,
    createPagesOptions?: Options,
  ) => {
    return waku.createPages(async (_fns) => {
      const { context, ...layouts } = await init();

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

      await base?.call(context, fns);
      const resolved = new Set<C["loaderConfig"]["page"]>();
      const createPagesCtx: CreatePagesContext<C> = {
        ...context,
        markResolved(page) {
          resolved.add(page);
        },
      };
      for (const plugin of context.plugins) {
        await plugin.createPages?.call(createPagesCtx, fns);
      }

      const source = await context.getLoader();
      const staticPaths: string[][] = [];

      for (const page of source.getPages()) {
        if (resolved.has(page)) continue;
        staticPaths.push(page.locale ? [page.locale, ...page.slugs] : page.slugs);
      }

      const defaultRenderMode = context.mode === "dynamic" ? "dynamic" : "static";

      if (context.i18nConfig) {
        fns.createRoot({
          render: defaultRenderMode,
          component: Fragment,
        });

        fns.createLayout({
          render: defaultRenderMode,
          path: "/[lang]",
          component({ children, lang }) {
            return (
              <layouts.root lang={lang} ctx={context}>
                {children}
              </layouts.root>
            );
          },
        });

        fns.createPage({
          render: defaultRenderMode,
          path: "/[lang]/[...slugs]",
          staticPaths,
          async component({ slugs, lang }) {
            const source = await context.getLoader();
            const page = source.getPage(slugs, lang);
            if (!page || resolved.has(page)) unstable_notFound();

            return <layouts.page lang={lang} slugs={slugs} page={page} ctx={context} />;
          },
        });

        fns.createPage({
          render: defaultRenderMode,
          path: "/[lang]/404",
          staticPaths: Object.keys(context.i18nConfig.languages),
          component({ lang }) {
            return <layouts.notFound lang={lang} ctx={context} />;
          },
        });

        if (context.mode !== "static") {
          // must be dynamic because of redirects
          fns.createPage({
            render: "dynamic",
            path: "/404",
            component() {
              unstable_redirect(`/${context.i18nConfig!.defaultLanguage}`);
            },
          });
        }
      } else {
        fns.createRoot({
          render: defaultRenderMode,
          component({ children }) {
            return <layouts.root ctx={context}>{children}</layouts.root>;
          },
        });

        fns.createPage({
          render: defaultRenderMode,
          path: "/[...slugs]",
          staticPaths,
          async component({ slugs }) {
            const source = await context.getLoader();
            const page = source.getPage(slugs);
            if (!page || resolved.has(page)) unstable_notFound();

            return <layouts.page slugs={slugs} page={page} ctx={context} />;
          },
        });

        fns.createPage({
          render: defaultRenderMode,
          staticPaths: [],
          path: "/404",
          component() {
            return <layouts.notFound ctx={context} />;
          },
        });
      }

      return null as never;
    }, createPagesOptions);
  };

  return {
    createPages,
  };
}
