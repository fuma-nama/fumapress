import type { PageBody, PluginContext, PluginLoaderOptions } from "fumadocs-core/framework/plugin";
import type { I18nConfig, SingularTranslationsAPI, TranslationsAPI } from "fumadocs-core/i18n";
import type { StructuredData } from "fumadocs-core/mdx-plugins/remark-structure";
import type { _Internal, LoaderConfig, LoaderOutput } from "fumadocs-core/source";
import { dynamicLoader, type DynamicLoader } from "fumadocs-core/source/dynamic";
import type { TOCItemType } from "fumadocs-core/toc";
import {
  recommendedPreset,
  type AppShape,
  type Awaitable,
  type Capability,
  type CapabilityAPI,
  type DocsPageData,
  type HeadEnv,
  type HeadTag,
  type LangEnv,
  type PageEnv,
  type ApiRoute,
  type PageRoute,
  type PageView,
  type Plugin,
  type PluginInfo,
  type PluginOption,
  type PresetEntry,
  type PressBuildOutput,
  type RouteFns,
  type SlotItem,
  type ViewRoute,
} from "./plugin";
import type { BaseOptions, BuildMode, Press, ProviderProps } from "./press";
import { addRepoLink, getFileUrl, resolveGit, type GitProvider } from "./git";
import {
  compareRoutes,
  createLocalizer,
  expandRoute,
  getHomeUrl,
  matchRoute,
  methods,
} from "./routes";

/** the i18n config of a site with the languages `Lang`, plugins for any site (`string | undefined`) get either */
export type InferI18nConfig<Lang extends string | undefined> = [Lang] extends [undefined]
  ? undefined
  : [Lang] extends [string]
    ? I18nConfig<Lang>
    : I18nConfig | undefined;

/** the config of the content loader of a site */
export type InferLoaderConfig<C extends AppShape> = {
  i18n: InferI18nConfig<C["lang"]>;
  meta: C["meta"];
  page: C["page"];
  source: C["source"];
};

export interface SiteConfig {
  /** full URL of the site with the base path, like `https://example.com/docs`, for metadata like canonical URLs */
  baseUrl?: string;

  /**
   * `hreflang` values by language, for language codes that are not BCP 47 language tags.
   *
   * @example { cn: "zh-Hans" }
   */
  hreflang?: Record<string, string>;

  name?: string;

  git?: {
    /** @defaultValue "github" */
    provider?: GitProvider;
    /** base URL of a self-hosted instance, like `https://gitlab.example.com` */
    url?: string;
    /** the user or organisation (group on GitLab) that owns the repo */
    user: string;
    repo: string;
    branch: string;
    /** the root directory of the repo */
    rootDir?: string;
  };
}

export interface PageAlternate<C extends AppShape = AppShape> {
  lang: C["lang"];
  /** from `site.hreflang`, defaults to the language code */
  hreflang: string;
  href: string;
}

/** the site, `this` in plugin hooks; read-only during hooks: core freezes it before the first hook */
export interface Context<out C extends AppShape = AppShape> extends PluginContext<
  InferLoaderConfig<C>
