import type { PageBody, PluginContext, PluginLoaderOptions } from "fumadocs-core/framework/plugin";
import type { I18nConfig, SingularTranslationsAPI, TranslationsAPI } from "fumadocs-core/i18n";
import type { StructuredData } from "fumadocs-core/mdx-plugins/remark-structure";
import type { _Internal } from "fumadocs-core/source";
import { dynamicLoader, type DynamicLoader } from "fumadocs-core/source/dynamic";
import type { TOCItemType } from "fumadocs-core/toc";
import {
  flatten,
  nameOf,
  recommendedPreset,
  resolveLayers,
  takeKey,
  type AnyPlugin,
  type AppShape,
  type Awaitable,
  type Capability,
  type CapabilityAPI,
  type DocsPageData,
  type InferLoaderConfig,
  type LangEnv,
  type PageEnv,
  type PageView,
  type Plugin,
  type PresetEntry,
  type PressBuildOutput,
  type SlotItem,
} from "./plugin";
import type {
  BaseOptions,
  InferI18nConfig,
  PageNode,
  Press,
  ProviderProps,
  RenderTarget,
  SiteConfig,
} from "./press";
import { addRepoLink, getFileUrl, resolveGit } from "./git";
import { collectHead, pageAlternate, type HeadEnv, type HeadTag, type PageAlternate } from "./head";
import {
  collectRoutes,
  fallbackOrigin,
  getHomeUrl,
  joinPaths,
  type ApiRoute,
  type CollectedRoutes,
  type PageRoute,
  type PageRouteInput,
  type ServedRoute,
  canonicalPath,
  stripBase,
} from "./routes";
import { providerI18n, renderPage } from "./runtime/render";

/** the site, `this` in plugin hooks; read-only during hooks: core freezes it before the first hook */
export interface Context<out C extends AppShape = AppShape> extends PluginContext<
  InferLoaderConfig<C>
> {
  /**
   * How a route reading this content renders: `dynamic` when one of the content sources is dynamic, of every source without
   * `source`. Your routes follow it with `render: this.getContentRender(page.type)`.
   */
  getContentRender(source?: C["source"] | readonly C["source"][]): "static" | "dynamic";
  /** the languages of the site, `[undefined]` without i18n */
  readonly languages: readonly C["lang"][];
  /** aborted when the runtime drops this context (a reloaded press.config): `fs.watch(dir, { signal: this.signal })` */
  readonly signal: AbortSignal;
  /** the API of the plugin providing `capability` */
  getCapability<K extends Capability>(
    capability: K,
  ): (K extends keyof CapabilityAPI ? CapabilityAPI[K] : unknown) | undefined;
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
  /** custom pages, the views and the pages of runtime hooks; throws while the routes are created */
  getPageRoutes(): Promise<PageRoute<C>[]>;

  getPageBody(page: C["page"]): Promise<PageBody | undefined>;
  getPageText(page: C["page"]): Promise<string | undefined>;
  getPageToc(page: C["page"]): Promise<TOCItemType[] | undefined>;
  getPageStructuredData(page: C["page"]): Promise<StructuredData | undefined>;
  getPageCreatedAt(page: C["page"]): Promise<Date | undefined>;
  getPageLastModified(page: C["page"]): Promise<Date | undefined>;
  /** `ui.baseOptions` over the plugins' contributions, over the defaults (nav title and home, the repository link) */
  getBaseOptions(env: LangEnv<C>): Promise<BaseOptions>;
}

/** what a runtime gives the engine; only runtimes call {@link createPressContext} */
export interface PressRuntime<C extends AppShape = AppShape> {
  /** the base path of the site, `/` at the root */
  base: string;
  /** `siteConfig.baseUrl`: full URL of the site with the base path */
  baseUrl?: string;
  /**
   * Like `trailingSlash: "always"` of the framework: the paths of `absoluteUrl()` without a file extension end with `/`,
   * and so do those of `withBase()`, where adapters redirect other forms and a `POST` would become a `GET`.
   */
  trailingSlash?: boolean;
  /** like `output: "server"` of the framework: routes reading content render on demand, whatever the source is */
  dynamic?: boolean;
  /** the preset without `preset` in `.config()` @defaultValue recommendedPreset() */
  preset?: () => readonly PresetEntry<Plugin<C, any>>[];
  /** the last layer, after the preset: the content renderers (MDX with the `components` module, Astro content collections) */
  defaults: Plugin<C>[];
  /** aborted when the runtime drops the context */
  signal: AbortSignal;
  /** whether `value` is an export of a `'use client'` module: React's client reference on Waku, the island's registry on Astro */
  isClientReference: (value: unknown) => boolean;
}

