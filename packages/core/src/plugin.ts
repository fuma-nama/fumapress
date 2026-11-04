import { createElement, type ComponentType, type ReactNode } from "react";
import type * as Framework from "fumadocs-core/framework/plugin";
import type { DocsLayoutProps } from "fumadocs-ui/layouts/docs";
import type { Meta, Page } from "fumadocs-core/source";
import type { Context, InferLoaderConfig } from "./context";
import type { BaseOptions, ProviderProps } from "./press";

export type Awaitable<T> = T | Promise<T>;

/** the types of a site, inferred from its content */
export interface AppShape {
  page: Page;
  meta: Meta;
  lang: string | undefined;
  /** source names in multi-source setup */
  source: string | undefined;
  /** the runtime running the site; a plugin of one runtime's entry requires it: `C extends AppShape & { runtime: "waku" }` */
  runtime: string;
}

/** the env of per-language options and hooks */
export interface LangEnv<C extends AppShape> {
  lang: C["lang"];
}

/** the env of per-page hooks; `layout.wrapper` and site-wide tags without `page` */
export interface PageEnv<C extends AppShape> {
  page?: C["page"];
}

/** `head` runs twice per page: site-wide (`{}`), then the page's own call (`{ page }`, or `{ route, path }` on page routes, with `view` on views) */
export interface HeadEnv<C extends AppShape> extends PageEnv<C> {
  route?: PageRoute<C>;
  /** the rendered path of `route`, with the language prefix, without the base path */
  path?: string;
  /** the content of a view at `path`, its `title` and `description` are the page's own */
  view?: View<any>;
}

/** the named slots: the slot id is the `renderPage` prop holding their items by name */
export type NamedSlot = "actions" | "footer";

/** what a plugin declares for types: its views, the props it adds to pages of a source, its capabilities and named slot items */
export type PluginTypes = { views?: object; pages?: object; provides?: Capability } & {
  [K in NamedSlot]?: string;
};

/** the declarations `K` of plugin types: on a union, their union; on `any`, `any`; on the merged types of a site, its own */
export type Declared<T, K extends keyof PluginTypes> = T extends unknown
  ? K extends keyof T
    ? Exclude<T[K], undefined>
    : never
  : never;

type Intersect<U> = [U] extends [never]
  ? {}
  : (U extends unknown ? (u: U) => void : never) extends (u: infer I extends object) => void
    ? I
    : {};
type TypesOf<P> = P extends { readonly "~types"?: infer X } ? (P extends object ? X : {}) : {};

/** the plugin types of a site, `U` is the union of each plugin's; an interface, so it is cached and printed by name */
export interface MergedTypes<U> extends NamedSlotNames<U> {
  views: Intersect<Declared<U, "views">>;
  pages: Intersect<Declared<U, "pages">>;
}
type NamedSlotNames<U> = { [K in NamedSlot]: Declared<U, K> };

/** keys outside the plugin contract, like a removed or misspelled hook: `const P` skips the excess property check of literals */
export type UnknownKeys<E, C extends AppShape> = E extends readonly unknown[]
  ? never
  : E extends object
    ?
        | Exclude<keyof E, keyof Plugin | keyof Framework.Plugin>
        | OtherRuntimeKeys<E, Exclude<keyof RuntimeHooks<AppShape> & keyof E, C["runtime"]>>
        | RuntimeUnknownKeys<E, keyof RuntimeHooks<AppShape> & keyof E>
    : never;
/** the same check inside a runtime's member (`"waku.preinit"`) */
type RuntimeUnknownKeys<E, K extends keyof E> = K extends keyof RuntimeHooks<AppShape>
  ? `${K & string}.${Exclude<keyof NonNullable<E[K]>, keyof NonNullable<RuntimeHooks<AppShape>[K]>> & string}`
  : never;
/** another runtime's member (`waku` on Astro) that a plugin literal writes; a typed plugin is refused by its `C` instead */
type OtherRuntimeKeys<E, K extends keyof E> = K extends unknown
  ? {} extends Pick<E, K>
    ? never
    : K
  : never;
/** no recursion over the list: `FlatArray` flattens nested lists by depth */
export type CollectTypes<P extends readonly unknown[]> =
  TypesOf<FlatArray<P, 20>> extends infer U ? MergedTypes<U> : never;

/**
 * the members of runtimes' own APIs, each named by its runtime (`C["runtime"]`): `fumapress` declares `waku` by declaration
 * merging. Another runtime's site refuses them: by `C` for a typed plugin, as an unknown key for a literal.
 */
export interface RuntimeHooks<in C extends AppShape> {}

/**
 * A plugin of Fumapress: a plugin of the framework API with the site's {@link Context} as `this`, capabilities, views, slots, head tags, middleware and the build.
 *
 * Hooks are properties, so `this` and pages are checked contravariantly: a plugin for any site fits every site. A plugin is a
 * generic factory typed by the site (`myPlugin<C extends AppShape>(options: MyOptions<NoInfer<C>>): Plugin<C, MyTypes>`).
 */