> {
  readonly mode: BuildMode;
  /** the languages of the site, `[undefined]` without i18n */
  readonly languages: readonly C["lang"][];
  /** the base path of the site, `/` at the root */
  readonly base: string;
  /** aborted when the runtime drops this context (a reloaded press.config): `fs.watch(dir, { signal: this.signal })` */
  readonly signal: AbortSignal;
  /** in layer order: your plugins, the preset, the runtime's defaults */
  readonly plugins: readonly PluginInfo[];
  /** the API of the plugin providing `capability` */
  getCapability<K extends keyof CapabilityAPI>(capability: K): CapabilityAPI[K] | undefined;
  readonly siteConfig: Readonly<
    Pick<SiteConfig, "baseUrl" | "hreflang"> & Required<Pick<SiteConfig, "name">>
  > & {
    /** `site.git` with `provider`, `url` and `rootDir` resolved */
    readonly git?: Readonly<
      NonNullable<SiteConfig["git"]> &
        Required<Pick<NonNullable<SiteConfig["git"]>, "provider" | "url" | "rootDir">>
    >;
  };
  readonly i18nConfig?: InferI18nConfig<C["lang"]>;
  /** extended with the translations of plugins */
  readonly translationsConfig?: TranslationsAPI<NonNullable<C["lang"]>> | SingularTranslationsAPI;

  /** revalidate dynamic content sources, all of them without `source` */
  revalidateLoader(source?: C["source"]): Promise<void>;
  /** invalidate dynamic content sources, all of them without `source` */
  invalidateLoader(source?: C["source"]): void;

  /** prefix `pathname` with the language segment, unless `i18n.hideLocale` hides it */
  localizePath(lang: C["lang"], pathname: string): string;
  /** a full URL from `site.baseUrl`, or `withBase(pathname)` when unset; full URLs are kept. Paths without a file extension end with `/` when the runtime has `trailingSlash` */
  absoluteUrl(pathname: string): string;
  /** the URL of a file on the git provider, requires `site.git` */
  getFileUrl(absolutePath: string): string | undefined;
  /** whether `value` is an export of a `'use client'` module, which runs in the browser */
  isClientReference(value: unknown): boolean;
  /** translations of a page for `hreflang` links, without fallback pages, empty when it has none */
  getPageAlternates(page: C["page"]): Promise<PageAlternate<C>[]>;
  /** your own pages, the views and the pages of runtime hooks; throws while the routes are created */
  getRoutes(): Promise<PageRoute<C>[]>;

  getPageBody(page: C["page"]): Promise<PageBody | undefined>;
  /** the page of the plugin owning `page`, `body` is its content with `body.wrapper` applied */
  getPageView(page: C["page"], body: PageBody | undefined): Promise<PageView<any> | undefined>;
  getPageText(page: C["page"]): Promise<string | undefined>;
  getPageToc(page: C["page"]): Promise<TOCItemType[] | undefined>;
  getPageStructuredData(page: C["page"]): Promise<StructuredData | undefined>;
  getPageCreatedAt(page: C["page"]): Promise<Date | undefined>;
  getPageLastModified(page: C["page"]): Promise<Date | undefined>;
  /** the data of a docs page, from the page and `transformPage` of plugins */
  getPageData(page: C["page"]): Promise<DocsPageData>;
  /**
   * Without `page` and `route`: the tags of every page. With them: the page's whole head, its own tags (core's title, Open
   * Graph, canonical and `hreflang` on content pages) over the tags of every page. Keyed by `title`, `meta`
   * `name`/`property`/`http-equiv`, canonical and `hreflang`: yours win over plugins', theirs over core's.
   */
  getHead(env: HeadEnv<C>): Promise<HeadTag[]>;
  /** of a content page with `page`, `layout.wrapper` without it; sorted by `order` */
  getSlots(env: PageEnv<C>): Promise<Partial<Record<SlotItem["slot"], SlotItem[]>>>;
  /** runs the `middleware` of plugins; `next(path)` of a plugin is `next(path)` here, which re-enters the chain */
  handleRequest(request: Request, next: (rewrite?: string) => Promise<Response>): Promise<Response>;
  /** runs the `build` of plugins, frameworks call it once after building the site */
  build(output: PressBuildOutput): Promise<void>;
  /** `ui.baseOptions` over the plugins' contributions, over the defaults (nav title and home, the repository link) */
  getBaseOptions(env: LangEnv<C>): Promise<BaseOptions>;
  /** `ui.providerProps` over the plugins' contributions */
  getProviderProps(env: LangEnv<C>): Promise<ProviderProps>;
}

/** what a runtime gives the engine; only runtimes call {@link createPressContext} */
export interface PressRuntime<C extends AppShape = AppShape> {
  /** the base path of the site, `/` at the root */
  base: string;
  /**
   * Like `trailingSlash: "always"` of the framework: the paths of `absoluteUrl()` without a file extension end with `/`,
   * and so do those of `withBase()` for the routes rendered on request, which the framework serves only in that form.
   */
  trailingSlash?: boolean;
  /** the preset without `preset` in `.config()` @defaultValue recommendedPreset() */
  preset?: () => readonly PresetEntry<Plugin<C, any>>[];
  /** the last layer, after the preset: the content renderers (MDX with the `components` module, Astro content collections) and the `translations` of the UI */
  defaults: Plugin<C>[];
  /** aborted when the runtime drops the context */
  signal: AbortSignal;
  /** whether `value` is an export of a `'use client'` module: React's client reference on Waku, the island's registry on Astro */
  isClientReference: (value: unknown) => boolean;
}

/** a page route the runtime serves: your own page, or a page a plugin's runtime hook (`waku.createPages`) created */
export interface RuntimeRoute<C extends AppShape = AppShape> {
  route: PageRoute<C>;
  /** the plugin that created it, none on your own pages */
  plugin?: PluginInfo;
}

/** a view with its page route, as the runtime serves it */
export interface RoutedView<C extends AppShape = AppShape> {
  route: PageRoute<C>;
  view: ViewRoute;
}

/** the context as the runtime holds it, from {@link createPressContext} */
export interface RuntimeContext<C extends AppShape = AppShape> extends Context<C> {
  /** in layer order, with the hooks the runtime runs */
  readonly plugins: readonly Plugin<C>[];
  /**
   * The page routes the runtime serves, a page without `lang` belongs to the default language. Set them once the runtime
   * created its pages and before the routes are read, reads throw until then; a new list replaces them.
   */
  setRuntimeRoutes(routes: readonly RuntimeRoute<C>[]): void;
  /** the API routes of `routes` and `deriveRoutes` with `render` resolved from `mode`, most specific path first */
  getApiRoutes(): Promise<ApiRoute[]>;
  /** the views and the views of `deriveRoutes` with their page routes, without the ones your own pages replace, most specific path first */
  getViewRoutes(): Promise<RoutedView<C>[]>;
}

/** join `paths` to `base` with `/`, `base` is kept as-is, like a base URL */
export function joinPaths(base: string, ...paths: string[]): string {
  let out = base;
  for (let p of paths) {
    if (p.startsWith("/")) p = p.slice(1);
    if (p.endsWith("/")) p = p.slice(0, -1);
    // skip empty and `.` segments, like a relative base path of `./`
    if (p.length === 0 || p === ".") continue;

    out = out.endsWith("/") ? out + p : `${out}/${p}`;
  }
  return out;
}

