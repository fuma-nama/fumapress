import { createElement, type ComponentType, type ReactNode } from "react";
import type * as Framework from "fumadocs-core/framework/plugin";
import type { Meta, Page } from "fumadocs-core/source";
import type { Context, InferLoaderConfig } from "./context";
import type { SearchPluginAPI } from "./search";

export type Awaitable<T> = T | Promise<T>;

/** the types of a site, inferred from its config */
export interface AppShape {
  page: Page;
  meta: Meta;
  lang: string | undefined;
  /** source names in multi-source setup */
  source: string | undefined;
}

/** the API of the plugin providing a capability, from `this.getProvider(capability)?.api`, extend it for your capabilities */
export interface CapabilityAPI {
  search: SearchPluginAPI;
  "og-image": unknown;
}

/** features only one plugin can provide, the preset fills the ones no plugin provides */
export type Capability = keyof CapabilityAPI | (string & {});

/** the plugin providing the capability `K`, its `api` is the API of the capability */
export type Provider<K extends Capability> = Plugin & {
  api?: K extends keyof CapabilityAPI ? CapabilityAPI[K] : unknown;
};

/** content of a plugin in the home layout of the site */
export interface View extends Framework.PageBody {
  /** the title of the page */
  title?: string;
  description?: string;
}

/** a page of a plugin outside the content, it renders a view in the home layout of the site */
export interface ViewRoute extends Pick<Framework.ApiRoute, "path" | "render" | "staticPaths"> {
  /** the language of the page: the site prefixes `path` with it, and links the pages of other languages at the same `path` as its translations */
  lang?: string;
  /** the content of the page at the params of `path`, `undefined` for the 404 page */
  view: (params: Framework.RouteParams) => Awaitable<View | undefined>;
}

/**
 * A plugin of Fumapress: a plugin of the framework API with the site's {@link Context} as `this`, capabilities, an API for other plugins, views and slots.
 *
 * Plugins of the framework API, like the ones of integrations, fit every site. Create plugins with generic functions, like `myPlugin<C extends AppShape = AppShape, Ctx extends Context<C> = Context<C>>(options: MyOptions<NoInfer<C>, NoInfer<Ctx>>): Plugin<C, Ctx>`, to type the pages and the `this` of callbacks in their options by the site.
 *
 * Frameworks extending the context give it to the hooks as `Ctx`.
 */
export interface Plugin<
  in C extends AppShape = AppShape,
  in Ctx extends Context<C> = Context<C>,
> extends Framework.Plugin<InferLoaderConfig<C>, Ctx, DocsPageData> {
  /** only one plugin can provide each capability */
  provides?: readonly Capability[];

  /** an API for other plugins, from `this.getPlugin(name)?.api`, the one of {@link CapabilityAPI} for the capabilities it provides */
  api?: unknown;

  /** API routes, and pages rendering a view in the home layout of the site */
  routes?(this: Ctx): Awaitable<(Framework.ApiRoute | ViewRoute)[] | undefined>;

  /** a content page in the home layout of the site instead of the docs layout, like a blog post, with the head of the page */
  getPageView?(this: Ctx, page: C["page"]): Awaitable<Framework.PageBody | undefined>;

  /** runs once after the site is built, not on dev or production servers; throw to fail the build */
  build?(this: Ctx, output: PressBuildOutput): Awaitable<void>;

  /** UI in the slots of pages, collected from every plugin: with the content page as `page`, without it for `layout.wrapper` */
  slots?(this: Ctx, env: { page?: C["page"] }): Awaitable<SlotItem[] | undefined>;
}

/** the build output of a site, with the links of its prerendered pages */
export interface PressBuildOutput extends Framework.BuildOutput {
  links: { href: string; fromPathname: string }[];
  /** request a page of the built site */
  fetch: (request: Request) => Awaitable<Response>;
}

/** a plugin `P` of the `plugins` option, lists are flattened and falsy values left out */
export type PluginOption<P extends Plugin<any, any> = Plugin> =
  | P
  | false
  | undefined
  | null
  | PluginOption<P>[];

/** a plugin of a preset, loaded only when no plugin replaces it by its `name` or a capability it `provides` */
export interface PresetEntry<P extends Plugin<any, any> = Plugin> extends Pick<Plugin, "provides"> {
  name: string;
  load: () => Awaitable<P>;
}