export interface Plugin<in C extends AppShape = AppShape, T extends PluginTypes = {}>
  extends Framework.Plugin<InferLoaderConfig<C>, Context<C>, DocsPageData>, RuntimeHooks<C> {
  readonly "~types"?: T;
  /** runs after the content loader is created */
  configure?: (this: Context<C>) => Awaitable<void>;
  /** at most one plugin per capability; a listed plugin providing a preset entry's capability replaces that entry in place */
  provides?: readonly Declared<T, "provides">[];
  /** read by others with `this.getCapability(capability)`; complete at creation, a value of the site is a function of its context */
  api?: ProviderAPI<Declared<T, "provides">>;
  /** pages of the plugin in the language `lang`, called once per language; `ui.renderPage` renders them as `props.type` */
  views?: (
    this: Context<C>,
    env: LangEnv<C>,
  ) => Awaitable<ViewRoute<Declared<T, "views">>[] | undefined>;
  /**
   * routes derived from the final page routes of `lang` (those rendered in `lang`, your own pages without a language in the
   * default one), called once per language: API routes like their Markdown or images, and views like a print page. A path
   * has one route (principle 2); your own page wins (principle 3). An entry is an API route or a view, never both.
   */
  deriveRoutes?: (
    this: Context<C>,
    env: LangEnv<C> & { routes: readonly PageRoute<C>[] },
  ) => Awaitable<
    | (
        | (Framework.ApiRoute & { view?: never })
        | (ViewRoute<Declared<T, "views">> & { [M in Framework.Method | "ALL"]?: never })
      )[]
    | undefined
  >;
  /**
   * a content page of a source the plugin owns (its `source` option), with the props it adds; `body` is the page's
   * content with `body.wrapper` applied, `props.body` of `ui.renderPage`
   */
  getPageView?: (
    this: Context<C>,
    page: C["page"],
    body: Framework.PageBody | undefined,
  ) => Awaitable<PageView<Declared<T, "pages">> | undefined>;
  head?: (this: Context<C>, env: HeadEnv<C>) => Awaitable<HeadTag[] | undefined>;
  slots?: (this: Context<C>, env: PageEnv<C>) => Awaitable<SlotItem<T>[] | undefined>;
  /** merged under the site's `ui.baseOptions`, over the defaults */
  baseOptions?: (this: Context<C>, env: LangEnv<C>) => Awaitable<Partial<BaseOptions> | undefined>;
  /** merged under the site's `ui.providerProps` */
  providerProps?: (
    this: Context<C>,
    env: LangEnv<C>,
  ) => Awaitable<Partial<ProviderProps> | undefined>;
  /**
   * Runs for requests served on demand, prerendered routes skip it.
   *
   * Call `next()` to continue, or `next(path)` to serve another path instead, without the base path like the paths of routes.
   */
  middleware?: (
    this: Context<C>,
    request: Request,
    next: (rewrite?: string) => Promise<Response>,
  ) => Promise<Response>;
  /** runs once after the site is built, not on dev or production servers; throw to fail the build */
  build?: (this: Context<C>, output: PressBuildOutput) => Awaitable<void>;
}

/** a plugin `P` of `.plugins()`, lists are flattened and falsy values left out */
export type PluginOption<P extends PluginInfo = Plugin> =
  | P
  | false
  | undefined
  | null
  | readonly PluginOption<P>[];

/** content of a plugin page, with the props `ui.renderPage` receives for its `type` */
export type View<V> = V extends unknown
  ? {
      [K in keyof V & string]: {
        type: K;
        props: V[K];
        node: ReactNode;
        title?: string;
        description?: string;
      };
    }[keyof V & string]
  : never;

/**
 * `path` without the language prefix; the site prefixes it and links the views of other languages at the same `path`.
 * A view rendered on request (`render: "dynamic"`) gets the request; a static one has none to read.
 */
export type ViewRoute<V = any> = Pick<Framework.ApiRoute, "path" | "staticPaths"> &
  (
    | {
        /** prerendered; `mode: "dynamic"` renders it on request, still without the request */
        render?: "static";
        view(params: Framework.RouteParams): Awaitable<View<V> | undefined>;
      }
    | {
        render: "dynamic";
        view(
          params: Framework.RouteParams,
          env: { request: Request },
        ): Awaitable<View<V> | undefined>;
      }
  );

/** a content page rendered by the plugin owning it: `node` is `props.children` of `ui.renderPage` */
export type PageView<Pg> = Pg extends unknown
  ? { [K in keyof Pg & string]: { props: Pg[K]; node: ReactNode } }[keyof Pg & string]
  : never;

interface SlotBase {
  component: ComponentType<any>;
  /** serializable on Astro, where client components hydrate as islands */
  props?: Record<string, unknown>;
  /** wrappers: lower is outer; context providers use a negative order */
  order?: number;
}

/**
 * UI in places every layout renders:
 *
 * - `actions`: beside the page actions of a content page, `props.actions[name]` of `ui.renderPage`.
 * - `footer`: after the content of a content page, `props.footer[name]`.
 * - `body.wrapper`: around the content of a content page, the component receives it as `children`.
 * - `layout.wrapper`: around the layout of every page, inside the root provider, like `body.wrapper`.
 */
