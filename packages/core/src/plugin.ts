import type { ComponentType } from "react";
import type * as Framework from "fumadocs-core/framework/plugin";
import type { Meta, Page } from "fumadocs-core/source";
import type { Context, InferLoaderConfig } from "./context";

export type Awaitable<T> = T | Promise<T>;

/** the types of a site, inferred from its config */
export interface AppShape {
  page: Page;
  meta: Meta;
  lang: string | undefined;
  /** source names in multi-source setup */
  source: string | undefined;
}

/** features only one plugin can provide, the preset fills the ones no plugin provides */
export type Capability = "search" | "og-image" | (string & {});

/**
 * A plugin of Fumapress: a plugin of the framework API with the site's {@link Context} as `this`, capabilities, an API for other plugins and slots.
 *
 * Plugins of the framework API, like the ones of integrations, fit every site. Create plugins with generic functions, like `myPlugin<C extends AppShape = AppShape>(): Plugin<C>`, to type the pages in their options by the site.
 *
 * Frameworks extending the context give it to the hooks as `Ctx`.
 */
export interface Plugin<
  in C extends AppShape = AppShape,
  in Ctx extends Context<C> = Context<C>,
> extends Framework.Plugin<InferLoaderConfig<C>, Ctx, DocsPageData> {
  /** only one plugin can provide each capability */
  provides?: readonly Capability[];

  /** an API for other plugins, from `this.getPlugin(name)?.api` */
  api?: unknown;

  /** UI in the slots of a content page, collected from every plugin */
  slots?(this: Ctx, env: { page: C["page"] }): Awaitable<SlotItem[] | undefined>;
}

/** a plugin `P` of the `plugins` option, lists are flattened and falsy values left out */
export type PluginOption<P extends Plugin<any, any> = Plugin> =
  | P
  | false
  | undefined
  | null
  | PluginOption<P>[];

const enforceOrder: Record<NonNullable<Plugin["enforce"]>, number> = { pre: -1, post: 1 };

function flatten<P extends Plugin<any, any>>(plugins: PluginOption<P>[], out: P[] = []): P[] {
  for (const plugin of plugins) {
    if (Array.isArray(plugin)) flatten(plugin, out);
    else if (plugin) out.push(plugin);
  }
  return out;
}

/** `plugins` with the ones of `preset` they don't replace by name or capability, sorted by `enforce` */
export function resolvePlugins<P extends Plugin<any, any> = Plugin>(
  plugins: PluginOption<NoInfer<P>>[],
  preset: PluginOption<NoInfer<P>>[],
): P[] {
  const out = flatten(plugins);
  const names = new Set<string>();
  const capabilities = new Set<Capability>();
  for (const plugin of out) {
    if (plugin.name) names.add(plugin.name);
    for (const capability of plugin.provides ?? []) capabilities.add(capability);
  }

  for (const plugin of flatten(preset)) {
    if (plugin.name && names.has(plugin.name)) continue;
    if (plugin.provides?.some((capability) => capabilities.has(capability))) continue;
    out.push(plugin);
  }

  const providers = new Map<Capability, P>();
  for (const plugin of out) {
    for (const capability of plugin.provides ?? []) {
      const other = providers.get(capability);
      if (other)
        throw new Error(
          `[Fumapress] "${other.name ?? "unnamed"}" and "${plugin.name ?? "unnamed"}" both provide "${capability}", only one plugin can provide it.`,
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
  /** the URL of its OG image */
  image?: string;
  /** the URL to view its source file */
  githubUrl?: string;
}

/**
 * Places for UI on a content page, every layout renders them:
 *
 * - `page.actions`: beside the page actions, like copying the Markdown.
 * - `page.footer`: after the content.
 * - `body.wrapper`: around the content, the component receives it as `children`.
 */
export type SlotName = "page.actions" | "page.footer" | "body.wrapper";

export interface SlotItem {
  slot: SlotName;
  component: ComponentType<any>;
  /** serializable on Astro, where client components hydrate as islands */
  props?: Record<string, unknown>;
  /** lower comes first, defaults to `0` */
  order?: number;
}
