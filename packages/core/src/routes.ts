import type * as Framework from "fumadocs-core/framework/plugin";
import type { I18nConfig } from "fumadocs-core/i18n";
import { findPath } from "fumadocs-core/page-tree";
import type { LoaderConfig, LoaderOutput } from "fumadocs-core/source";
import type { Context, RuntimeContext } from "./context";
import {
  nameOf,
  takeKey,
  type AnyPlugin,
  type AppShape,
  type Awaitable,
  type InferLoaderConfig,
  type PluginInfo,
  type View,
} from "./plugin";

/** `[name]` params are strings, `[...name]` params are arrays of segments */
export type RouteParams = Record<string, string | string[]>;

/** a web-standard handler, return a 404 response for paths without content */
export type RouteHandler = (
  request: Request,
  context: { params: RouteParams },
) => Awaitable<Response>;

/** an API route, its handlers are named by method, `ALL` handles every method */
export interface ApiRoute extends Partial<Record<Framework.Method | "ALL", RouteHandler>> {
  /**
   * URL pattern without the base path, like `/llms.txt` or `/api/[...slugs]`.
   *
   * Params are written as `[name]`, and `[...name]` for the rest of the path.
   */
  path: string;

  /**
   * - `dynamic`: handle requests on the server.
   * - `static`: generate the `GET` response at build time, `mode: "dynamic"` handles it on request.
   *
   * @defaultValue "dynamic"
   */
  render?: "static" | "dynamic";

  /** the params of each static page, in the order of the path, required when a static path has params */
  staticPaths?: string[] | string[][];
}

/** what plugins create in `routes` and `deriveRoutes`, before the hook returns */
export interface RouteFns<C extends AppShape = AppShape, V = any> extends Framework.RouteFns {
  createApi(route: ApiRoute): void;
  /**
   * a page of the plugin, `ui.renderPage` renders it as `props.type`. Without `lang`, it is created in the languages the hook
   * covers: every language in `routes`, `env.lang` in `deriveRoutes`.
   */
  createView(route: ViewRoute<V, C["lang"]> & { lang?: C["lang"] }): void;
}

/**
 * `path` without the language prefix; the site prefixes it and links the views of other languages at the same `path`. A view
 * rendered on request (`render: "dynamic"`) gets the request; a static one has none to read.
 */
export type ViewRoute<V = any, Lang extends string | undefined = string | undefined> = Pick<
  ApiRoute,
  "path" | "staticPaths"
> &
  (
    | {
        /** prerendered; `mode: "dynamic"` renders it on request, still without the request */
        render?: "static";
        view(params: RouteParams, env: { lang: Lang }): Awaitable<View<V> | undefined>;
      }
    | {
        render: "dynamic";
        view(
          params: RouteParams,
          env: { lang: Lang; request: Request },
        ): Awaitable<View<V> | undefined>;
      }
  );

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
    readonly params: RouteParams;
    /** the page in every language it exists in, itself included */
    readonly translations: { lang: C["lang"]; path: string }[];
  }[];
  /** `getConfig()` of a Waku route file, `{}` on Astro */
  readonly options: Readonly<RouteOptions>;
  /** the Markdown of a page of the route, when the framework renders it (Waku: `asMarkdown()`) */
  markdown?(path: string, params: RouteParams): Promise<string | undefined>;
}

/** a page route as the runtime serves it */
export interface ServedRoute<C extends AppShape = AppShape> extends PageRoute<C> {
  /** the plugin that created it, none on your own pages */
  readonly plugin?: PluginInfo;
  /** the view it renders */
  readonly view?: ViewRoute;
  /** the object the runtime created it from, in `setRuntimeRoutes()` */
  readonly input?: object;
}

/** options of a page route, the `getConfig()` of a Waku route file; plugin packages declare their keys by declaration merging */
export interface RouteOptions {}

/** a page route the runtime serves: your own page, or a page a plugin's runtime hook (`waku.createPages`) created */
export interface PageRouteInput<C extends AppShape = AppShape>
  extends
    Pick<ServedRoute<C>, "lang" | "render" | "markdown" | "plugin">,
    Partial<Pick<PageRoute<C>, "options">>,
    Pick<ApiRoute, "path" | "staticPaths"> {
  /** match `path` literally, for paths with brackets */
  exactPath?: boolean;
}

export const methods: readonly Framework.Method[] = [
  "GET",
  "HEAD",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
];

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

/** `pathname` without the base path `base` (`withBase('/')`), `undefined` outside of it */
export function stripBase(pathname: string, base: string): string | undefined {
  if (base === "/") return pathname;
  if (pathname === base) return "/";
  if (pathname.startsWith(`${base}/`)) return pathname.slice(base.length);
}

