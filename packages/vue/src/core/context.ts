import { loader } from "fumadocs-core/source";
import { markdownPlugin } from "../plugins/markdown";
import { pagesPlugin } from "../plugins/pages";
import { sitePlugin } from "../plugins/site";
import { mergeHead } from "./head";
import { localeOf, localizePath, type I18nConfig } from "./i18n";
import { mergeOptions } from "./merge";
import {
  flatten,
  type ApiRoute,
  type ContentHooks,
  type HeadEnv,
  type LoaderOptions,
  type PageEnv,
  type Plugin,
  type ViewRoute,
} from "./plugin";
import type { Press } from "./press";
import { recommendedPreset } from "./preset";
import { matchRoute, normalizePath, staticPathsOf } from "./routes";
import type {
  HeadTag,
  LayoutProps,
  Page,
  PageBody,
  PageContent,
  PageData,
  PageTree,
  SiteConfig,
  Source,
  StructuredData,
  TOCItem,
} from "./types";

/** the site at runtime: `this` in hooks and options, and the result of `getPressContext()` */
export interface Context {
  readonly site: SiteConfig;
  /** the base path of the site, with a trailing slash */
  readonly base: string;
  /** in order: your plugins, the preset, then the built-in ones */
  readonly plugins: readonly Plugin[];
  /** the API routes of plugins */
  readonly routes: readonly ApiRoute[];
  /** the pages of plugins outside the content, one per language */
  readonly views: readonly ServedView[];
  /** set with the `i18n` option of the content */
  readonly i18n?: I18nConfig;
  /** the languages of the site: those of `i18n`, or `site.lang` alone */
  readonly languages: readonly string[];
  readonly defaultLanguage: string;
  /** the content pages, of every language or of one */
  getPages: (lang?: string) => Page[];
  /** a content page by its URL, without the base path */
  getPage: (pathname: string) => Page | undefined;
  /** the page tree of a language @defaultValue the default language */
  getPageTree: (lang?: string) => PageTree.Root;
  /** the content hooks of plugins: the first result, in plugin order */
  getPageBody: (page: Page) => Promise<PageBody | undefined>;
  getPageToc: (page: Page) => Promise<TOCItem[] | undefined>;
  getPageText: (page: Page) => Promise<string | undefined>;
  getPageStructuredData: (page: Page) => Promise<StructuredData | undefined>;
  getPageLastModified: (page: Page) => Promise<Date | undefined>;
  /** the data of a page for the browser, with the `transformPage` hook of plugins */
  getPageData: (page: Page) => Promise<PageData>;
  /** a content page as the browser receives it; fails when no plugin renders it */
  getPageContent: (page: Page) => Promise<PageContent>;
  /** what the browser receives for a URL: its content page, or the view of a plugin; none for a 404 */
  getContent: (pathname: string) => Promise<PageContent | undefined>;
  /** the URLs of the pages generated at build time: the pages of static sources and the static views */
  getStaticPages: () => Promise<string[]>;
  /** the language of a URL */
  getLanguage: (pathname: string) => string;
  /** a path in a language: with its prefix, unless `i18n.hideLocale` hides it */
  localizePath: (lang: string, pathname: string) => string;
  /** a page in every language it exists in, itself included; empty without another one */
  getPageAlternates: (page: Page) => { lang: string; url: string }[];
  /**
   * How the content, or one source by its key, renders: `static` pages are generated at build time, the pages of a
   * dynamic source (`files` as a function) render on demand.
   */
  getContentRender: (source?: string) => "static" | "dynamic";
  /** read the dynamic sources again */
  invalidateLoader: () => Promise<void>;
  /** adds the base path */
  withBase: (path: string) => string;
  /** the full URL of a path, relative without `site.baseUrl` */
  absoluteUrl: (path: string) => string;
  getLayoutProps: (env: { lang: string }) => Promise<LayoutProps>;
  getHead: (env: HeadEnv) => Promise<HeadTag[]>;
}

/** a view of a plugin in a language */
export interface ServedView {
  route: ViewRoute;
  lang: string;
  /** the URL pattern of its pages, with the language prefix */
  path: string;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" || typeof value === "number" ? String(value) : undefined;
}

/** serializable nodes for the browser: names are text */
function toTree(root: any): PageTree.Root {
  const node = (item: any): PageTree.Node => {
    const icon = typeof item.icon === "string" ? item.icon : undefined;
    const $id: string | undefined = item.$id;
    if (item.type === "separator") return { $id, type: "separator", name: text(item.name), icon };
    const base = { $id, $ref: item.$ref, name: text(item.name) ?? "", icon };
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
      url: item.url,
      external: item.external,
      description: text(item.description),
    };
  };

  return {
    $id: root.$id,
    $ref: root.$ref,
    name: text(root.name) ?? "",
    children: root.children.map(node),
    fallback: root.fallback ? toTree(root.fallback) : undefined,
  };
}