/**
 * The page `page` is inherited from when its language has no file of its own, pages shared by every language (`$`) count too.
 *
 * Translations are told apart by their file path: the loader assigns a file to a language by its `.{locale}` suffix, so two languages share a `path` only when they share the file.
 */
export function fallbackOrigin<Config extends LoaderConfig>(
  source: LoaderOutput<Config>,
  i18n: I18nConfig | undefined,
  page: Config["page"],
): Config["page"] | undefined {
  if (!i18n) return;
  const lang = i18n.fallbackLanguage ?? i18n.defaultLanguage;
  if (page.locale === lang) return;
  const origin = source.getPage(page.slugs, lang);
  if (origin?.path === page.path) return origin;
}

/** `hreflang` alternate of the page at `pathname` in `lang` */
export function pageAlternate(ctx: Context, lang: string, pathname: string): PageAlternate {
  return {
    lang,
    hreflang: ctx.siteConfig.hreflang?.[lang] ?? lang,
    href: ctx.absoluteUrl(pathname),
  };
}

/** canonical and `og:url` of the page at `pathname` (with `site.baseUrl`), `hreflang` links of its `alternates` */
export function pageLinks(ctx: Context, pathname: string, alternates: PageAlternate[]): HeadTag[] {
  const tags: HeadTag[] = [];
  if (ctx.siteConfig.baseUrl) {
    const href = ctx.absoluteUrl(pathname);
    tags.push(
      { tag: "link", attrs: { rel: "canonical", href } },
      { tag: "meta", attrs: { property: "og:url", content: href } },
    );
  }
  for (const { hreflang, href } of alternates)
    tags.push({ tag: "link", attrs: { rel: "alternate", hreflang, href } });
  const xDefault =
    alternates.find((item) => item.lang === ctx.i18nConfig?.defaultLanguage) ?? alternates[0];
  if (xDefault)
    tags.push({
      tag: "link",
      attrs: { rel: "alternate", hreflang: "x-default", href: xDefault.href },
    });
  return tags;
}

/** plugin names in errors */
function nameOf(plugin: PluginInfo): string {
  return plugin.name ? `"${plugin.name}"` : "an unnamed plugin";
}

function isList(option: PluginOption<AnyPlugin>): option is readonly PluginOption<AnyPlugin>[] {
  return Array.isArray(option);
}

function flatten(options: readonly PluginOption<AnyPlugin>[], out: AnyPlugin[] = []): AnyPlugin[] {
  for (const option of options) {
    if (isList(option)) flatten(option, out);
    else if (option) out.push(option);
  }
  return out;
}

type AnyPlugin = Plugin<AppShape, any>;

/** the layers in order: your plugins, the preset (where a listed plugin providing an entry's capability takes its place), the runtime's defaults */
async function resolveLayers(
  listed: AnyPlugin[],
  preset: readonly PresetEntry<AnyPlugin>[],
  defaults: AnyPlugin[],
): Promise<AnyPlugin[][]> {
  const placed = new Set<AnyPlugin>();
  const loading: Awaitable<AnyPlugin>[] = [];
  for (const entry of preset) {
    let replaced = false;
    for (const plugin of listed) {
      if (!plugin.provides?.includes(entry.provides)) continue;
      replaced = true;
      if (placed.has(plugin)) continue;
      placed.add(plugin);
      loading.push(plugin);
    }
    if (!replaced) loading.push(entry.load());
  }

  const own: AnyPlugin[] = [];
  for (const plugin of listed) if (!placed.has(plugin)) own.push(plugin);
  return [own, await Promise.all(loading), defaults];
}

const dev = globalThis.process?.env.NODE_ENV !== "production";

const headKeyAttrs = ["name", "property", "http-equiv"];

/** the key of a tag that one value per page has, like its `title` */
function headKey({ tag, attrs = {} }: HeadTag): string | undefined {
  if (tag === "title") return tag;
  if (tag === "meta") {
    for (const name of headKeyAttrs) if (attrs[name]) return `meta ${name}=${attrs[name]}`;
  }
  if (tag === "link" && attrs.rel === "canonical") return "canonical";
  if (tag === "link" && attrs.rel === "alternate" && attrs.hreflang)
    return `alternate ${attrs.hreflang}`;
}

