import type { ComponentType, ReactNode } from "react";
import type * as Framework from "fumadocs-core/framework/plugin";
import type { Meta, Page } from "fumadocs-core/source";
import type { Context } from "./context";
import type { HeadEnv, HeadTag } from "./head";
import type { InferI18nConfig, ProviderProps, SharedLayoutProps } from "./press";
import type { PageRoute, RouteFns } from "./routes";
import type { SitemapOptions } from "./plugins/sitemap";
import type { RobotsOptions } from "./plugins/robots";
import type { LLMsOptions } from "./plugins/llms.txt";
import type { RSSOptions } from "./plugins/rss";
import type { FlexsearchOptions } from "./plugins/flexsearch";
import type { TakumiOptions } from "./plugins/takumi";

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

/** the config of the content loader of a site */
export type InferLoaderConfig<C extends AppShape> = {
  i18n: InferI18nConfig<C["lang"]>;
  meta: C["meta"];
  page: C["page"];
  source: C["source"];
};

/** the env of per-language options and hooks */
export interface LangEnv<C extends AppShape> {
  lang: C["lang"];
}

/** the env of per-request hooks: `page` on a content page, none on the site-wide call */
export interface PageEnv<C extends AppShape> extends LangEnv<C> {
  page?: C["page"];
}

/** what a plugin declares for types: its views, the props it adds to pages of a source, and the names of its slot items */
export type PluginTypes = { views?: object; pages?: object; slots?: string };

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
export interface MergedTypes<U> {
  views: Intersect<Declared<U, "views">>;
  pages: Intersect<Declared<U, "pages">>;
  slots: Declared<U, "slots">;
}

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
// oxlint-disable-next-line no-unused-vars -- merged declarations keep the same type parameters
export interface RuntimeHooks<in C extends AppShape> {}

/**
 * A plugin of Fumapress: a plugin of the framework API with the site's {@link Context} as `this`, views, slots, head tags, middleware and the build.
 *
 * Hooks are properties, so `this` and pages are checked contravariantly: a plugin for any site fits every site. A plugin is a
 * generic factory typed by the site (`myPlugin<C extends AppShape>(options: MyOptions<NoInfer<C>>): Plugin<C, MyTypes>`).
 */
