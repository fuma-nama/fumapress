import type { I18nConfig, SingularTranslationsAPI, TranslationsAPI } from "fumadocs-core/i18n";
import { loader } from "fumadocs-core/source";
import { markdownPlugin } from "../plugins/markdown";
import { pagesPlugin } from "../plugins/pages";
import { sitePlugin } from "../plugins/site";
import { mergeHead, withBase } from "./head";
import { localeOf, localizePath } from "./i18n";
import type { DefaultLayouts, LayoutData, LayoutName, LayoutProps } from "./layouts";
import { mergeOptions } from "./merge";
import {
  flatten,
  type AnyPlugin,
  type ApiRoute,
  type AppShape,
  type ContentHooks,
  type HeadEnv,
  type LangEnv,
  type LoaderOptions,
  type PageEnv,
  type RouteFns,
  type ViewRoute,
} from "./plugin";
import type { LayoutOption, Press, PressContext } from "./press";
import { recommendedPreset } from "./preset";
import {
  decodePath,
  encodePath,
  matchRoute,
  normalizePath,
  staticPathsOf,
  validateRoute,
} from "./routes";
import type {
  HeadTag,
  PageBody,
  PageContent,
  PageData,
  PageTree,
  SiteConfig,
  Source,
  StructuredData,
  TOCItem,
} from "./types";

/**
 * The site at runtime: `this` in hooks and options, and the result of `getPressContext()`. Typed by the site: its
 * pages, languages and source keys. Its functions taking a page are methods, so the context of a site fits the
 * context of any site.
 */
export interface Context<out C extends AppShape = AppShape> {
  readonly site: SiteConfig;
  /** the base path of the site, with a trailing slash */
  readonly base: string;
  /** in order: your plugins, the preset, then the built-in ones */
  readonly plugins: readonly AnyPlugin[];
  /** the API routes of plugins */
  readonly routes: readonly ApiRoute[];
  /** the views of the site and of plugins, one per language */
  readonly views: readonly ServedView[];
  /** set with the `i18n` option of the content */
  readonly i18n?: I18nConfig<C["lang"]>;
  /** the languages of the site: those of `i18n`, or `site.lang` alone */
  readonly languages: readonly C["lang"][];
  readonly defaultLanguage: C["lang"];
  /** the content pages, of every language or of one */
  getPages(lang?: C["lang"]): C["page"][];
  /** a content page by its URL, without the base path */
  getPage(pathname: string): C["page"] | undefined;
  /** the page tree of a language @defaultValue the default language */
  getPageTree(lang?: C["lang"]): PageTree.Root;
  /** the content hooks of plugins: the first result, in plugin order */
  getPageBody(page: C["page"]): Promise<PageBody | undefined>;
  getPageToc(page: C["page"]): Promise<TOCItem[] | undefined>;
  getPageText(page: C["page"]): Promise<string | undefined>;
  getPageStructuredData(page: C["page"]): Promise<StructuredData | undefined>;
  getPageLastModified(page: C["page"]): Promise<Date | undefined>;
  /** the data of a page for the browser, with the `transformPage` hook of plugins */
  getPageData(page: C["page"]): Promise<PageData>;
  /** a content page as the browser receives it; fails when no plugin renders it */
  getPageContent(page: C["page"]): Promise<PageContent>;
  /** what the browser receives for a URL: its content page, or a view; none for a 404 */
  getContent(pathname: string): Promise<PageContent | undefined>;
  /** the URLs of the custom pages generated at build time: the ones without params */
  readonly customPages: string[];
  /** the URLs of the content pages and views generated at build time; custom pages are `customPages` */
  getStaticPages(): Promise<string[]>;
  /** the language of a URL */
  getLanguage(pathname: string): C["lang"];
  /** a path in a language: with its prefix, unless `i18n.hideLocale` hides it */
  localizePath(lang: C["lang"], pathname: string): string;
  /** a page in every language it exists in, itself included; empty without another one */
  getPageAlternates(page: C["page"]): { lang: C["lang"]; url: string }[];
  /**
   * How the content renders, or the sources of the keys `source`: `static` pages are generated at build time, the
   * pages of a dynamic source (`files` as a function) render on demand. A route reading the content follows it.
   */
  getContentRender(source?: C["source"] | readonly C["source"][]): "static" | "dynamic";
  /** read the dynamic sources again */
  invalidateLoader(): Promise<void>;
  /** adds the base path */
  withBase(path: string): string;
  /** the full URL of a path, relative without `site.baseUrl` */
  absoluteUrl(path: string): string;
  /**
   * The layout of the content pages in a language, `ui.layout`: its props (`ui.layoutProps` over the `layoutProps`
   * of plugins) and the props of its page (`ui.pageProps`).
   */
  getLayout(env: LangEnv<C>): Promise<LayoutData>;
  getHead(env: HeadEnv<C>): Promise<HeadTag[]>;
}

