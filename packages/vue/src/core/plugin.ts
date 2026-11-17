import type { Context } from "./context";
import type {
  Awaitable,
  HeadTag,
  LayoutProps,
  Page,
  PageBody,
  PageData,
  StructuredData,
  TOCItem,
  View,
} from "./types";

/** a page of the site: a content page with `page`, otherwise a view of a plugin or a custom page */
export interface PageEnv {
  /** its URL, without the base path */
  pathname: string;
  /** the language of the URL */
  lang: string;
  page?: Page;
}

/** the page a `<head>` is for, with the data of a content page or a view */
export interface HeadEnv extends PageEnv {
  data?: PageData;
}

export type ApiHandler = (
  request: Request,
  env: { params: Record<string, string> },
) => Awaitable<Response>;

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";

/** the value of the param of a route: a string for `[name]`, a list of segments for `[...name]` */
export type StaticPath = string | string[];

export type ApiRoute = {
  /** without the base path; `[name]` matches a segment, `[...name]` the rest */
  path: string;
  /** `static` routes are generated at build time from their `GET` handler @defaultValue "dynamic" */
  render?: "static" | "dynamic";
  /** the values of the param of a `static` route, one generated file each */
  staticPaths?: StaticPath[] | (() => Awaitable<StaticPath[]>);
  /**
   * Makes the route a data route: its `GET` response is the JSON of the value, and the app loads it with `load()`,
   * on the server without a request. `undefined` is a 404.
   */
  data?: (env: { params: Record<string, string> }) => Awaitable<unknown>;
  /**
   * A data route with the same value on every page: the browser fetches it once, where the value of another data
   * route comes with the page that loaded it.
   */
  shared?: boolean;
  /** every method without a handler of its own */
  ALL?: ApiHandler;
} & Partial<Record<HttpMethod, ApiHandler>>;

/**
 * A page of a plugin, outside the content: `view` gives what the theme renders, with the component of its `views`
 * named `type`. Its `path` has no language prefix: the site adds it.
 */
export interface ViewRoute extends Pick<ApiRoute, "path" | "staticPaths"> {
  /** `static` pages are generated at build time, a view reading content follows it @defaultValue "static" */
  render?: "static" | "dynamic";
  /** the data of its pages, like their title; `transformPage` sets it per page */
  data?: Partial<PageData>;
  /** the page at `params`, none for a 404 */
  view: (params: Record<string, string>, env: { lang: string }) => Awaitable<View | undefined>;
}

export interface RouteFns {
  createApi: (route: ApiRoute) => void;
  /** a page of the plugin, in every language of the site, or in `lang` only */
  createView: (route: ViewRoute & { lang?: string }) => void;
}

/** the output of a build */
export interface BuildOutput {
  /** write a file to the public output, `path` is relative to it */
  emitFile: (path: string, content: string | Uint8Array) => void;
  /** the paths generated from the pages and routes of the site, without the base path: not the files hooks emit */
  paths: string[];
  /** request a page of the built site */
  fetch: (request: Request) => Promise<Response>;
}

/**
 * The hooks that render the pages of a content source. A plugin returns `undefined` for a page it doesn't own, and the
 * first result wins. Only `getPageBody` is required to show a page.
 */
export interface ContentHooks {
  getPageBody?: (this: Context, page: Page) => Awaitable<PageBody | undefined>;
  /** the table of contents */
  getPageToc?: (this: Context, page: Page) => Awaitable<TOCItem[] | undefined>;
  /** the page as Markdown, for `llms-full.txt` */
  getPageText?: (this: Context, page: Page) => Awaitable<string | undefined>;
  /** the headings and the text under each, for full text search */
  getPageStructuredData?: (this: Context, page: Page) => Awaitable<StructuredData | undefined>;
  /** when the page last changed: for the sitemap, and `lastModified` of the page data, which the layout shows */
  getPageLastModified?: (this: Context, page: Page) => Awaitable<Date | undefined>;
}

/** options of the Fumadocs content loader a plugin adds, like its `plugins` */
export interface LoaderOptions {
  plugins?: unknown[];
  [key: string]: unknown;
}

/**
 * A plugin of Fumapress: an object with hooks, `this` is the {@link Context} of the site. Everything the site does
 * goes through these hooks, its built-in features too: they are plugins after yours.
 *
 * The hooks have the names and signatures of `@fumapress/core`, so server-side plugins port across runtimes. Where
 * plugins return options (`head`, `layoutProps`, `configureLoader`), the site's own win, then plugins in order.
 */
export interface Plugin extends ContentHooks {
  name: string;
  /** runs before the content loader is created */
  init?: (this: Context) => Awaitable<void>;
  /** adds options to the content loader, `plugins` of every plugin are combined */
  configureLoader?: (this: Context) => Awaitable<LoaderOptions | undefined>;
  /** runs after the content loader is created */
  configure?: (this: Context) => Awaitable<void>;
  /** the API routes and the pages of the plugin, called once */
  routes?: (this: Context, fns: RouteFns) => Awaitable<void>;
  /**
   * Adds to the data of a page sent to the browser: a content page with `env.page`, otherwise a view. A field the
   * page or an earlier plugin has set stays.
   */
  transformPage?: (
    this: Context,
    data: Readonly<PageData>,
    env: PageEnv,
  ) => Awaitable<Partial<PageData> | undefined>;
  head?: (this: Context, env: HeadEnv) => Awaitable<HeadTag[] | undefined>;
  /** the navbar and links of the layouts: the same on every page of a language, so the browser fetches them once */
  layoutProps?: (
    this: Context,
    env: { lang: string },
  ) => Awaitable<Partial<LayoutProps> | undefined>;
  /**
   * Runs first on every request the server receives. Call `next()` to continue, or `next(path)` to serve another path
   * instead. Requests a host serves from the files of the build never reach it.
   */
  middleware?: (
    this: Context,
    request: Request,
    next: (rewrite?: string) => Promise<Response>,
  ) => Promise<Response>;
  /** runs once when the site is built, not on dev or production servers; throw to fail the build */
  build?: (this: Context, output: BuildOutput) => Awaitable<void>;
}

export type PluginOption = Plugin | false | undefined | null | readonly PluginOption[];

/** a plugin of the preset, loaded when the site starts */
export type PresetEntry = () => Awaitable<Plugin>;

export function flatten(options: readonly PluginOption[], out: Plugin[] = []): Plugin[] {
  for (const option of options) {
    if (Array.isArray(option)) flatten(option, out);
    else if (option) out.push(option as Plugin);
  }
  return out;
}