/** the context as the runtime holds it, from {@link createPressContext} */
export interface RuntimeContext<C extends AppShape = AppShape> extends Context<C> {
  /** in layer order: your plugins, the preset, the runtime's defaults */
  readonly plugins: readonly Plugin<C>[];
  /**
   * The page routes the runtime serves, a page without `lang` belongs to the default language. Set them once the runtime
   * created its pages and before the routes are read, reads throw until then; a new list replaces them.
   */
  setRuntimeRoutes(routes: readonly PageRouteInput<C>[]): void;
  getPageRoutes(): Promise<ServedRoute<C>[]>;
  /** the API routes of `routes` and `deriveRoutes` most specific path first; waits for `deriveRoutes`, unlike `getPageRoutes()` */
  getApiRoutes(): Promise<ApiRoute[]>;
  /** the page of the plugin owning `page`, `body` is its content with `body.wrapper` applied */
  getPageView(page: C["page"], body: PageBody | undefined): Promise<PageView<any> | undefined>;
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
  /** `ui.providerProps` over the plugins' contributions, with the final `i18n` */
  getProviderProps(env: LangEnv<C>): Promise<ProviderProps>;
  /** the page of `ui.renderPage`, or of the built-in UI without it */
  renderPage(target: RenderTarget<C>): Promise<PageNode>;
  /** runs the `middleware` of plugins; `next(path)` of a plugin is `next(path)` here, which re-enters the chain */
  handleRequest(request: Request, next: (rewrite?: string) => Promise<Response>): Promise<Response>;
  /** runs the `build` of plugins, frameworks call it once after building the site */
  build(output: PressBuildOutput): Promise<void>;
}

/** the page hooks answered by the first plugin */
type PageHook =
  | "getPageBody"
  | "getPageView"
  | "getPageText"
  | "getPageToc"
  | "getPageStructuredData"
  | "getPageCreatedAt"
  | "getPageLastModified";

const dev = globalThis.process?.env.NODE_ENV !== "production";

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

/** the routes of one content and one list of the runtime */
interface Collection extends CollectedRoutes {
  source: object;
  inputs: readonly PageRouteInput[];
}