/** a view of the site or of a plugin in a language */
export interface ServedView {
  route: ViewRoute;
  lang: string;
  /** the URL pattern of its pages, with the language prefix */
  path: string;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" || typeof value === "number" ? String(value) : undefined;
}

/** serializable nodes for the browser: names are text, and the references of the loader to files stay behind */
function toTree(root: any): PageTree.Root {
  const node = (item: any): PageTree.Node => {
    const icon = typeof item.icon === "string" ? item.icon : undefined;
    const $id: string | undefined = item.$id;
    if (item.type === "separator") return { $id, type: "separator", name: text(item.name), icon };
    const base = { $id, name: text(item.name) ?? "", icon };
    if (item.type === "folder") {
      return {
        type: "folder",
        ...base,
        description: text(item.description),
        root: item.root,
        defaultOpen: item.defaultOpen,
        collapsible: item.collapsible,
        index: item.index ? (node(item.index) as PageTree.Item) : undefined,
        children: item.children.map(node),
      };
    }
    return {
      type: "page",
      ...base,
      // a path of the site in its one form, decoded: the loader encodes the ones it makes
      url: (item.url.startsWith("/") && decodePath(item.url)) || item.url,
      external: item.external,
      description: text(item.description),
    };
  };

  return {
    $id: root.$id,
    name: text(root.name) ?? "",
    children: root.children.map(node),
    fallback: root.fallback ? toTree(root.fallback) : undefined,
  };
}

/** where a site runs: its base path, and the custom pages of the app that are generated at build time */
export interface ContextEnv {
  base?: string;
  customPages?: string[];
}

type Page = AppShape["page"];

/** `ui` of any layout */
interface LayoutInput {
  layout?: LayoutName;
  layoutProps?: LayoutOption<AppShape, DefaultLayouts[LayoutName]["layout"]>;
  pageProps?: LayoutOption<AppShape, DefaultLayouts[LayoutName]["page"]>;
}