export interface Plugin<in C extends AppShape = AppShape, T extends PluginTypes = {}>
  extends
    Framework.Plugin<InferLoaderConfig<C>, Context<C>, RouteFns<C, Declared<T, "views">>>,
    RuntimeHooks<C> {
  readonly "~types"?: T;
  /** runs before the content loader is created */
  init?: (this: Context<C>) => Awaitable<void>;
  /** runs after the content loader is created */
  configure?: (this: Context<C>) => Awaitable<void>;
  /**
   * routes derived from the final page routes of `lang` (those rendered in `lang`, custom pages without a language in the
   * default one), called once per language: API routes like their Markdown or images, and views like a print page. A path
   * has one route, a custom page wins.
   */
  deriveRoutes?: (
    this: Context<C>,
    fns: RouteFns<C, Declared<T, "views">>,
    env: LangEnv<C> & { routes: readonly PageRoute<C>[] },
  ) => Awaitable<void>;
  /** every page: a content page with `env.page`, a page route with `env.route` and `env.path` */
  transformPage?: (
    this: Context<C>,
    data: Readonly<PageData>,
    env: HeadEnv<C>,
  ) => Awaitable<Partial<PageData> | undefined>;
  /**
   * a content page of a source the plugin owns (its `source` option), with the props it adds; `body` is the page's
   * content with `body-wrapper` applied, `props.body` of `ui.renderPage`
   */
  getPageView?: (
    this: Context<C>,
    page: C["page"],
    body: Framework.PageBody | undefined,
  ) => Awaitable<PageView<Declared<T, "pages">> | undefined>;
  head?: (this: Context<C>, env: HeadEnv<C>) => Awaitable<HeadTag[] | undefined>;
  /** items of a content page with `env.page`, site-wide items without: see {@link SlotRegion} */
  slots?: (this: Context<C>, env: PageEnv<C>) => Awaitable<SlotItem<T>[] | undefined>;
  /** merged under the site's `ui.layoutProps`, over the defaults */
  layoutProps?: (
    this: Context<C>,
    env: PageEnv<C>,
  ) => Awaitable<Partial<SharedLayoutProps> | undefined>;
  /** merged under the site's `ui.providerProps` */
  providerProps?: (
    this: Context<C>,
    env: LangEnv<C>,
  ) => Awaitable<Partial<ProviderProps> | undefined>;
  /**
   * Runs first on every request the server receives: on Waku its static files too, on Astro the routes rendered on demand.
   * Requests a host or CDN serves from the files of the build never reach it, and a build without a server warns that it
   * never runs.
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
  ? { [K in keyof V & string]: { type: K; props: V[K]; node: ReactNode } }[keyof V & string]
  : never;

/** a content page rendered by the plugin owning it: `node` is `props.children` of `ui.renderPage` */
export type PageView<Pg> = Pg extends unknown
  ? { [K in keyof Pg & string]: { props: Pg[K]; node: ReactNode } }[keyof Pg & string]
  : never;

/**
 * The places of the built-in UI, plugins pick one. Items of `actions`, `footer`, `toc-*` and `body-wrapper` come from the
 * `slots` call of a content page (`env.page`), the others from the site-wide call; an item of the other call is an error.
 *
 * - `actions`: the page actions row of a content page, for buttons about the page like sharing it.
 * - `footer`: after the content of a content page.
 * - `toc-header`, `toc-footer`: above and below the table of contents of a content page.
 * - `sidebar-banner`, `sidebar-footer`: above and below the sidebar of a docs layout.
 * - `banner`: above every page, rendered by the root inside `layout-wrapper`.
 * - `body-wrapper`: around the content of a content page, the component receives it as `children`.
 * - `layout-wrapper`: around every page in the root provider, for providers; like `body-wrapper`.
 *
 * `ui.renderPage` receives the items of `actions`, `footer`, `toc-*` and `sidebar-*` as `props.slots`, the built-in UI places
 * them; a region the chosen layout lacks, like the table of contents on the Home Layout, isn't rendered.
 */
export type SlotRegion =
  | "actions"
  | "footer"
  | "toc-header"
  | "toc-footer"
  | "sidebar-banner"
  | "sidebar-footer"
  | "banner"
  | "body-wrapper"
  | "layout-wrapper";

/** UI in a {@link SlotRegion}, named by its plugin types */
export interface SlotItem<T extends PluginTypes = PluginTypes> {
  /** `<plugin>:<item>`, like `feedback:page`; unique on the site, `core:` is Fumapress' own, the site's own names have no `:` */
  name: Declared<T, "slots">;
  region: SlotRegion;
  component: ComponentType<any>;
  /** serializable on Astro, where client components hydrate as islands */
  props?: Record<string, unknown>;
  /** lower first; in wrappers lower is outer, context providers use a negative order */
  order?: number;
}

/** the name of a plugin, in errors and on the routes it created */
export type PluginInfo = Pick<Plugin, "name">;

/** a plugin of the preset, loaded when the site starts */
export type PresetEntry<P extends PluginInfo = Plugin<AppShape, any>> = () => Awaitable<P>;

/** the options of each default plugin, `false` leaves it out */
export interface RecommendedPresetOptions<C extends AppShape = AppShape> {
  sitemap?: SitemapOptions<C> | false;
  robots?: RobotsOptions | false;
  llms?: LLMsOptions<C> | false;
  rss?: RSSOptions<C> | false;
  search?: FlexsearchOptions<C> | false;
  ogImage?: TakumiOptions<C> | false;
}

/**
 * Sitemap, robots.txt, llms.txt, RSS, search and Open Graph images. To replace one, set it to `false` and list your plugin.
 */
export function recommendedPreset<C extends AppShape = AppShape>(
  options: RecommendedPresetOptions<NoInfer<C>> = {},
): PresetEntry<Plugin<C, any>>[] {
  const { sitemap, robots, llms, rss, search, ogImage } = options;
  const out: PresetEntry<Plugin<C, any>>[] = [];
  if (sitemap !== false)
    out.push(async () => (await import("./plugins/sitemap")).sitemapPlugin<C>(sitemap));
  if (robots !== false)
    out.push(async () =>
      (await import("./plugins/robots")).robotsPlugin<C>({
        // the sitemap of the preset, none without it
        sitemap: sitemap === false ? false : (sitemap?.path ?? "/sitemap.xml"),
        ...robots,
      }),
    );
  if (llms !== false)
    out.push(async () => (await import("./plugins/llms.txt")).llmsPlugin<C>(llms));
  if (rss !== false) out.push(async () => (await import("./plugins/rss")).rssPlugin<C>(rss));
  if (search !== false)
    out.push(async () => (await import("./plugins/flexsearch")).flexsearchPlugin<C>(search));
  if (ogImage !== false)
    out.push(async () => (await import("./plugins/takumi")).takumiPlugin<C>(ogImage));
  return out;
}

/** the build output of a site, with the links of its prerendered pages */
export interface PressBuildOutput {
  /** write a file to the output directory, `path` is relative to it, without the base path */
  emitFile: (path: string, content: string | Uint8Array) => Promise<void>;
  links: { href: string; fromPathname: string }[];
  /** request a page of the built site */
  fetch: (request: Request) => Awaitable<Response>;
}

/**
 * The data of a rendered page: a content page, a view or a custom page, transformed by plugins. Plugin modules add their
 * keys by declaration merging.
 */
export interface PageData extends Pick<Page, "url" | "locale">, Partial<Pick<Page, "path">> {
  title: string;
  description?: string;
  /** use the full width of the page */
  full?: boolean;
  /** loaded on the rendered content page, like its table of contents */
  lastModified?: Date;
  /** the URL of its Markdown, for LLMs */
  markdownUrl?: string;
  /** the URL to view its source file */
  githubUrl?: string;
  /** keep search engines out, like pages shown in place of an untranslated page */
  noindex?: boolean;
}

export type AnyPlugin = Plugin<AppShape, any>;

/** plugin names in errors */
export function nameOf(plugin: PluginInfo): string {
  return plugin.name ? `"${plugin.name}"` : "an unnamed plugin";
}

/** the end of a conflict error between two plugins of one name, like a default plugin listed in `.plugins()` too */
export function addedTwice(first: PluginInfo, second: PluginInfo): string {
  if (first.name === undefined || first.name !== second.name) return "";
  return ` ${nameOf(first)} is added twice: configure a default plugin in \`recommendedPreset()\`, or set it to \`false\` there before listing it.`;
}

/** `key` of `owners` has one owner, `conflict` names both */
export function takeKey<K, O>(owners: Map<K, O>, key: K, owner: O, conflict: (first: O) => string) {
  const first = owners.get(key);
  if (first !== undefined) throw new Error(`[Fumapress] ${conflict(first)}`);
  owners.set(key, owner);
}

function isList(option: PluginOption<AnyPlugin>): option is readonly PluginOption<AnyPlugin>[] {
  return Array.isArray(option);
}

export function flatten(
  options: readonly PluginOption<AnyPlugin>[],
  out: AnyPlugin[] = [],
): AnyPlugin[] {
  for (const option of options) {
    if (isList(option)) flatten(option, out);
    else if (option) out.push(option);
  }
  return out;
}

/** the layers in order: your plugins, the preset, the runtime's defaults */
export async function resolveLayers(
  listed: AnyPlugin[],
  preset: readonly PresetEntry<AnyPlugin>[],
  defaults: AnyPlugin[],
): Promise<AnyPlugin[][]> {
  return [listed, await Promise.all(preset.map((entry) => entry())), defaults];
}