/** the `recommended` preset: sitemap, robots.txt, llms.txt, RSS, search and Open Graph images */
export function recommendedPreset<
  C extends AppShape = AppShape,
  Ctx extends Context<C> = Context<C>,
>(): PresetEntry<Plugin<C, Ctx>>[] {
  return [
    {
      name: "core:sitemap",
      load: async () => (await import("./plugins/sitemap")).sitemapPlugin<C, Ctx>(),
    },
    {
      name: "core:robots",
      load: async () => (await import("./plugins/robots")).robotsPlugin<C>(),
    },
    {
      name: "core:llms.txt",
      load: async () => (await import("./plugins/llms.txt")).llmsPlugin<C, Ctx>(),
    },
    {
      name: "core:rss",
      load: async () => (await import("./plugins/rss")).rssPlugin<C, Ctx>(),
    },
    {
      name: "core:flexsearch",
      provides: ["search"],
      load: async () => (await import("./plugins/flexsearch")).flexsearchPlugin<C, Ctx>(),
    },
    {
      name: "core:takumi",
      provides: ["og-image"],
      load: async () => (await import("./plugins/takumi")).takumiPlugin<C, Ctx>(),
    },
  ];
}

const enforceOrder: Record<NonNullable<Plugin["enforce"]>, number> = { pre: -1, post: 1 };

function flatten<P extends Plugin<any, any>>(plugins: PluginOption<P>[], out: P[] = []): P[] {
  for (const plugin of plugins) {
    if (Array.isArray(plugin)) flatten(plugin, out);
    else if (plugin) out.push(plugin);
  }
  return out;
}

/** `plugins` with the entries of `preset` they don't replace, sorted by `enforce` */
export async function resolvePlugins<P extends Plugin<any, any> = Plugin>(
  plugins: PluginOption<NoInfer<P>>[],
  preset: PresetEntry<NoInfer<P>>[],
): Promise<P[]> {
  const out = flatten(plugins);
  const names = new Set<string>();
  const capabilities = new Set<Capability>();
  for (const plugin of out) {
    if (plugin.name) names.add(plugin.name);
    for (const capability of plugin.provides ?? []) capabilities.add(capability);
  }

  const loading: Awaitable<P>[] = [];
  for (const entry of preset) {
    if (names.has(entry.name)) continue;
    if (entry.provides?.some((capability) => capabilities.has(capability))) continue;
    loading.push(entry.load());
  }
  out.push(...(await Promise.all(loading)));

  const providers = new Map<Capability, P>();
  for (const plugin of out) {
    for (const capability of plugin.provides ?? []) {
      const other = providers.get(capability);
      if (other)
        throw new Error(
          `[Fumapress] "${plugin.name ?? "unnamed"}" conflicts with "${other.name ?? "unnamed"}": only one ${capability} plugin can be added.`,
        );
      providers.set(capability, plugin);
    }
  }

  return out.sort(
    (a, b) => (a.enforce ? enforceOrder[a.enforce] : 0) - (b.enforce ? enforceOrder[b.enforce] : 0),
  );
}

/** the data of a docs page, transformed by plugins */
export interface DocsPageData extends Framework.DocsPageData {
  /** the URL of its Markdown, for LLMs */
  markdownUrl?: string;
  /** the URL to view its source file */
  githubUrl?: string;
}

/**
 * Places for UI, every layout renders them:
 *
 * - `page.actions`: beside the page actions of a content page, like copying the Markdown.
 * - `page.footer`: after the content of a content page.
 * - `body.wrapper`: around the content of a content page, the component receives it as `children`.
 * - `layout.wrapper`: around the layout of every page, inside the root provider, like `body.wrapper`.
 */
export type SlotName = "page.actions" | "page.footer" | "body.wrapper" | "layout.wrapper";

export interface SlotItem {
  slot: SlotName;
  component: ComponentType<any>;
  /** serializable on Astro, where client components hydrate as islands */
  props?: Record<string, unknown>;
  /** lower comes first, defaults to `0` */
  order?: number;
}

/** the items of a slot, in order */
export function renderSlot(items: SlotItem[] = []): ReactNode {
  return items.map(({ component, props }, key) => createElement(component, { key, ...props }));
}

/** `children` inside the items of a wrapper slot, the first item outermost */
export function wrapSlot(items: SlotItem[] = [], children: ReactNode): ReactNode {
  return items.reduceRight<ReactNode>(
    (out, { component, props }) => createElement(component, props, out),
    children,
  );
}