export async function createContext(
  press: Press<any, any>,
  env: ContextEnv = {},
): Promise<Context> {
  const { content, options, plugins: listed, views: ownViews, config } = press["~press"];
  const site = config.site ?? {};
  if (site.baseUrl !== undefined && !URL.canParse(site.baseUrl)) {
    throw new Error(
      `[Fumapress] \`site.baseUrl\` is "${site.baseUrl}", which is not a URL: write it with its protocol, like "https://docs.example.com".`,
    );
  }
  if ("plugins" in options) {
    throw new Error(
      "[Fumapress] `plugins` of the content options is not read: the plugins of the content loader are `loaderPlugins`, and the plugins of the site go in `.plugins()`.",
    );
  }
  const base = `/${(env.base ?? "/").replace(/^\/+|\/+$/g, "")}/`.replace(/^\/\/$/, "/");
  const ui = config.ui ?? {};
  // the API of the languages of the site, or the singular one: a site without languages takes that one only
  const translations: TranslationsAPI | SingularTranslationsAPI | undefined = ui.translations;
  const preset = await Promise.all((config.preset ?? recommendedPreset()).map((entry) => entry()));
  const plugins: AnyPlugin[] = [
    ...flatten(listed),
    ...preset,
    markdownPlugin(),
    pagesPlugin(translations),
    sitePlugin(),
  ];

  const names = new Set<string>();
  for (const plugin of plugins) {
    if (names.has(plugin.name)) {
      throw new Error(
        `[Fumapress] "${plugin.name}" is added twice: configure a default plugin in \`recommendedPreset()\`, or set it to \`false\` there before listing it.`,
      );
    }
    names.add(plugin.name);
    if (plugin.translations) translations?.extend(plugin.translations);
  }

  // one source has no key, like its pages
  const single = Array.isArray(content.files) || typeof content.files === "function";
  const sources: [key: string | undefined, source: Source][] = single
    ? [[undefined, content as Source]]
    : Object.entries(content as Record<string, Source>);
  const dynamic = new Set(
    sources.filter(([, source]) => typeof source.files === "function").map(([key]) => key),
  );

  const i18n = options.i18n;
  if (i18n?.hideLocale === "always") {
    throw new Error(
      '[Fumapress] `hideLocale: "always"` is not supported, languages are told apart by their URL prefix. Use `hideLocale: "default-locale"` to drop the prefix of the default language only.',
    );
  }
  const defaultLanguage = i18n?.defaultLanguage ?? site.lang ?? "en";
  const languages = i18n?.languages ?? [defaultLanguage];

  let pages: Page[] = [];
  let byUrl = new Map<string, Page>();
  let trees = new Map<string, PageTree.Root>();
  let loaderOptions: LoaderOptions = {};
  const routes: ApiRoute[] = [];
  const views: ServedView[] = [];

  /** the data of a page after the `transformPage` hook of every plugin */
  async function transformPage(data: PageData, env: PageEnv): Promise<PageData> {
    for (const plugin of plugins) {
      const added = await plugin.transformPage?.call(ctx, data, env);
      if (!added) continue;
      // like the other hooks: the page's own data wins, then plugins in order
      const next = { ...data };
      for (const [key, value] of Object.entries(added)) next[key] ??= value;
      data = next;
    }
    return data;
  }

  /** what the browser shows of the `<head>` of a page after it navigated to it */
  async function documentHead(env: HeadEnv): Promise<PageContent["head"]> {
    const tags = await ctx.getHead(env);
    return {
      title: tags.find((tag) => tag.tag === "title")?.content,
      description: tags.find((tag) => tag.tag === "meta" && tag.attrs?.name === "description")
        ?.attrs?.content as string | undefined,
    };
  }

  /** the first result of a content hook, in plugin order */
  async function first<K extends keyof ContentHooks>(
    name: K,
    page: Page,
  ): Promise<Awaited<ReturnType<NonNullable<ContentHooks[K]>>>> {
    for (const plugin of plugins) {
      const out = await (plugin[name] as ((page: Page) => unknown) | undefined)?.call(ctx, page);
      if (out !== undefined) return out as never;
    }
    return undefined as never;
  }

  async function load() {
    const resolved = await Promise.all(
      sources.map(async ([key, source]) => {
        const files = typeof source.files === "function" ? await source.files() : source.files;
        return [key, { files }] as const;
      }),
    );

    // sources share one tree of files: the same path in two of them would silently be one page
    const owners = new Map<string, string | undefined>();
    for (const [key, { files }] of resolved) {
      for (const file of files) {
        if (owners.has(file.path)) {
          throw new Error(
            `[Fumapress] The sources "${owners.get(file.path)}" and "${key}" both have a file at "${file.path}". Give the files of a source their own folder, like \`toSource({ baseDir: "blog" })\`.`,
          );
        }
        owners.set(file.path, key);
      }
    }

    const output = loader({
      baseUrl: "/",
      ...loaderOptions,
      i18n,
      source: single ? resolved[0]![1] : Object.fromEntries(resolved),
    });

    // the loader gives the URL of a link: inside the site, a path is decoded
    pages = output
      .getPages()
      .map((page) => ({ ...page, url: decodePath(page.url) ?? normalizePath(page.url) }));
    byUrl = new Map(pages.map((page) => [page.url, page]));
    trees = new Map(languages.map((lang) => [lang, toTree(output.getPageTree(lang))]));
  }

  const ctx: Context = {
    site,
    customPages: env.customPages ?? [],
    base,
    plugins,
    routes,
    views,
    i18n,
    languages,
    defaultLanguage,
    getPages: (lang) =>
      lang === undefined
        ? pages
        : pages.filter((page) => (page.locale ?? defaultLanguage) === lang),
    getPage: (pathname) => byUrl.get(normalizePath(pathname)),
    getPageTree: (lang = defaultLanguage) => trees.get(lang) ?? { name: "", children: [] },
    getPageBody: (page) => first("getPageBody", page),
    getPageToc: (page) => first("getPageToc", page),
    getPageText: (page) => first("getPageText", page),
    getPageStructuredData: (page) => first("getPageStructuredData", page),
    getPageLastModified: (page) => first("getPageLastModified", page),
    async getPageData(page) {
      const { title, description } = page.data;
      const full = Reflect.get(page.data, "full");
      const modified = await ctx.getPageLastModified(page);
      return transformPage(
        {
          title: text(title),
          description: text(description),
          full: full === true ? true : undefined,
          lastModified: modified?.toISOString(),
        },
        { page, pathname: page.url, lang: page.locale ?? defaultLanguage },
      );
    },
    async getPageContent(page) {
      const [body, data, toc] = await Promise.all([
        ctx.getPageBody(page),
        ctx.getPageData(page),
        ctx.getPageToc(page),
      ]);
      if (!body) {
        throw new Error(
          `[Fumapress] No plugin renders "${page.path}": add a plugin with a \`getPageBody\` hook for its source.`,
        );
      }
      const env = { page, pathname: page.url, lang: page.locale ?? defaultLanguage, data };
      return { url: page.url, data, toc: toc ?? [], body, head: await documentHead(env) };
    },
    async getContent(pathname) {
      const url = normalizePath(pathname);
      const page = byUrl.get(url);
      if (page) return ctx.getPageContent(page);

      for (const { route, lang, path } of views) {
        const params = matchRoute(path, url);
        const result = params && (await route.view({ params, lang }));
        if (!result) continue;
        // the data of the page goes to `data`, the rest is what the theme renders
        const { data: own, ...view } = result;
        const data = await transformPage({ ...route.data, ...own }, { pathname: url, lang });
        const head = await documentHead({ pathname: url, lang, data });
        return { url, data, toc: [], body: { view }, head };
      }
    },
    async getStaticPages() {
      const ofViews = await Promise.all(
        views
          .filter(({ route }) => route.render !== "dynamic")
          .map(({ route, path }) => staticPathsOf({ path, staticPaths: route.staticPaths })),
      );
      const ofContent = pages
        .filter((page) => ctx.getContentRender(page.type) === "static")
        .map((page) => page.url);
      return [...ofContent, ...ofViews.flat()];
    },
    getLanguage: (pathname) =>
      (i18n && localeOf(i18n, normalizePath(pathname)).lang) ?? defaultLanguage,
    localizePath: (lang, pathname) => localizePath(i18n, lang, pathname),
    getPageAlternates(page) {
      if (!i18n) return [];
      // the translations of a page are at its URL in other languages, in any source
      const path = (url: string) => localeOf(i18n, url).pathname;
      const own = path(page.url);
      const out = pages
        .filter((other) => path(other.url) === own)
        .map((other) => ({ lang: other.locale ?? defaultLanguage, url: other.url }));
      return out.length > 1 ? out : [];
    },
    getContentRender(source) {
      const keys = source === undefined ? sources.map(([key]) => key) : [source].flat();
      return keys.some((key) => dynamic.has(key)) ? "dynamic" : "static";
    },
    invalidateLoader: load,
    withBase: (path) => base + path.replace(/^\/+/, ""),
    absoluteUrl(path) {
      // encoded, so a path is never read as the start of another URL
      const url = base + encodePath(normalizePath(path)).slice(1);
      return site.baseUrl ? new URL(url, site.baseUrl).href : url;
    },
    async getLayout(env) {
      // one shape for every layout, where `ui` has one per layout
      const { layout = "docs", layoutProps, pageProps }: LayoutInput = ui;
      const [own, page, ...ofPlugins] = await Promise.all([
        typeof layoutProps === "function" ? layoutProps.call(ctx, env) : layoutProps,
        typeof pageProps === "function" ? pageProps.call(ctx, env) : pageProps,
        ...plugins.map((plugin) => plugin.layoutProps?.call(ctx, env)),
      ]);
      // `ui` is checked by its type: the props of the layout it names, which plugins add to
      return {
        layout,
        layoutProps: mergeOptions<LayoutProps>([own, ...ofPlugins]),
        pageProps: page ?? {},
      } as LayoutData;
    },
    async getHead(env) {
      const ofPlugins = await Promise.all(plugins.map((plugin) => plugin.head?.call(ctx, env)));
      const own =
        typeof config.head === "function" ? await config.head.call(ctx, env) : config.head;
      // a later list wins by key, so the first plugin goes last, then the site's own
      return mergeHead(...ofPlugins.reverse(), withBase(own, base));
    },
  };

  for (const plugin of plugins) await plugin.init?.call(ctx);

  // `i18n` is the site's, given to the loader with the source
  const { loaderPlugins = [], i18n: _, ...own } = options;
  const ofPlugins = await Promise.all(plugins.map((plugin) => plugin.configureLoader?.call(ctx)));
  loaderOptions = mergeOptions<LoaderOptions>([{ ...own, plugins: loaderPlugins }, ...ofPlugins]);

  await load();
  for (const plugin of plugins) await plugin.configure?.call(ctx);

  const fns: RouteFns = {
    createApi(route) {
      if (route.data && (route.GET ?? route.ALL)) {
        throw new Error(
          `[Fumapress] The route "${route.path}" has \`data\` and a \`GET\` handler: a data route answers \`GET\` with the JSON of its data.`,
        );
      }
      // the browser fetches a data route, so it is generated like a view: a static host has its file
      const render = route.render ?? (route.data ? "static" : "dynamic");
      validateRoute(route.path, render === "static");
      routes.push({ ...route, render });
    },
    createView({ lang, ...route }) {
      validateRoute(route.path, route.render !== "dynamic");
      for (const each of lang === undefined ? languages : [lang]) {
        views.push({ route, lang: each, path: ctx.localizePath(each, route.path) });
      }
    },
  };
  // the views of the site first: the first view matching a URL renders it
  for (const [type, { view, ...route }] of Object.entries(ownViews)) {
    fns.createView({
      ...route,
      async view(env) {
        const props = await view.call(ctx, env);
        return props === undefined ? undefined : { type, props };
      },
    });
  }
  for (const plugin of plugins) await plugin.routes?.call(ctx, fns);

  return ctx;
}

const contexts = new WeakMap<Press<any, any>, Promise<Context>>();
let current: Context | undefined;

/** one context per site: a reloaded `press.config` is another site */
export function getContext(press: Press<any, any>, env?: ContextEnv): Promise<Context> {
  let ctx = contexts.get(press);
  if (!ctx) {
    ctx = createContext(press, env);
    contexts.set(press, ctx);
    // a start that failed, like a source that was unreachable, is tried again by the next request
    ctx.catch(() => contexts.delete(press));
  }
  // the site serving the request is the running one
  return ctx.then((resolved) => (current = resolved));
}

/**
 * The context of the running site, for server code outside of hooks, like custom API handlers:
 * `getPressContext<typeof app>()`.
 */
export function getPressContext<A extends Press<any, any> = Press>(): PressContext<A> {
  if (!current) throw new Error("[Fumapress] `getPressContext()` is read before the site started.");
  // the running site is the one of `press.config`, which `A` names
  return current as PressContext<A>;
}
