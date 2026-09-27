import type { AppContext, AppShape } from "@/app/context";
import type { TakumiRouteOptions } from "@/plugins/takumi";
import type { I18nConfig } from "fumadocs-core/i18n";
import type { StructuredData } from "fumadocs-core/mdx-plugins";
import type { ContentStorage, LoaderOptions, LoaderPluginOption } from "fumadocs-core/source";
import type { TOCItemType } from "fumadocs-core/toc";
import type { FC, ReactNode } from "react";
import type { CreateRoot, CreateApi, CreateSlice, CreateInterceptor } from "waku/router/server";
import type { RouteParams } from "./routes";

export type Awaitable<T> = T | Promise<T>;

/** allow content sources to implement interfaces for pages, instead of requiring consumers to specify manually */
export interface Adapter<C extends AppShape = AppShape> {
  "core:get-text"?: (this: AppContext<C>, page: C["page"]) => Awaitable<string | undefined>;
  "core:get-structured-data"?: (
    this: AppContext<C>,
    page: C["page"],
  ) => Awaitable<StructuredData | undefined>;
  "core:get-body"?: (
    this: AppContext<C>,
    page: C["page"],
  ) => Awaitable<
    | {
        node: ReactNode;
      }
    | undefined
  >;
  "core:render-toc"?: (
    this: AppContext<C>,
    page: C["page"],
  ) => Awaitable<TOCItemType[] | undefined>;

  "core:get-creation-date"?: (this: AppContext<C>, page: C["page"]) => Awaitable<Date | undefined>;
  "core:get-modified-date"?: (this: AppContext<C>, page: C["page"]) => Awaitable<Date | undefined>;

  "blog:get-tags"?: (this: AppContext<C>, page: C["page"]) => Awaitable<string[] | undefined>;
  /** author ids of a blog post */
  "blog:get-authors"?: (this: AppContext<C>, page: C["page"]) => Awaitable<string[] | undefined>;
  /** cover image URL of a blog post */
  "blog:get-image"?: (this: AppContext<C>, page: C["page"]) => Awaitable<string | undefined>;
}

/** make plugins an array for easier modification */
export interface PressLoaderOptions<
  S extends ContentStorage = ContentStorage,
  I18n extends I18nConfig | undefined = I18nConfig | undefined,
> extends Omit<LoaderOptions<S, I18n>, "plugins"> {
  plugins?: LoaderPluginOption[];
}

export interface RouteFns {
  createPage: (page: PageOptions) => void;

  createLayout: (
    layout: Pick<PageOptions, "path" | "lang" | "component" | "render" | "unstable_sourceFile">,
  ) => void;

  createApiIsomorphic: (config: {
    /** defaults to the render mode of pages */
    render?: "static" | "dynamic";
    path: string;
    staticPaths?: string[] | string[][];
    handler: (req: Request, ctx: { params: RouteParams }) => Promise<Response>;
    /** source file of the route, files only used by static routes are pruned from the server bundle */
    unstable_sourceFile?: string;
  }) => void;

  /** the pages of `createPage()` so far, complete in `configureRoutes()` */
  getRoutes: () => PressRoute[];

  createRoot: CreateRoot;
  createApi: CreateApi;
  createSlice: CreateSlice;
  createInterceptor: CreateInterceptor;
}

/** options of `createPage()` */
export interface PageOptions extends Omit<RouteConfig, "autoI18n"> {
  /** pathname without language prefix */
  path: string;
  /** the language of the page, its copies in other languages share the `path` */
  lang?: string;
  component: FC<never>;
  /** match `path` literally, for paths with brackets */
  exactPath?: boolean;
  /** source file of the route, files only used by static routes are pruned from the server bundle */
  unstable_sourceFile?: string;
}

/** props of a page component: the route params, the `path` it renders at and the `lang` of the copy */
export interface RouteProps {
  path: string;
  lang?: string;
  [param: string]: string | string[] | undefined;
}

/** a page of `createPage()`, as the router registered it */
export interface PressRoute extends Omit<PageOptions, "render"> {
  render: "static" | "dynamic";
  /** URL pattern of the page, with its language prefix and without route groups */
  path: string;
  /** head tags rendered with the page, in order */
  meta: ((props: RouteProps) => ReactNode)[];
  /** the pages of a static route, or the ones a dynamic route lists in `staticPaths` */
  pages: {
    /** URL path */
    path: string;
    params: RouteParams;
    /** the page in every language it exists in, itself included */
    translations: { locale: string; path: string }[];
  }[];
}

/**
 * Options of a route: the `getConfig()` of a route file, or `createPage()` and `createLayout()` of
 * plugins. Plugins read their own options from it, like `takumiOptions`, extend it with declaration
 * merging.
 */
export interface RouteConfig {
  render?: "static" | "dynamic";

  /** static paths of a static page with slugs, shared by every language of `autoI18n` */
  staticPaths?: string[] | string[][];

  /**
   * register the page (or layout) once per language if i18n is configured, under the language prefix and with a `lang` prop.
   * Otherwise, it is registered once without prefix, and rendered as the default language.
   *
   * @default true
   */
  autoI18n?: boolean;

  /**
   * Open Graph image of the page, only read by the Takumi plugin (`fumapress/plugins/takumi`).
   *
   * The image is prerendered next to a static page as `<path>.webp`, or rendered on request for a dynamic page, and the `og:image` meta tags are added to the page.
   */
  takumiOptions?: TakumiRouteOptions;
}
