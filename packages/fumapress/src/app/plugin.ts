import type { FumapressConfig } from "@/config";
import type { Awaitable, RouteFns } from "@/lib/types";
import {
  recommendedPreset,
  resolvePlugins,
  type Plugin,
  type PluginOption,
  type PresetEntry,
} from "@fumapress/core";
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
   *
   * `fallback` is the view of plugins from `getPageView()` in the home layout, or the `renderPage` of the config. Use `getPageView()` for pages in the home layout on every framework.
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
export async function preinit<C extends AppShape>(
  plugins: PressPluginOption<C>[],
): Promise<PressPlugin<C>[]> {
  const original = await resolvePlugins<PressPlugin<C>>(plugins, []);
  const finalized: PressPlugin<C>[] = [];

  for (const plugin of original) {
    if ((await plugin.preinit?.({ finalized, original })) !== false) finalized.push(plugin);
  }
  return finalized;
}

/** the plugins with the ones of `preset` they don't replace, leaving out the ones whose `preinit()` returns `false` */
export async function preinitPlugins<C extends AppShape>(
  preset: FumapressConfig["preset"] = "recommended",
  plugins: PressPluginOption<C>[],
  env: { mode?: BuildMode; _debug_no_takumi?: boolean } = {},
): Promise<PressPlugin<C>[]> {
  const finalized = await preinit(plugins);
  return resolvePlugins<PressPlugin<C>>(
    finalized,
    preset === "recommended" ? recommendedPlugins(finalized, env.mode, env._debug_no_takumi) : [],
  );
}

/** the `recommended` preset, with the image plugin of the hosting platform unless `plugins` have an `image:` plugin */
export function recommendedPlugins<C extends AppShape>(
  plugins: readonly PressPlugin<C>[],
  mode?: BuildMode,
  noTakumi?: boolean,
): PresetEntry<PressPlugin<C>>[] {
  // the plugins of Waku over their core versions
  const own: Record<string, PresetEntry<PressPlugin<C>>["load"]> = {
    "core:llms.txt": async () => (await import("@/plugins/llms.txt")).llmsPlugin<C>(),
    "core:takumi": async () => (await import("@/plugins/takumi")).takumiPlugin<C>(),
  };
  const out: PresetEntry<PressPlugin<C>>[] = [];
  for (const entry of recommendedPreset<C, AppContext<C>>()) {
    if (noTakumi && entry.name === "core:takumi") continue;
    out.push({ ...entry, load: own[entry.name] ?? entry.load });
  }
  if (plugins.some((plugin) => plugin.name?.startsWith("image:"))) return out;

  // hosting platform detected at build time, from the resolved deployment adapter
  const platform: string | undefined = import.meta.env.FUMAPRESS_PLATFORM;
  if (platform === "vercel") {
    out.push({
      name: "image:vercel",
      load: async () => (await import("@/plugins/image/vercel")).imagePlugin<C>(),
    });
  } else if (platform === "cloudflare") {
    out.push({
      name: "image:cloudflare",
      load: async () => (await import("@/plugins/image/cloudflare")).imagePlugin<C>(),
    });
  } else if (platform === "node" && mode !== "static" && hasSharp()) {
    out.push({
      name: "image:self-hosted",
      load: async () => (await import("@/plugins/image/self-hosted")).imagePlugin<C>(),
    });
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