/**
 * A route's URL pattern without route groups (`(name)`), and its pages with their concrete
 * pathname and route params, one per entry of `staticPaths` when the path has params, the path
 * itself otherwise. An `exactPath` route is one page at its literal path.
 */
export function expandRoute(
  path: string,
  staticPaths: readonly string[] | readonly string[][] | undefined,
  exactPath = false,
): { pattern: string; pages: { pathname: string; params: RouteParams }[] } {
  const segments: string[] = [];
  for (const seg of path.split("/")) if (seg && !seg.startsWith("(")) segments.push(seg);
  const pattern = "/" + segments.join("/");
  const pages: { pathname: string; params: RouteParams }[] = [];

  if (exactPath || !segments.some((seg) => seg.includes("["))) {
    pages.push({ pathname: pattern, params: {} });
    return { pattern, pages };
  }

  for (const entry of staticPaths ?? []) {
    const values = typeof entry === "string" ? [entry] : entry;
    const params: RouteParams = {};
    let pathname = "";
    let i = 0;

    for (const seg of segments) {
      if (seg.startsWith("[...") && seg.endsWith("]")) {
        const rest = values.slice(i);
        i = values.length;
        params[seg.slice(4, -1)] = rest;
        for (const value of rest) pathname += "/" + value;
      } else if (seg.startsWith("[") && seg.endsWith("]")) {
        const value = values[i++]!;
        params[seg.slice(1, -1)] = value;
        pathname += "/" + value;
      } else {
        pathname += "/" + seg;
      }
    }

    pages.push({ pathname: pathname || "/", params });
  }

  return { pattern, pages };
}

/**
 * The route params of `pathname` when it matches `pattern`, the inverse of {@link expandRoute}:
 * `[name]` is one segment, `[...name]` the rest (zero or more segments), a trailing slash is ignored.
 */
export function matchRoute(pattern: string, pathname: string): RouteParams | undefined {
  const segments: string[] = [];
  try {
    for (const seg of pathname.split("/")) if (seg) segments.push(decodeURIComponent(seg));
  } catch {
    // a malformed escape matches no route
    return;
  }

  const params: RouteParams = {};
  let i = 0;
  for (const part of pattern.split("/")) {
    if (!part) continue;
    if (part.startsWith("[...") && part.endsWith("]")) {
      params[part.slice(4, -1)] = segments.slice(i);
      return params;
    }

    const value = segments[i++];
    if (value === undefined) return;
    if (part.startsWith("[") && part.endsWith("]")) params[part.slice(1, -1)] = value;
    else if (part !== value) return;
  }
  if (i === segments.length) return params;
}

/** static segments (and a path ending), then params, then rest params */
function segmentRank(segment = ""): number {
  if (segment.startsWith("[...")) return 2;
  return segment.startsWith("[") ? 1 : 0;
}