/** the tags of `lists`, the first list wins a key; an unkeyed tag repeating another is dropped */
export function mergeHead(lists: readonly (readonly HeadTag[] | undefined)[]): HeadTag[] {
  const out: HeadTag[] = [];
  const seen = new Set<string>();
  for (const tags of lists) {
    for (const tag of tags ?? []) {
      const key = headKey(tag) ?? JSON.stringify(tag);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(tag);
    }
  }
  return out;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  // elements, `lazy()` and `memo()` are React objects, not options
  if (typeof value !== "object" || value === null || "$$typeof" in value) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** objects merge deeply and lists concatenate, in order; otherwise the first defined value wins */
function mergeOptions<T extends object>(sources: readonly (Partial<T> | undefined)[]): Partial<T>;
function mergeOptions(sources: readonly unknown[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const source of sources) {
    if (!isPlainObject(source)) continue;
    for (const [key, value] of Object.entries(source)) {
      const current = out[key];
      if (value === undefined) continue;
      if (current === undefined) out[key] = isPlainObject(value) ? mergeOptions([value]) : value;
      else if (Array.isArray(current) && Array.isArray(value)) out[key] = [...current, ...value];
      else if (isPlainObject(current) && isPlainObject(value))
        out[key] = mergeOptions([current, value]);
    }
  }
  return out;
}

/** the key of a route pattern in "a path has one route", params of any name are one key */
function patternKey(pattern: string): string {
  const segments: string[] = [];
  for (const seg of pattern.split("/")) {
    if (!seg) continue;
    if (seg.startsWith("[...")) segments.push("[...]");
    else if (seg.startsWith("[")) segments.push("[]");
    else segments.push(seg);
  }
  return `/${segments.join("/")}`;
}

/** the key of a page in "a path has one route" */
function pageKey(path: string): string {
  return path.replace(/(.)\/$/, "$1");
}

/** the keys of "a path has one route": the route's pattern (unless `undefined`), and its pages */
function routeKeys(pattern: string | undefined, pages: readonly { path: string }[]): Set<string> {
  const keys = new Set<string>();
  if (pattern !== undefined) keys.add(patternKey(pattern));
  for (const page of pages) keys.add(pageKey(page.path));
  return keys;
}

interface CollectedRoutes {
  api: ApiRoute[];
  views: RoutedView[];
  pageRoutes: PageRoute[];
}

/** the routes of one content and one list of the runtime */
interface Collection {
  source: object;
  served: readonly RuntimeRoute[];
  routes: Promise<CollectedRoutes>;
  /**
   * The page routes `deriveRoutes` derive from, while they run. Pages rendered by them (the Markdown of `llmsPlugin`) read
   * these instead of waiting for themselves; `deriveRoutes` add no pages a home or a redirect is looked up in.
   */
  deriving?: PageRoute[];
}

/** paths that keep their form with `trailingSlash`: ending with `/`, or files with their extension, like the URLs of Astro with `trailingSlash: "always"` */
const plainPath = /(\/|\.[^/]+)$/;

/** the owner of your own pages in route conflicts */
const ownPage = "your own page";

/** the context of `getPressContext()`; not `createContext`, which is React's */
export function createPressContext<C extends AppShape>(
  press: Press<C, any>,
  runtime: PressRuntime<C>,
): Promise<RuntimeContext<C>>;

export async function createPressContext(
  press: Press,
  runtime: PressRuntime,
): Promise<RuntimeContext> {
  const { content, options, plugins: listed, config } = press["~press"];
  const ui = config.ui ?? {};
  const translations = ui.translations;
  const i18nConfig = options.i18n;
  if (i18nConfig?.hideLocale === "always")
    throw new Error(
      '[Fumapress] `hideLocale: "always"` is not supported, languages are told apart by their URL prefix. Use `hideLocale: "default-locale"` to drop the prefix of the default language only.',
    );

  const layers = await resolveLayers(
    flatten(listed),
    config.preset ?? runtime.preset?.() ?? recommendedPreset(),
    runtime.defaults,
  );
  const plugins = layers.flat();
  const layerOf = new Map<AnyPlugin, number>();
  for (const [i, layer] of layers.entries()) for (const plugin of layer) layerOf.set(plugin, i);

  const providers = new Map<Capability, AnyPlugin>();
  for (const plugin of plugins) {
    for (const capability of plugin.provides ?? []) {
      const other = providers.get(capability);
      if (other)
        throw new Error(
          `[Fumapress] ${nameOf(other)} and ${nameOf(plugin)} both provide "${capability}": a capability has one provider.`,
        );
      providers.set(capability, plugin);
    }
  }

  for (const plugin of plugins) if (plugin.translations) translations?.extend(plugin.translations);

  const { site } = config;
  const siteConfig: Context["siteConfig"] = Object.freeze({
    ...site,
    name: site?.name ?? "Fumapress",
    git: site?.git && Object.freeze(resolveGit(site.git)),
  });
  const mode = config.mode ?? "default";
  const { alwaysRevalidate, ...loaderOptions } = options.loaderOptions ?? {};
  let loader: DynamicLoader<InferLoaderConfig<AppShape>>;

  /** the first answer of the first layer answering; in development, a second answer of that layer is an error */
  async function resolve<T>(
    page: AppShape["page"],
    hook: string,
    call: (plugin: AnyPlugin) => Awaitable<T | undefined>,
  ): Promise<T | undefined> {
    let found: { plugin: AnyPlugin; value: T } | undefined;
    for (const plugin of plugins) {
      if (found && (!dev || layerOf.get(plugin) !== layerOf.get(found.plugin))) break;
      const value = await call(plugin);
      if (value === undefined) continue;
      if (found)
        throw new Error(
          `[Fumapress] ${nameOf(found.plugin)} and ${nameOf(plugin)} both answer \`${hook}\` for "${page.url}": a page has one renderer.`,
        );
      found = { plugin, value };
    }
    return found?.value;
  }

  /**
   * The fields that the results of transform hooks change from `base`, unless `fixed`: every plugin transforms the same
   * base, a field has one writer.
   */
  function changes(
    base: object,
    results: readonly (object | undefined)[],
    conflict: (key: string, first: AnyPlugin, second: AnyPlugin) => string,
    fixed?: (key: string) => boolean,
  ): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    const writers = new Map<string, AnyPlugin>();
    for (const [i, result] of results.entries()) {
      for (const [key, value] of Object.entries(result ?? {})) {
        if (fixed?.(key) || Object.is(value, Reflect.get(base, key))) continue;
        const other = writers.get(key);
        if (other) throw new Error(`[Fumapress] ${conflict(key, other, plugins[i]!)}`);
        writers.set(key, plugins[i]!);
        out[key] = value;
      }
    }
    return out;
  }

  /** `this` of the hooks creating routes, where reading the routes would wait for themselves */
  function routeContext<T>(plugin: AnyPlugin, run: (ctx: Context) => Promise<T>): Promise<T> {
    let creating = true;
    const reject = () =>
      creating
        ? Promise.reject(
            new Error(
              `[Fumapress] ${nameOf(plugin)} reads the routes while plugins create them: derive routes from the final list in \`deriveRoutes()\`.`,
            ),
          )
        : undefined;
    const guarded: Context = Object.freeze(
      Object.create(ctx, { getRoutes: { value: () => reject() ?? ctx.getRoutes() } }),
    );
    return run(guarded).finally(() => {
      creating = false;
    });
  }

  async function collectRoutes(
    source: LoaderOutput<InferLoaderConfig<AppShape>>,
    runtimeRoutes: readonly RuntimeRoute[],
    /** sets {@link Collection.deriving} */
    derive: (routes?: PageRoute[]) => void,
  ): Promise<CollectedRoutes> {
    const { languages } = ctx;
    const defaultLanguage = ctx.i18nConfig?.defaultLanguage;
    /** route key → its owner, for "a path has one route": the plugin, your own page or a content page */
    const owners = new Map<string, PluginInfo | string>();
    const contentUrls: string[] = [];
    for (const page of source.getPages()) {
      contentUrls.push(page.url);
      owners.set(page.url, `the content page "${page.url}"`);
    }
    const out: CollectedRoutes = { api: [], views: [], pageRoutes: [] };
    const localize = createLocalizer(ctx);

    /** false when your own page takes a key of a plugin's page (yours wins), an error naming both for any other owner */
    function claim(keys: Set<string>, owner: PluginInfo, path: string, page: boolean): boolean {
      for (const key of keys) {
        const other = owners.get(key);
        if (other === undefined) continue;
        if (page && other === ownPage) return false;
        throw new Error(
          `[Fumapress] ${typeof other === "string" ? other : nameOf(other)} and ${nameOf(owner)} both take the path "${path}": a path has one route.`,
        );
      }
      for (const key of keys) owners.set(key, owner);
      return true;
    }

    function checkRender(plugin: AnyPlugin, path: string, render: "static" | "dynamic") {
      if (render === "dynamic" && mode === "static")
        throw new Error(
          `[Fumapress] the route "${path}" of ${nameOf(plugin)} renders on request, which \`mode: "static"\` can't serve: turn it off in the options of the plugin, or use another \`mode\`. Plugins that can degrade read \`this.mode\`.`,
        );
    }

    function addApi(plugin: AnyPlugin, route: ApiRoute) {
      const declared = route.render ?? "dynamic";
      checkRender(plugin, route.path, declared);
      const render = mode === "dynamic" ? "dynamic" : declared;
      if (render === "static") {
        if (!route.staticPaths && route.path.includes("["))
          throw new Error(
            `[Fumapress] the static route "${route.path}" has params, list the params of its pages in \`staticPaths\`.`,
          );
        const other = route.ALL
          ? "ALL"
          : methods.find((method) => method !== "GET" && route[method]);
        if (other)
          throw new Error(
            `[Fumapress] the static route "${route.path}" is generated from its GET handler, its ${other} handler needs \`render: 'dynamic'\` to run on the server.`,
          );
      }
      const { pattern, pages } = expandRoute(
        route.path,
        render === "static" ? route.staticPaths : undefined,
      );
      const paths: { path: string }[] = [];
      for (const page of pages) paths.push({ path: page.pathname });
      // a static route serves only its listed paths, which a page pattern like your own `/[...slug]` leaves to it
      claim(routeKeys(render === "static" ? undefined : pattern, paths), plugin, route.path, false);
      out.api.push({ ...route, render });
    }

    function addView(plugin: AnyPlugin, route: ViewRoute, lang: string | undefined) {
      const render = route.render === "dynamic" || mode === "dynamic" ? "dynamic" : "static";
      checkRender(plugin, route.path, route.render ?? "static");
      if (render === "static" && !route.staticPaths && route.path.includes("["))
        throw new Error(
          `[Fumapress] the static view "${route.path}" has params, list the params of its pages in \`staticPaths\`.`,
        );
      const expanded = expandRoute(route.path, route.staticPaths);
      const pattern = ctx.localizePath(lang, expanded.pattern);
      if (owners.get(patternKey(pattern)) === ownPage) return;
      // your own page at one of its pages takes only that page
      const pages: PageRoute["pages"][number][] = [];
      const staticPaths: string[][] = [];
      for (const [i, { pathname, params }] of expanded.pages.entries()) {
        if (owners.get(pageKey(ctx.localizePath(lang, pathname))) === ownPage) continue;
        pages.push({ ...localize(lang, pathname), params });
        const entry = route.staticPaths?.[i];
        if (entry !== undefined) staticPaths.push(typeof entry === "string" ? [entry] : entry);
      }
      if (render === "static" && pages.length === 0) return;
      claim(routeKeys(pattern, pages), plugin, pattern, true);
      if (render === "dynamic" && route.path.includes("[")) {
        for (const url of contentUrls) {
          if (matchRoute(pattern, url))
            throw new Error(
              `[Fumapress] the content page "${url}" and ${nameOf(plugin)} both take the path "${url}": a path has one route.`,
            );
        }
      }

      const pageRoute: PageRoute = { path: pattern, lang, render, pages, options: {} };
      out.views.push({
        route: pageRoute,
        view: pages.length === expanded.pages.length ? route : { ...route, staticPaths },
      });
      out.pageRoutes.push(pageRoute);
    }

    // your own pages first: they win over the pages of plugins
    for (const { route, plugin } of runtimeRoutes) {
      if (plugin) continue;
      for (const key of routeKeys(route.path, route.pages)) owners.set(key, ownPage);
      out.pageRoutes.push(route);
    }
    for (const { route, plugin } of runtimeRoutes) {
      if (plugin && claim(routeKeys(route.path, route.pages), plugin, route.path, true))
        out.pageRoutes.push(route);
    }

    /** a view without `lang` is created in `langs`, the languages the hook covers */
    const routeFns = (plugin: AnyPlugin, langs: readonly (string | undefined)[]): RouteFns => ({
      createApi: (route) => addApi(plugin, route),
      createView(route) {
        if (route.lang !== undefined) addView(plugin, route, route.lang);
        else for (const lang of langs) addView(plugin, route, lang);
      },
    });

    await Promise.all(
      plugins.map((plugin) =>
        routeContext(plugin, (ctx) =>
          Promise.resolve(plugin.routes?.call(ctx, routeFns(plugin, languages))),
        ),
      ),
    );

    const final = [...out.pageRoutes];
    derive(final);
    await Promise.all(
      plugins.map((plugin) =>
        routeContext(plugin, (ctx) =>
          Promise.all(
            languages.map((lang) => {
              const routes: PageRoute[] = [];
              for (const route of final)
                if ((route.lang ?? defaultLanguage) === lang) routes.push(route);
              return plugin.deriveRoutes?.call(ctx, routeFns(plugin, [lang]), {
                lang,
                routes: Object.freeze(routes),
              });
            }),
          ),
        ),
      ),
    ).finally(() => derive());

    out.api.sort((a, b) => compareRoutes(a.path, b.path));
    out.views.sort((a, b) => compareRoutes(a.route.path, b.route.path));
    lastRoutes = out;
    return out;
  }

  /** the last collected routes: `withBase()` is synchronous, the runtime renders once they are collected */
  let lastRoutes: CollectedRoutes | undefined;
  /** whether the runtime serves `path` only with `/`: a route rendered on request without a file extension */
  function endsWithSlash(path: string): boolean {
    if (!runtime.trailingSlash || !lastRoutes || plainPath.test(path)) return false;
    for (const route of lastRoutes.api)
      if (route.render === "dynamic" && matchRoute(route.path, path)) return true;
    for (const { route } of lastRoutes.views)
      if (route.render === "dynamic" && matchRoute(route.path, path)) return true;
    return false;
  }

  /** the page routes the runtime serves, from `setRuntimeRoutes()` */
  let served: readonly RuntimeRoute[] | undefined;
  /** the routes of one content and one list of the runtime, collected on the first read */
  let collected: Collection | undefined;
  async function getCollection(): Promise<Collection> {
    const current = served;
    if (!current)
      throw new Error(
        "[Fumapress] the routes are read before they are created: read them in handlers, views and `head`, or derive routes from them in `deriveRoutes()`.",
      );
    const source = await ctx.getLoader();
    if (collected?.source !== source || collected.served !== current) {
      const collection: Collection = {
        source,
        served: current,
        routes: collectRoutes(source, current, (routes) => {
          collection.deriving = routes;
        }),
      };
      collected = collection;
    }
    return collected;
  }
  async function collectedRoutes(): Promise<CollectedRoutes> {
    return (await getCollection()).routes;
  }

  /** the tags of one call of `head`, the site's first and core's last */
  async function headOf(env: HeadEnv<AppShape>): Promise<HeadTag[]> {
    const own =
      typeof config.head === "function"
        ? config.head.call(ctx, env)
        : env.page || env.route
          ? undefined
          : config.head;
    const lists = await Promise.all([
      own,
      ...plugins.map((plugin) => plugin.head?.call(ctx, env)),
      coreHead(env),
    ]);
    return mergeHead(lists);
  }

  /** core's tags of a page: title, description and Open Graph of content pages, the title and description of views, canonical and `hreflang` of every page */
  async function coreHead({
    page,
    route,
    path,
    view,
  }: HeadEnv<AppShape>): Promise<HeadTag[] | undefined> {
    if (route && path !== undefined) {
      const tags: HeadTag[] = [];
      if (view?.title) tags.push({ tag: "title", children: view.title });
      if (view?.description)
        tags.push({ tag: "meta", attrs: { name: "description", content: view.description } });
      const alternates: PageAlternate[] = [];
      const current = route.pages.find((item) => item.path === path);
      if (current && current.translations.length > 1) {
        for (const item of current.translations)
          if (item.lang) alternates.push(pageAlternate(ctx, item.lang, item.path));
      }
      tags.push(...pageLinks(ctx, path, alternates));
      return tags;
    }
    if (!page) return;

    const { title, description } = page.data;
    const [source, alternates] = await Promise.all([ctx.getLoader(), ctx.getPageAlternates(page)]);
    const origin = fallbackOrigin(source, ctx.i18nConfig, page);
    const tags: HeadTag[] = [{ tag: "title", children: title }];
    if (description)
      tags.push({ tag: "meta", attrs: { name: "description", content: description } });
    tags.push({ tag: "meta", attrs: { property: "og:title", content: title ?? "" } });
    if (description)
      tags.push({ tag: "meta", attrs: { property: "og:description", content: description } });
    tags.push(
      { tag: "meta", attrs: { property: "og:site_name", content: ctx.siteConfig.name } },
      ...pageLinks(ctx, (origin ?? page).url, alternates),
    );
    if (origin) tags.push({ tag: "meta", attrs: { name: "robots", content: "noindex" } });
    return tags;
  }

  const middleware: AnyPlugin[] = [];
  for (const plugin of plugins) if (plugin.middleware) middleware.push(plugin);

  const ctx: RuntimeContext = Object.freeze({
    mode,
    languages: Object.freeze(i18nConfig?.languages ?? [undefined]),
    base: runtime.base,
    signal: runtime.signal,
    plugins: Object.freeze(plugins),
    setRuntimeRoutes(routes: readonly RuntimeRoute[]) {
      served = routes;
    },
    getCapability: (capability: Capability) => providers.get(capability)?.api,
    siteConfig,
    i18nConfig,
    translationsConfig: translations,
    getLoader() {
      if (!loader)
        throw new Error(
          "[Fumapress] the content loader is created after `configureLoader()`, use it from `configure()` on.",
        );
      // `get()` revalidates the invalidated sources
      if (alwaysRevalidate) loader.invalidate();
      return loader.get();
    },
    async revalidateLoader(name?: string) {
      await loader?.revalidate(name);
    },
    invalidateLoader(name?: string) {
      loader?.invalidate(name);
    },
    localizePath(lang: string | undefined, pathname: string) {
      const i18n = ctx.i18nConfig;
      if (!i18n || !lang || (i18n.hideLocale === "default-locale" && lang === i18n.defaultLanguage))
        return pathname;
      return joinPaths(`/${lang}`, pathname);
    },
    withBase(pathname: string) {
      const url = joinPaths("/", ctx.base, pathname);
      return endsWithSlash(pathname) ? `${url}/` : url;
    },
    absoluteUrl(pathname: string) {
      if (URL.canParse(pathname)) return pathname;
      const { baseUrl } = ctx.siteConfig;
      // joined to keep the path of `baseUrl`
      const url = baseUrl ? new URL(joinPaths(baseUrl, pathname)).href : ctx.withBase(pathname);
      return runtime.trailingSlash && !plainPath.test(url) ? `${url}/` : url;
    },
    getFileUrl: (absolutePath: string) =>
      ctx.siteConfig.git && getFileUrl(ctx.siteConfig.git, absolutePath),
    isClientReference: runtime.isClientReference,
    async getPageAlternates(page: AppShape["page"]) {
      const i18n = ctx.i18nConfig;
      if (!i18n) return [];
      const source = await ctx.getLoader();
      const out: PageAlternate[] = [];
      for (const lang of i18n.languages) {
        const target = source.getPage(page.slugs, lang);
        if (!target || fallbackOrigin(source, i18n, target)) continue;
        out.push(pageAlternate(ctx, lang, target.url));
      }
      return out.length > 1 ? out : [];
    },
    async getRoutes() {
      const { deriving, routes } = await getCollection();
      return deriving ?? (await routes).pageRoutes;
    },
    getPageBody: (page: AppShape["page"]) =>
      resolve(page, "getPageBody", (plugin) => plugin.getPageBody?.call(ctx, page)),
    getPageView: (page: AppShape["page"], body: PageBody | undefined) =>
      resolve(page, "getPageView", (plugin) => plugin.getPageView?.call(ctx, page, body)),
    getPageText: (page: AppShape["page"]) =>
      resolve(page, "getPageText", (plugin) => plugin.getPageText?.call(ctx, page)),
    getPageToc: (page: AppShape["page"]) =>
      resolve(page, "getPageToc", (plugin) => plugin.getPageToc?.call(ctx, page)),
    getPageStructuredData: (page: AppShape["page"]) =>
      resolve(page, "getPageStructuredData", (plugin) =>
        plugin.getPageStructuredData?.call(ctx, page),
      ),
    getPageCreatedAt: (page: AppShape["page"]) =>
      resolve(page, "getPageCreatedAt", (plugin) => plugin.getPageCreatedAt?.call(ctx, page)),
    getPageLastModified: (page: AppShape["page"]) =>
      resolve(page, "getPageLastModified", (plugin) => plugin.getPageLastModified?.call(ctx, page)),
    async getPageData(page: AppShape["page"]) {
      const { data } = page;
      const [toc = [], lastModified] = await Promise.all([
        ctx.getPageToc(page),
        ctx.getPageLastModified(page),
      ]);
      const base: DocsPageData = Object.freeze({
        title: data.title ?? page.slugs.at(-1) ?? "",
        description: data.description,
        url: page.url,
        path: page.path,
        locale: page.locale,
        toc,
        // from the frontmatter or content sources
        full: "full" in data && typeof data.full === "boolean" ? data.full : undefined,
        lastModified,
        githubUrl: page.absolutePath ? ctx.getFileUrl(page.absolutePath) : undefined,
      });
      const results = await Promise.all(
        plugins.map((plugin) => plugin.transformPage?.call(ctx, base, page)),
      );
      return {
        ...base,
        ...changes(
          base,
          results,
          (key, a, b) =>
            `${nameOf(a)} and ${nameOf(b)} both set \`${key}\` of the page "${page.url}": a field of the page data has one \`transformPage\`.`,
        ),
      };
    },
    async getHead(env: HeadEnv<AppShape>) {
      if (!env.page && !env.route) return headOf({});
      // a page's own value wins over the one of every page
      const [own, every] = await Promise.all([headOf(env), headOf({})]);
      return mergeHead([own, every]);
    },
    async getSlots(env: PageEnv<AppShape>) {
      const results = await Promise.all(plugins.map((plugin) => plugin.slots?.call(ctx, env)));
      const items: SlotItem[] = [];
      const names = new Map<string, AnyPlugin>();
      for (const [i, result] of results.entries()) {
        for (const item of result ?? []) {
          if ("name" in item) {
            const key = `${item.slot} ${item.name}`;
            const other = names.get(key);
            if (other)
              throw new Error(
                `[Fumapress] ${nameOf(other)} and ${nameOf(plugins[i]!)} both add the "${item.slot}" item "${item.name}": a name has one item.`,
              );
            names.set(key, plugins[i]!);
          }
          items.push(item);
        }
      }
      // stable: equal orders keep the layer and list order
      items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      const out: Partial<Record<SlotItem["slot"], SlotItem[]>> = {};
      for (const item of items) (out[item.slot] ??= []).push(item);
      return out;
    },
    getApiRoutes: async () => (await collectedRoutes()).api,
    getViewRoutes: async () => (await collectedRoutes()).views,
    handleRequest(request: Request, next: (rewrite?: string) => Promise<Response>) {
      function dispatch(i: number): Promise<Response> {
        const plugin = middleware[i];
        if (!plugin) return next();
        return plugin.middleware!.call(ctx, request, (rewrite) =>
          rewrite === undefined ? dispatch(i + 1) : next(rewrite),
        );
      }
      return dispatch(0);
    },
    async build(output: PressBuildOutput) {
      for (const plugin of plugins) await plugin.build?.call(ctx, output);
    },
    // `this`: the context of the caller, which hooks creating routes guard
    async getBaseOptions(this: Context, env: LangEnv<AppShape>) {
      const [own, ...contributions] = await Promise.all([
        typeof ui.baseOptions === "function" ? ui.baseOptions.call(this, env) : ui.baseOptions,
        ...plugins.map((plugin) => plugin.baseOptions?.call(this, env)),
      ]);
      const props = mergeOptions<BaseOptions>([own, ...contributions]);
      const { name, git } = ctx.siteConfig;
      // the defaults, the last layer
      const out: BaseOptions = {
        ...props,
        nav: {
          ...props.nav,
          title: props.nav?.title ?? name,
          url: props.nav?.url ?? (await getHomeUrl(this, env.lang)),
        },
      };
      return git ? addRepoLink(out, git) : out;
    },
    async getProviderProps(this: Context, env: LangEnv<AppShape>) {
      const [own, ...contributions] = await Promise.all([
        typeof ui.providerProps === "function"
          ? ui.providerProps.call(this, env)
          : ui.providerProps,
        ...plugins.map((plugin) => plugin.providerProps?.call(this, env)),
      ]);
      const props = mergeOptions<ProviderProps>([own, ...contributions]);
      // the default dialog of Fumadocs searches a server the site doesn't have
      if (!props.search?.SearchDialog) props.search = { enabled: false, ...props.search };
      return props;
    },
  });

  for (const plugin of plugins) await plugin.init?.call(ctx);

  // every plugin gets the site's options: `plugins` are collected, other options have one writer
  const input: PluginLoaderOptions = Object.freeze({
    baseUrl: "/",
    i18n: i18nConfig,
    ...loaderOptions,
  });
  const results = await Promise.all(
    plugins.map((plugin) => plugin.configureLoader?.call(ctx, input)),
  );
  const loaderPlugins = [...(input.plugins ?? [])];
  for (const result of results) loaderPlugins.push(...(result?.plugins ?? []));
  loader = dynamicLoader<_Internal.AnyInput, I18nConfig | undefined>(content, {
    ...input,
    ...changes(
      input,
      results,
      (key, a, b) =>
        `${nameOf(a)} and ${nameOf(b)} both set the loader option \`${key}\`: an option has one writer, set it in \`loaderOptions\` to choose.`,
      // the site's options win
      (key) => key === "plugins" || key === "baseUrl" || key === "i18n" || key in loaderOptions,
    ),
    plugins: loaderPlugins,
  });

  for (const plugin of plugins) await plugin.configure?.call(ctx);
  return ctx;
}