/** paths that keep their form with `trailingSlash`: ending with `/`, or files with their extension, like the URLs of Astro with `trailingSlash: "always"` */
const plainPath = /(\/|\.[^/]+)$/;

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
  /** the keys of the dynamic sources of `content`, `undefined` when it is one source */
  const dynamicSources = new Set<string | undefined>();
  if (typeof content.files === "function") dynamicSources.add(undefined);
  else if (!Array.isArray(content.files))
    for (const [key, source] of Object.entries(content))
      if (typeof source.files === "function") dynamicSources.add(key);
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
      takeKey(
        providers,
        capability,
        plugin,
        (other) =>
          `${nameOf(other)} and ${nameOf(plugin)} both provide "${capability}": a capability has one provider.`,
      );
    }
  }

  for (const plugin of plugins) if (plugin.translations) translations?.extend(plugin.translations);

  const { site } = config;
  const siteConfig: Context["siteConfig"] = Object.freeze({
    ...site,
    baseUrl: runtime.baseUrl,
    name: site?.name ?? "Fumapress",
    git: site?.git && Object.freeze(resolveGit(site.git)),
  });
  const { i18n: _i18n, alwaysRevalidate, loaderPlugins: sitePlugins, ...loaderOptions } = options;
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

  /** a getter of the context, resolving the page hook of the same name */
  function pageHook<K extends PageHook>(hook: K) {
    return (page: AppShape["page"], ...args: unknown[]) =>
      resolve(page, hook, (plugin) => {
        const fn = plugin[hook] as ((...args: unknown[]) => any) | undefined;
        return fn?.call(ctx, page, ...args);
      }) as ReturnType<RuntimeContext[K]>;
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
        takeKey(writers, key, plugins[i]!, (other) => conflict(key, other, plugins[i]!));
        out[key] = value;
      }
    }
    return out;
  }

  /** `url` with `/` at the end of its path, when the runtime has `trailingSlash` */
  function withTrailingSlash(url: string): string {
    if (!runtime.trailingSlash) return url;
    return url.replace(/^[^?#]*/, (path) => (plainPath.test(path) ? path : `${path}/`));
  }

  /** the page routes the runtime serves, from `setRuntimeRoutes()` */
  let runtimeRoutes: readonly PageRouteInput[] | undefined;
  /** the routes of one content and one list of the runtime, collected on the first read */
  let collected: Collection | undefined;
  async function getCollection(): Promise<Collection> {
    const inputs = runtimeRoutes;
    if (!inputs)
      throw new Error(
        "[Fumapress] the routes are read before they are created: read them in handlers, views and `head`, or derive routes from them in `deriveRoutes()`.",
      );
    // not `getLoader()`: a read of the routes is no reason to revalidate with `alwaysRevalidate`
    const source = await loader.get();
    if (collected?.source !== source || collected.inputs !== inputs)
      collected = { source, inputs, ...collectRoutes(ctx, source, inputs) };
    return collected;
  }

  const middleware: AnyPlugin[] = [];
  for (const plugin of plugins) if (plugin.middleware) middleware.push(plugin);

  const ctx: RuntimeContext = Object.freeze({
    languages: Object.freeze(i18nConfig?.languages ?? [undefined]),
    signal: runtime.signal,
    plugins: Object.freeze(plugins),
    setRuntimeRoutes(routes: readonly PageRouteInput[]) {
      runtimeRoutes = routes;
    },
    getContentRender(source?: string | readonly (string | undefined)[]) {
      if (runtime.dynamic) return "dynamic";
      const keys = source === undefined ? [...dynamicSources] : [source].flat();
      return keys.some((key) => dynamicSources.has(key)) ? "dynamic" : "static";
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
      const url = joinPaths("/", runtime.base, pathname);
      return pathname === "/" ? url : withTrailingSlash(url);
    },
    absoluteUrl(pathname: string) {
      if (URL.canParse(pathname)) return pathname;
      const { baseUrl } = ctx.siteConfig;
      // joined to keep the path of `baseUrl`
      const url = baseUrl ? new URL(joinPaths(baseUrl, pathname)).href : ctx.withBase(pathname);
      return withTrailingSlash(url);
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
    getPageRoutes: async () => (await getCollection()).pages,
    getPageBody: pageHook("getPageBody"),
    getPageView: pageHook("getPageView"),
    getPageText: pageHook("getPageText"),
    getPageToc: pageHook("getPageToc"),
    getPageStructuredData: pageHook("getPageStructuredData"),
    getPageCreatedAt: pageHook("getPageCreatedAt"),
    getPageLastModified: pageHook("getPageLastModified"),
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
    getHead: (env: HeadEnv<AppShape>) => collectHead(ctx, config.head, env),
    async getSlots(env: PageEnv<AppShape>) {
      const results = await Promise.all(plugins.map((plugin) => plugin.slots?.call(ctx, env)));
      const items: SlotItem[] = [];
      const names = new Map<string, AnyPlugin>();
      for (const [i, result] of results.entries()) {
        for (const item of result ?? []) {
          if ("name" in item) {
            takeKey(
              names,
              `${item.slot} ${item.name}`,
              plugins[i]!,
              (other) =>
                `${nameOf(other)} and ${nameOf(plugins[i]!)} both add the "${item.slot}" item "${item.name}": a name has one item.`,
            );
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
    getApiRoutes: async () => (await getCollection()).api,
    handleRequest(request: Request, next: (rewrite?: string) => Promise<Response>) {
      const { pathname, search } = new URL(request.url);
      let canonical = canonicalPath(pathname);
      const path = stripBase(canonical, ctx.withBase("/"));
      // like the URLs of pages; the root keeps its slash for the routers that need it
      if (!runtime.trailingSlash && path !== "/" && path?.endsWith("/"))
        canonical = canonical.slice(0, -1);
      if (canonical !== pathname)
        return Promise.resolve(
          new Response(null, { status: 308, headers: { Location: canonical + search } }),
        );

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
    async getProviderProps(env: LangEnv<AppShape>) {
      const [own, ...contributions] = await Promise.all([
        typeof ui.providerProps === "function" ? ui.providerProps.call(ctx, env) : ui.providerProps,
        ...plugins.map((plugin) => plugin.providerProps?.call(ctx, env)),
      ]);
      const props = mergeOptions<ProviderProps>([own, ...contributions]);
      // the default dialog of Fumadocs searches a server the site doesn't have
      if (!props.search?.SearchDialog) props.search = { enabled: false, ...props.search };
      props.i18n = providerI18n(ctx, env, props.i18n);
      return props;
    },
    renderPage: (target: RenderTarget) => renderPage(ctx, ui, target),
  });

  for (const plugin of plugins) await plugin.init?.call(ctx);

  // every plugin gets the site's options: `plugins` are collected, other options have one writer
  const input: PluginLoaderOptions = Object.freeze({
    baseUrl: "/",
    i18n: i18nConfig,
    ...loaderOptions,
    plugins: sitePlugins,
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
        `${nameOf(a)} and ${nameOf(b)} both set the loader option \`${key}\`: an option has one writer, set it in \`createPress()\` to choose.`,
      // the site's options win
      (key) => key === "plugins" || key === "baseUrl" || key === "i18n" || key in loaderOptions,
    ),
    plugins: loaderPlugins,
  });

  for (const plugin of plugins) await plugin.configure?.call(ctx);
  return ctx;
}
