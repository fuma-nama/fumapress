import * as core from "@fumapress/core";
import type {
  AppShape,
  Awaitable,
  ContentOptions,
  Context,
  InferAppShape,
  LangEnv,
  Plugin,
  PluginTypes,
  PresetEntry,
  Press,
  PressContent,
  PressContext,
} from "@fumapress/core";
import type { _Internal } from "fumadocs-core/source";
import type { MiddlewareHandler } from "hono";
import type { Hono } from "hono/tiny";
import type { ReactNode } from "react";
import type { unstable_createServerEntryAdapter } from "waku/adapter-builders";
import type { WakuRouteFns } from "./router";

/** the types of a Waku site; a plugin for Waku sites requires it (`WakuPlugin`) */
export type WakuAppShape = AppShape & { runtime: "waku" };

/** the Waku-only options of `.config()` */
export interface WakuPressConfig<C extends AppShape> {
  /** @deprecated `head`, keyed on both runtimes; renders after the keyed tags */
  meta?: {
    root?: (this: Context<C>) => ReactNode;
    page?: (this: Context<C>, page: C["page"]) => ReactNode;
  };
  ui?: {
    /** the document: `head` is the styles, `children` the page in the root provider; returns `<html>`, `<head>` and `<body>` */
    renderRoot?: (
      this: Context<C>,
      props: LangEnv<C> & { head: ReactNode; children: ReactNode },
    ) => ReactNode;
  };
}

/** the site of `press.config` on Waku: `createPress(content).plugins(...).config({...})` */
export function createPress<
  I extends _Internal.AnyInput,
  Lang extends string | undefined = undefined,
  C extends WakuAppShape = InferAppShape<I, Lang, "waku">,
>(content: I, options?: ContentOptions<I, Lang>): PressContent<C, WakuPressConfig<C>> {
  return core.createPress(content, options);
}

/**
 * A plugin using Waku's own APIs (`waku`): a core plugin for Waku sites, so Astro sites refuse it by its `C`. Write it as a
 * factory typed by the site: `myPlugin<C extends WakuAppShape>(): WakuPlugin<C>`.
 */
export type WakuPlugin<C extends WakuAppShape = WakuAppShape, T extends PluginTypes = {}> = Plugin<
  C,
  T
>;

declare module "@fumapress/core" {
  interface RuntimeHooks<in C extends AppShape> {
    waku?: WakuHooks<C>;
  }

  interface CapabilityAPI {
    /** the optimizer behind `fumapress/image`; one per site, the preset picks the platform's */
    image: undefined;
  }
}

/** Waku's APIs for plugins; the four principles decide them as any hook (collect or chain, in layer order) */
export interface WakuHooks<C extends AppShape> {
  /**
   * collect: Waku pages, layouts, slices and handler interceptors of the plugin, with Fumapress' `lang` on pages and
   * layouts. Called once, it covers every language itself, like `routes`. Layouts only in route groups
   * (`/(name)`): the site owns its pages, a plugin layout never wraps them. Not the root (`ui.renderRoot` is the site's), and
   * no `createApi` (API routes are `createApi` of core `routes()`, on both runtimes). A path taken twice by pages or by layouts, or a
   * slice id taken twice, is an error naming both; your own page or layout wins.
   */
  createPages?: (
    this: Context<C>,
    fns: Omit<WakuRouteFns<Press<C>>, "createRoot" | "createApi">,
  ) => Awaitable<void>;
  /**
   * chain: a Hono middleware of the server (Waku's `middlewareFns`), for the Hono context (`c.env`, `c.executionCtx`);
   * anything else is core `middleware`, on both runtimes. They nest in layer order, around the site's `middleware` chain.
   * Static files the adapter serves (Node's `serveStatic`, the platform's assets) never reach it.
   */
  honoMiddleware?: (this: Context<C>, env: { app: Hono }) => MiddlewareHandler;
  /**
   * chain: the adapter's build output, a build enhancer with its `buildOptions`; returns a new entry, or `entry` unchanged.
   * The first plugin is the outermost wrapper; Fumapress' own entry is the innermost. Requests are `middleware`: Cloudflare
   * serves `defaultExport`, which calls the adapter's own `fetch`, so a wrapped `fetch` misses them. Waku marks the entry
   * type unstable.
   */
  unstable_serverEntry?: (this: Context<C>, entry: WakuServerEntry) => WakuServerEntry;
}

export type ServerEntryAdapter<Options> = ReturnType<
  typeof unstable_createServerEntryAdapter<Options>
>;
export type AdapterServerEntry = ReturnType<ServerEntryAdapter<unknown>>;
type ReadonlyValue<V> = unknown extends V ? V : V extends Function ? V : Readonly<V>;
/** the server entry of Waku's adapters (Waku exports no name for it), read-only: a wrapper returns its own lists */
export type WakuServerEntry = {
  readonly [K in keyof AdapterServerEntry]: ReadonlyValue<AdapterServerEntry[K]>;
};

/** the context of the site the server runs, set by its router */
let current: Context | undefined;

export function setPressContext(ctx: Context) {
  current = ctx;
}

/** the context of the site, for your own pages and routes: `getPressContext<typeof app>()` */
export function getPressContext<A extends Press<any, any> = Press>(): PressContext<A> {
  if (!current)
    throw new Error("[Fumapress] `getPressContext()` is read before the router is created.");
  return current as PressContext<A>;
}

/** the core preset, plus the image optimizer of the platform (Vercel, Cloudflare, else self-hosted with `sharp`) */
export function recommendedPreset<C extends WakuAppShape = WakuAppShape>(): PresetEntry<
  Plugin<C, any>,
  ReturnType<typeof core.recommendedPreset>[number]["provides"] | "image"
>[] {
  const out: ReturnType<typeof recommendedPreset<C>> = core.recommendedPreset<C>();
  // the platform of the deployment adapter, baked in at build time
  const platform: string | undefined = import.meta.env.FUMAPRESS_PLATFORM;
  let load: (() => Promise<Plugin<C, any>>) | undefined;
  if (platform === "vercel")
    load = async () => (await import("./plugins/image/vercel")).vercelImage<C>();
  else if (platform === "cloudflare")
    load = async () => (await import("./plugins/image/cloudflare")).cloudflareImage<C>();
  else if (platform === "node" && hasSharp())
    load = async () => (await import("./plugins/image/self-hosted")).selfHostedImage<C>();

  if (load) out.push({ provides: "image", load });
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