export async function createContext(press: Press, env: { base?: string } = {}): Promise<Context> {
  const { content, options, plugins: listed, config } = press["~press"];
  const site = config.site ?? {};
  const base = `/${(env.base ?? "/").replace(/^\/+|\/+$/g, "")}/`.replace(/^\/\/$/, "/");
  const preset = await Promise.all((config.preset ?? recommendedPreset()).map((entry) => entry()));
  const plugins = [
    ...flatten(listed),
    ...preset,
    markdownPlugin(),
    pagesPlugin(config.ui?.translations),
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
  if ((i18n?.hideLocale as string | undefined) === "always") {
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

    const output = loader({
      baseUrl: "/",
      ...loaderOptions,
      source: single ? resolved[0]![1] : Object.fromEntries(resolved),
    } as never) as any;

    pages = (output.getPages() as any[]).map((page) => ({
      source: single ? undefined : (page.type as string),
      path: page.path,
      slugs: page.slugs,
      url: normalizePath(page.url),
      locale: page.locale,
      data: page.data,
    }));
    byUrl = new Map(pages.map((page) => [page.url, page]));
    trees = new Map(languages.map((lang) => [lang, toTree(output.getPageTree(lang))]));
  }

  const ctx: Context = {
    site,
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
      const { title, description, full } = page.data;
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
      return { url: page.url, data, toc: toc ?? [], body };
    },
    async getContent(pathname) {
      const url = normalizePath(pathname);
      const page = byUrl.get(url);
      if (page) return ctx.getPageContent(page);

      for (const { route, lang, path } of views) {
        const params = matchRoute(path, url);
        const view = params && (await route.view(params, { lang }));
        if (!view) continue;
        const data = await transformPage({ ...route.data }, { pathname: url, lang });
        return { url, data, toc: [], body: { view } };
      }
    },
    async getStaticPages() {
      const ofViews = await Promise.all(
        views
          .filter(({ route }) => route.render !== "dynamic")
          .map(({ route, path }) => staticPathsOf({ path, staticPaths: route.staticPaths })),
      );
      const ofContent = pages
        .filter((page) => ctx.getContentRender(page.source) === "static")
        .map((page) => page.url);
      return [...ofContent, ...ofViews.flat()];
    },
    getLanguage: (pathname) =>
      (i18n && localeOf(i18n, normalizePath(pathname)).lang) ?? defaultLanguage,
    localizePath: (lang, pathname) => localizePath(i18n, lang, pathname),
    getPageAlternates(page) {
      if (!i18n) return [];
      const slugs = page.slugs.join("/");
      const out = pages
        .filter((other) => other.source === page.source && other.slugs.join("/") === slugs)
        .map((other) => ({ lang: other.locale ?? defaultLanguage, url: other.url }));
      return out.length > 1 ? out : [];
    },
    getContentRender(source) {
      const isDynamic = source === undefined ? dynamic.size > 0 : dynamic.has(source);
      return isDynamic ? "dynamic" : "static";
    },
    invalidateLoader: load,
    withBase: (path) => base + path.replace(/^\/+/, ""),
    absoluteUrl(path) {
      const url = ctx.withBase(path);
      return site.baseUrl ? new URL(url, site.baseUrl).href : url;
    },
    async getLayoutProps(env) {
      const own =
        typeof config.ui?.layoutProps === "function"
          ? await config.ui.layoutProps.call(ctx, env)
          : config.ui?.layoutProps;
      const ofPlugins = await Promise.all(
        plugins.map((plugin) => plugin.layoutProps?.call(ctx, env)),
      );
      return mergeOptions<LayoutProps>([own, ...ofPlugins]);
    },
    async getHead(env) {
      const ofPlugins = await Promise.all(plugins.map((plugin) => plugin.head?.call(ctx, env)));
      const own =
        typeof config.head === "function" ? await config.head.call(ctx, env) : config.head;
      // a later list wins by key, so the first plugin goes last, then the site's own
      return mergeHead(...ofPlugins.reverse(), own);
    },
  };

  for (const plugin of plugins) await plugin.init?.call(ctx);

  const { loaderPlugins = [], ...own } = options;
  const ofPlugins = await Promise.all(plugins.map((plugin) => plugin.configureLoader?.call(ctx)));
  loaderOptions = mergeOptions<LoaderOptions>([{ ...own, plugins: loaderPlugins }, ...ofPlugins]);

  await load();
  for (const plugin of plugins) await plugin.configure?.call(ctx);
  for (const plugin of plugins) {
    await plugin.routes?.call(ctx, {
      createApi: (route) => void routes.push(route),
      createView({ lang, ...route }) {
        for (const each of lang === undefined ? languages : [lang]) {
          views.push({ route, lang: each, path: ctx.localizePath(each, route.path) });
        }
      },
    });
  }

  return ctx;
}

const contexts = new WeakMap<Press, Promise<Context>>();
let current: Context | undefined;

/** one context per site: a reloaded `press.config` is another site */
export function getContext(press: Press, env?: { base?: string }): Promise<Context> {
  let ctx = contexts.get(press);
  if (!ctx) {
    ctx = createContext(press, env);
    contexts.set(press, ctx);
  }
  // the site serving the request is the running one
  return ctx.then((resolved) => (current = resolved));
}

/** the context of the running site, for server code outside of hooks, like custom API handlers */
export function getPressContext(): Context {
  if (!current) throw new Error("[Fumapress] `getPressContext()` is read before the site started.");
  return current;
}