export type SlotItem<T extends PluginTypes = PluginTypes> =
  | { [K in NamedSlot]: SlotBase & { slot: K; name: Declared<T, K> } }[NamedSlot]
  | (SlotBase & { slot: "body.wrapper" | "layout.wrapper" });

/** a route rendering pages: your own page, a view, or a page of a runtime hook; read-only, every plugin reads the same list */
export interface PageRoute<C extends AppShape = AppShape> {
  /** URL pattern, with the language prefix and without the base path */
  readonly path: string;
  readonly lang?: C["lang"];
  readonly render: "static" | "dynamic";
  /** the pages of a static route, or the ones a dynamic route lists in `staticPaths` */
  readonly pages: readonly {
    /** URL path, with the language prefix and without the base path */
    readonly path: string;
    readonly params: Framework.RouteParams;
    /** the page in every language it exists in, itself included */
    readonly translations: { lang: C["lang"]; path: string }[];
  }[];
  /** `getConfig()` of a Waku route file, `{}` on Astro */
  readonly options: Readonly<RouteOptions>;
  /** the Markdown of a page of the route, when the framework renders it (Waku: `asMarkdown()`) */
  markdown?(path: string, params: Framework.RouteParams): Promise<string | undefined>;
}

/** options of a page route, the `getConfig()` of a Waku route file; plugin packages declare their keys by declaration merging */
export interface RouteOptions {}

/** the API of each capability, from `this.getCapability(capability)`; plugin modules add theirs by declaration merging */
export interface CapabilityAPI {
  search: unknown;
  /** the chat docked by the built-in UI: `DocsLayout` is a client component rendering the Docs Layout with it */
  "ai-chat": { DocsLayout: ComponentType<DocsLayoutProps> };
  robots: unknown;
  llms: unknown;
  rss: unknown;
}

/** features only one plugin can provide, the preset fills the ones no plugin provides */
export type Capability = keyof CapabilityAPI | (string & {});

/** the API of a plugin providing the capabilities `K`: `CapabilityAPI[K]` for each, none without a capability */
export type ProviderAPI<K> = [K] extends [never]
  ? never
  : Intersect<CapabilityAPI[K & keyof CapabilityAPI]>;

/** what plugins read of each other */
export type PluginInfo = Pick<Plugin<AppShape, { provides: Capability }>, "name" | "provides">;

/** a preset entry, loaded unless a listed plugin provides its capability */
export interface PresetEntry<
  P extends PluginInfo = Plugin<AppShape, any>,
  K extends Capability = Capability,
> {
  provides: K;
  load: () => Awaitable<P>;
}

/** sitemap, robots.txt, llms.txt, RSS, search and Open Graph images; drop one with `.filter((entry) => entry.provides !== "rss")` */
export function recommendedPreset<C extends AppShape = AppShape>(): PresetEntry<
  Plugin<C, any>,
  "sitemap" | "robots" | "llms" | "rss" | "search" | "og-image"
>[] {
  return [
    {
      provides: "sitemap",
      load: async () => (await import("./plugins/sitemap")).sitemapPlugin<C>(),
    },
    {
      provides: "robots",
      load: async () => (await import("./plugins/robots")).robotsPlugin<C>(),
    },
    {
      provides: "llms",
      load: async () => (await import("./plugins/llms.txt")).llmsPlugin<C>(),
    },
    {
      provides: "rss",
      load: async () => (await import("./plugins/rss")).rssPlugin<C>(),
    },
    {
      provides: "search",
      load: async () => (await import("./plugins/flexsearch")).flexsearchPlugin<C>(),
    },
    {
      provides: "og-image",
      load: async () => (await import("./plugins/takumi")).takumiPlugin<C>(),
    },
  ];
}

/** a tag in `<head>`, rendered in order */
export interface HeadTag {
  tag: "title" | "meta" | "link" | "script" | "style";
  /** HTML attributes, like `hreflang` */
  attrs?: Record<string, string>;
  /** text content, for `title`, `script` and `style` */
  children?: string;
}

/** the build output of a site, with the links of its prerendered pages */
export interface PressBuildOutput {
  /** write a file to the output directory, `path` is relative to it, without the base path */
  emitFile: (path: string, content: string | Uint8Array) => Promise<void>;
  links: { href: string; fromPathname: string }[];
  /** request a page of the built site */
  fetch: (request: Request) => Awaitable<Response>;
}

/** the data of a docs page, transformed by plugins */
export interface DocsPageData extends Framework.DocsPageData {
  /** the URL of its Markdown, for LLMs */
  markdownUrl?: string;
  /** the URL to view its source file */
  githubUrl?: string;
}

/** `children` inside the items of a wrapper slot, the first item outermost */
export function wrapSlot(items: SlotItem[] = [], children: ReactNode): ReactNode {
  return items.reduceRight<ReactNode>(
    (out, { component, props }) => createElement(component, props, out),
    children,
  );
}