/** sorts route patterns by specificity, the most specific first, like the routers of frameworks */
export function compareRoutes(a: string, b: string): number {
  const x = a.split("/");
  const y = b.split("/");
  for (let i = 1; i < Math.max(x.length, y.length); i++) {
    const diff = segmentRank(x[i]) - segmentRank(y[i]);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** whether one of `routes` has a page at `path` */
function hasPage(routes: { pages: readonly { path: string }[] }[], path: string): boolean {
  return routes.some((route) => route.pages.some((page) => page.path === path));
}

/** the home of a language (without the base path): its `/`, or its first page when nothing is there */
export async function getHomeUrl(ctx: Context, lang: string | undefined): Promise<string> {
  const home = ctx.localizePath(lang, "/");
  const loader = await ctx.getLoader();
  if (loader.getPageByUrl(home, lang) || hasPage(await ctx.getPageRoutes(), home)) return home;
  // links of meta files aren't pages
  const path = findPath(
    loader.getPageTree(lang).children,
    (node) => node.type === "page" && loader.getPageByUrl(node.url, lang) !== undefined,
    { includeSeparator: false },
  );
  const page = path?.at(-1);
  return page?.type === "page" ? page.url : home;
}

/** where `/` redirects (without the base path) when every language has a URL prefix, unless you have a page there */
export async function rootRedirect(ctx: Context): Promise<string | undefined> {
  const i18n = ctx.i18nConfig;
  if (!i18n || i18n.hideLocale === "default-locale") return;
  if (hasPage(await ctx.getPageRoutes(), "/")) return;
  return getHomeUrl(ctx, i18n.defaultLanguage);
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

/** the language of `path` (without the base path) by its URL prefix, the default language without one */
export function pathLocale(ctx: Context, path: string): string | undefined {
  const prefix = path.split("/", 2)[1];
  return prefix && ctx.i18nConfig?.languages.includes(prefix)
    ? prefix
    : ctx.i18nConfig?.defaultLanguage;
}

/** every page route, also the views of `deriveRoutes` that `getPageRoutes()` doesn't wait for */
export async function getPageRoutesWithDerived<C extends AppShape>(
  ctx: RuntimeContext<C>,
): Promise<ServedRoute<C>[]> {
  const [routes] = await Promise.all([ctx.getPageRoutes(), ctx.getApiRoutes()]);
  return routes;
}

/** the most specific of the `routes` that `accepts` matching `pathname`, with its params */
export function matchPageRoute<R extends Pick<PageRoute, "path">>(
  routes: readonly R[],
  pathname: string,
  accepts?: (route: R) => boolean,
): { route: R; params: RouteParams } | undefined {
  let found: { route: R; params: RouteParams } | undefined;
  for (const route of routes) {
    if (accepts && !accepts(route)) continue;
    if (found && compareRoutes(route.path, found.route.path) >= 0) continue;
    const params = matchRoute(route.path, pathname);
    if (params) found = { route, params };
  }
  return found;
}

/** the route of the view at `/404` in `lang`, or in the default language: the 404 page of `lang` */
export async function notFoundView<C extends AppShape>(
  ctx: RuntimeContext<C>,
  lang: C["lang"],
): Promise<ServedRoute<C> | undefined> {
  let found: ServedRoute<C> | undefined;
  for (const route of await getPageRoutesWithDerived(ctx)) {
    if (route.view?.path !== "/404") continue;
    if (route.lang === lang) return route;
    if (route.lang === ctx.i18nConfig?.defaultLanguage) found = route;
  }
  return found;
}

type ExpandedPages = ReturnType<typeof expandRoute>["pages"];

type Source = LoaderOutput<InferLoaderConfig<AppShape>>;

export interface CollectedRoutes {
  /**
   * Settled after the `routes` of plugins, so pages rendered by `deriveRoutes` (the Markdown of `llmsPlugin`) can read them;
   * `deriveRoutes` add their views to the list, no page a home or a redirect is looked up in.
   */
  pages: Promise<ServedRoute[]>;
  /** settled after `deriveRoutes` */
  api: Promise<ApiRoute[]>;
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

/** the owner of your own pages in route conflicts */
const ownPage = "your own page";

/** `this` of the hooks creating routes, where reading the routes would wait for themselves */
function routeContext<T>(
  ctx: RuntimeContext,
  source: Source,
  plugin: AnyPlugin,
  run: (ctx: Context) => Promise<T>,
): Promise<T> {
  let creating = true;
  const guarded: Context = Object.freeze(
    Object.create(ctx, {
      getPageRoutes: {
        value: () =>
          creating
            ? Promise.reject(
                new Error(
                  `[Fumapress] ${nameOf(plugin)} reads the routes while plugins create them: derive routes from the final list in \`deriveRoutes()\`.`,
                ),
              )
            : ctx.getPageRoutes(),
      },
      // `alwaysRevalidate` would give the next read of the routes another content to collect them from
      getLoader: { value: () => (creating ? source : ctx.getLoader()) },
    }),
  );
  return run(guarded).finally(() => {
    creating = false;
  });
}

/** the routes of `source` and `inputs` */
export function collectRoutes(
  ctx: RuntimeContext,
  source: Source,
  inputs: readonly PageRouteInput[],
): CollectedRoutes {
  const { languages, mode, plugins } = ctx;
  const defaultLanguage = ctx.i18nConfig?.defaultLanguage;
  /** route key → its owner, for "a path has one route": the plugin, your own page or a content page */
  const owners = new Map<string, PluginInfo | string>();
  const contentUrls: string[] = [];
  for (const page of source.getPages()) {
    contentUrls.push(page.url);
    owners.set(page.url, `the content page "${page.url}"`);
  }
  const out: { api: ApiRoute[]; pages: ServedRoute[] } = { api: [], pages: [] };
  /** the pages of the routes in other languages at a pathname */
  const translations = new Map<string, PageRoute["pages"][number]["translations"]>();

  /** the keys of "a path has one route": the route's pattern (unless `undefined`), and its pages */
  function routeKeys(
    pattern: string | undefined,
    pages: ExpandedPages,
    lang: string | undefined,
  ): Set<string> {
    const keys = new Set<string>();
    if (pattern !== undefined) keys.add(patternKey(pattern));
    for (const page of pages) keys.add(pageKey(ctx.localizePath(lang, page.pathname)));
    return keys;
  }

  function localizePages(pages: ExpandedPages, lang: string | undefined): PageRoute["pages"] {
    const localized: PageRoute["pages"][number][] = [];
    for (const { pathname, params } of pages) {
      let siblings = translations.get(pathname);
      if (!siblings) translations.set(pathname, (siblings = []));
      const path = ctx.localizePath(lang, pathname);
      if (lang) siblings.push({ lang, path });
      localized.push({ path, params, translations: siblings });
    }
    return localized;
  }

  /** false when your own page takes a key of a plugin's page (yours wins), an error naming both for any other owner */
  function claim(keys: Set<string>, owner: PluginInfo, path: string, page: boolean): boolean {
    if (page) for (const key of keys) if (owners.get(key) === ownPage) return false;
    for (const key of keys)
      takeKey(
        owners,
        key,
        owner,
        (other) =>
          `${typeof other === "string" ? other : nameOf(other)} and ${nameOf(owner)} both take the path "${path}": a path has one route.`,
      );
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
      const other = route.ALL ? "ALL" : methods.find((method) => method !== "GET" && route[method]);
      if (other)
        throw new Error(
          `[Fumapress] the static route "${route.path}" is generated from its GET handler, its ${other} handler needs \`render: 'dynamic'\` to run on the server.`,
        );
    }
    const { pattern, pages } = expandRoute(
      route.path,
      render === "static" ? route.staticPaths : undefined,
    );
    // a static route serves only its listed paths, which a page pattern like your own `/[...slug]` leaves to it
    claim(
      routeKeys(render === "static" ? undefined : pattern, pages, undefined),
      plugin,
      route.path,
      false,
    );
    out.api.push({ ...route, path: pattern, render });
  }

  function addRuntimeRoute(input: PageRouteInput) {
    const { lang, render, options = {}, markdown, plugin } = input;
    const { pattern, pages } = expandRoute(input.path, input.staticPaths, input.exactPath);
    const path = ctx.localizePath(lang, pattern);
    const keys = routeKeys(path, pages, lang);
    if (!plugin) for (const key of keys) owners.set(key, ownPage);
    else if (!claim(keys, plugin, path, true)) return;
    out.pages.push({
      path,
      lang,
      render,
      pages: localizePages(pages, lang),
      options,
      markdown,
      plugin,
      input,
    });
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
    const pages: ExpandedPages = [];
    const staticPaths: string[][] = [];
    for (const [i, page] of expanded.pages.entries()) {
      if (owners.get(pageKey(ctx.localizePath(lang, page.pathname))) === ownPage) continue;
      pages.push(page);
      const entry = route.staticPaths?.[i];
      if (entry !== undefined) staticPaths.push(typeof entry === "string" ? [entry] : entry);
    }
    if (render === "static" && pages.length === 0) return;
    claim(routeKeys(pattern, pages, lang), plugin, pattern, true);
    if (render === "dynamic" && route.path.includes("[")) {
      for (const url of contentUrls) {
        if (matchRoute(pattern, url))
          throw new Error(
            `[Fumapress] the content page "${url}" and ${nameOf(plugin)} both take the path "${url}": a path has one route.`,
          );
      }
    }

    out.pages.push({
      path: pattern,
      lang,
      render,
      pages: localizePages(pages, lang),
      options: {},
      plugin,
      view: pages.length === expanded.pages.length ? route : { ...route, staticPaths },
    });
  }

  /** a view without `lang` is created in `langs`, the languages the hook covers */
  const routeFns = (plugin: AnyPlugin, langs: readonly (string | undefined)[]): RouteFns => ({
    createApi: (route) => addApi(plugin, route),
    createView(route) {
      if (route.lang !== undefined) addView(plugin, route, route.lang);
      else for (const lang of langs) addView(plugin, route, lang);
    },
  });

  async function runRoutes(): Promise<ServedRoute[]> {
    // your own pages first: they win over the pages of plugins
    for (const input of inputs) if (!input.plugin) addRuntimeRoute(input);
    for (const input of inputs) if (input.plugin) addRuntimeRoute(input);

    await Promise.all(
      plugins.map((plugin) =>
        routeContext(ctx, source, plugin, (ctx) =>
          Promise.resolve(plugin.routes?.call(ctx, routeFns(plugin, languages))),
        ),
      ),
    );
    return out.pages;
  }

  async function runDeriveRoutes(): Promise<ApiRoute[]> {
    const final = [...out.pages];
    await Promise.all(
      plugins.map((plugin) =>
        routeContext(ctx, source, plugin, (ctx) =>
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
    );

    out.api.sort((a, b) => compareRoutes(a.path, b.path));
    return out.api;
  }

  const pages = runRoutes();
  const api = pages.then(runDeriveRoutes);
  // a read of the page routes doesn't read `api`, whose reads still reject
  api.catch(() => {});
  return { pages, api };
}
