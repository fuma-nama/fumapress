import * as waku from "waku";
import { AppContext, parseConfig } from "./lib/shared";
import { Fragment } from "react";
import type { Config, ConfigContext, Layouts } from "./config";
import { unstable_redirect } from "waku/router/server";
import { CreatePagesContext, RouteFns } from "./lib/types";

export function createRouter<C extends ConfigContext>(
  userConfig: Config<C>,
): {
  extend: typeof waku.createPages;
  createPages: () => ReturnType<typeof waku.createPages>;
} {
  async function init(): Promise<{ context: AppContext<C> } & Layouts<C>> {
    const context = parseConfig<C>(userConfig);

    for (const plugin of context.plugins) {
      plugin.init?.call(context);
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

  const createPages: typeof waku.createPages = (base, createPagesOptions) => {
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

      await base(fns);
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
      const pendingPages = source.getPages().filter((page) => !resolved.has(page));
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
          staticPaths: pendingPages.map((page) => [page.locale!, ...page.slugs]),
          component({ slugs, lang }) {
            return <layouts.page lang={lang} slugs={slugs} ctx={context} />;
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
          staticPaths: pendingPages.map((page) => page.slugs),
          component({ slugs }) {
            return <layouts.page slugs={slugs} ctx={context} />;
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
    extend: createPages,
    createPages() {
      return createPages(() => null as never);
    },
  };
}
