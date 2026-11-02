import type { Awaitable, RouteFns } from "@/lib/types";
import { resolvePlugins, type Plugin, type PluginOption } from "@fumapress/core";
import type { BuildMode } from "fumadocs-core/framework/plugin";
import type { Hono, MiddlewareHandler } from "hono";
import type { ReactNode } from "react";
import type { unstable_createServerEntryAdapter } from "waku/adapter-builders";
import type { AppContext, AppShape } from "./context";

/** a plugin of Fumapress with the context of Waku as `this`, and the pages, rendering and server of Waku */
export interface PressPlugin<C extends AppShape = AppShape> extends Plugin<C, AppContext<C>> {
  /**
   * Runs after plugins are resolved, before `init()`.
   *
   * - return `false` to remove this plugin from the list.
   * - throw an error to report unresolvable conflicts.
   */
  preinit?: (opts: {
    /** a list of finalized plugins prior to this plugin */
    finalized: readonly PressPlugin<C>[];
    /** full list of initially resolved plugins */
    original: PressPlugin<C>[];
  }) => Awaitable<void | false>;

  createPages?: (this: AppContext<C>, fns: RouteFns) => Awaitable<void>;

  /**
   * Runs after every plugin created its pages, with `fns.getRoutes()` complete: derive routes from them
   * with `fns`, or add head tags to them with `route.meta`.
   */
  configureRoutes?: (this: AppContext<C>, fns: RouteFns) => Awaitable<void>;

  /**
   * Override the page renderer, use default fallback if `undefined` is returned.
   */
  renderPage?: (
    this: AppContext<C>,
    env: { page: C["page"]; fallback: ReactNode; lang?: string; slugs: string[] },
  ) => Awaitable<ReactNode>;

  /** create Hono middlewares */
  createMiddlewares?: (
    this: AppContext<C>,
    env: { app: Hono },
  ) => Awaitable<MiddlewareHandler[] | undefined>;

  unstable_onServerEntry?: (
    entry: ReturnType<ReturnType<typeof unstable_createServerEntryAdapter>>,
  ) => ReturnType<ReturnType<typeof unstable_createServerEntryAdapter>>;
}

export type PressPluginOption<C extends AppShape = AppShape> = PluginOption<PressPlugin<C>>;

/** the plugins without the preset, leaving out the ones whose `preinit()` returns `false` */
export async function preinitPlugins<C extends AppShape>(
  plugins: PressPluginOption<C>[],
): Promise<PressPlugin<C>[]> {
  const original = resolvePlugins<PressPlugin<C>>(plugins, []);
  const finalized: PressPlugin<C>[] = [];

  for (const plugin of original) {
    if ((await plugin.preinit?.({ finalized, original })) !== false) finalized.push(plugin);
  }
  return finalized;
}

/** the plugins of the `recommended` preset, with the image plugin of the hosting platform unless `plugins` have an `image:` plugin */
export async function recommendedPlugins(
  mode: BuildMode,
  plugins: readonly PressPlugin[],
): Promise<PressPluginOption[]> {
  const [sitemap, robots, llms, rss, flexsearch, takumi] = await Promise.all([
    import("@/plugins/sitemap"),
    import("@/plugins/robots"),
    import("@/plugins/llms.txt"),
    import("@/plugins/rss"),
    import("@/plugins/flexsearch"),
    import("@/plugins/takumi"),
  ]);
  const out: PressPluginOption[] = [
    sitemap.sitemapPlugin(),
    robots.robotsPlugin(),
    llms.llmsPlugin(),
    rss.rssPlugin(),
    flexsearch.flexsearchPlugin(),
    takumi.takumiPlugin(),
  ];
  if (plugins.some((plugin) => plugin.name?.startsWith("image:"))) return out;

  // hosting platform detected at build time, from the resolved deployment adapter
  const platform: string | undefined = import.meta.env.FUMAPRESS_PLATFORM;
  if (platform === "vercel") {
    out.push((await import("@/plugins/image/vercel")).imagePlugin());
  } else if (platform === "cloudflare") {
    out.push((await import("@/plugins/image/cloudflare")).imagePlugin());
  } else if (platform === "node" && mode !== "static" && hasSharp()) {
    out.push((await import("@/plugins/image/self-hosted")).imagePlugin());
  }
  return out;
}

function hasSharp(): boolean {
  try {
    import.meta.resolve("sharp");
    return true;
  } catch {
    return false;
  }
}
