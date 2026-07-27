import type { Awaitable, RouteFns, PressLoaderOptions } from "@/lib/types";
import type { Hono, MiddlewareHandler } from "hono";
import type { ReactNode } from "react";
import type { unstable_createServerEntryAdapter } from "waku/adapter-builders";
import type { AppContext, AppShape } from "./context";
import type { PressProviderProps } from "@/components/provider";
import { fumapressTranslations } from "@/i18n";
import type { FumapressConfig } from "@/config";

export interface PressPlugin<C extends AppShape = AppShape> {
  name?: string;

  /** force change the order of plugin */
  enforce?: "pre" | "post";

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

  /** initialize context */
  init?: (this: AppContext<C>) => Awaitable<void>;

  /** receive & modify context */
  configure?: (this: AppContext<C>) => Awaitable<void>;

  createPages?: (this: AppContext<C>, fns: RouteFns) => Awaitable<void>;

  /**
   * Resolve the given page before passing to the page renderer:
   *
   * - `object`: replace the page object.
   * - `false`: render not found (will also exclude from static pre-rendering).
   * - `undefined`: fallback to default.
   */
  resolvePage?: (this: AppContext<C>, page: C["page"]) => Awaitable<C["page"] | false | undefined>;

  /**
   * Override the page renderer, use default fallback if `undefined` is returned.
   */
  renderPage?: (
    this: AppContext<C>,
    env: { page: C["page"]; fallback: ReactNode; lang?: string; slugs: string[] },
  ) => Awaitable<ReactNode>;

  /** resolve content loader options */
  configureLoader?: (
    this: AppContext<C>,
    options: PressLoaderOptions,
  ) => Awaitable<PressLoaderOptions>;

  /** create Hono middlewares */
  createMiddlewares?: (
    this: AppContext<C>,
    env: { app: Hono },
  ) => Awaitable<MiddlewareHandler[] | undefined>;

  unstable_onServerEntry?: (
    entry: ReturnType<ReturnType<typeof unstable_createServerEntryAdapter>>,
  ) => ReturnType<ReturnType<typeof unstable_createServerEntryAdapter>>;
}

export type PressPluginOption<C extends AppShape = AppShape> =
  | PressPlugin<C>
  | false
  | undefined
  | null
  | PressPluginOption<C>[];

const PLUGIN_ORDER = {
  pre: -1,
  post: 1,
  _: 0,
};

function flattenPlugins<C extends AppShape>(plugins: PressPluginOption<C>[]): PressPlugin<C>[] {
  const out: PressPlugin<C>[] = [];
  for (const plugin of plugins) {
    if (!plugin) continue;
    if (Array.isArray(plugin)) out.push(...flattenPlugins(plugin));
    else out.push(plugin);
  }
  return out;
}

function sortPlugins<C extends AppShape>(plugins: PressPlugin<C>[]): PressPlugin<C>[] {
  return plugins.sort((a, b) => PLUGIN_ORDER[a.enforce ?? "_"] - PLUGIN_ORDER[b.enforce ?? "_"]);
}

export async function preinitPlugins<C extends AppShape>(
  preset: FumapressConfig["preset"] = "recommended",
  plugins: PressPluginOption<C>[],
  _debug_no_takumi = false,
): Promise<PressPlugin<C>[]> {
  const flattened = flattenPlugins(plugins);
  flattened.push(
    {
      name: "core:i18n",
      init() {
        if (this.translationsConfig) {
          this.translationsConfig.extend(fumapressTranslations());
        }
      },
    },
    {
      name: "core:disable-search-if-needed",
      enforce: "post",
      init() {
        const data = (this.data["core:provider"] ??= {});
        const transformers = (data.transformers ??= []);
        transformers.push((props: PressProviderProps) => {
          // search-feature plugins must set the `search` prop, otherwise will disable search by default.
          props.search ??= { enabled: false };
          return props;
        });
      },
    },
  );

  sortPlugins(flattened);
  const finalized: PressPlugin<C>[] = [];
  const finalizedNames = new Set<string>();

  for (const plugin of flattened) {
    if (plugin.preinit && (await plugin.preinit({ finalized, original: flattened })) === false) {
      continue;
    }

    finalized.push(plugin);
    if (plugin.name) finalizedNames.add(plugin.name);
  }

  if (preset === "recommended") {
    if (!finalizedNames.has("core:sitemap")) {
      finalized.push((await import("@/plugins/sitemap")).sitemapPlugin());
    }
    if (!finalizedNames.has("core:robots")) {
      finalized.push((await import("@/plugins/robots")).robotsPlugin());
    }
    if (!finalizedNames.has("core:llms.txt")) {
      finalized.push((await import("@/plugins/llms.txt")).llmsPlugin());
    }
    if (!finalizedNames.has("core:rss")) {
      finalized.push((await import("@/plugins/rss")).rssPlugin());
    }
    if (!finalizedNames.has("core:flexsearch") && !finalizedNames.has("core:orama-search")) {
      finalized.push((await import("@/plugins/flexsearch")).flexsearchPlugin());
    }
    if (!_debug_no_takumi && !finalizedNames.has("core:takumi")) {
      finalized.push((await import("@/plugins/takumi")).takumiPlugin());
    }
  }

  return sortPlugins(finalized);
}
