import type { AppContext, AppShape } from "@/app/context";
import type { I18nConfig } from "fumadocs-core/i18n";
import type { StructuredData } from "fumadocs-core/mdx-plugins";
import type { ContentStorage, LoaderOptions, LoaderPluginOption } from "fumadocs-core/source";
import type { TOCItemType } from "fumadocs-core/toc";
import type { ReactNode } from "react";
import type {
  createPages,
  CreatePage,
  CreateLayout,
  CreateRoot,
  CreateApi,
  CreateSlice,
  CreateInterceptor,
} from "waku/router/server";

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
}

/** make plugins an array for easier modification */
export interface PressLoaderOptions<
  S extends ContentStorage = ContentStorage,
  I18n extends I18nConfig | undefined = I18nConfig | undefined,
> extends Omit<LoaderOptions<S, I18n>, "plugins"> {
  plugins?: LoaderPluginOption[];
}

export interface BaseRouteFns {
  createPage: CreatePage;
  createLayout: CreateLayout;
  createRoot: CreateRoot;
  createApi: CreateApi;
  createSlice: CreateSlice;
  createInterceptor: CreateInterceptor;
}

export interface RouteFns extends BaseRouteFns {
  createApiIsomorphic: (config: {
    render: "static" | "dynamic";
    path: string;
    staticPaths?: string[] | string[][];
    handler: (
      req: Request,
      ctx: { params: Record<string, string | string[]> },
    ) => Promise<Response>;
    /** source file of the route, files only used by static routes are pruned from the server bundle */
    unstable_sourceFile?: string;
  }) => void;

  /** access `createPages()` output */
  unstable_getCreated: () => ReturnType<typeof createPages>;
}

/**
 * For file-system router, route files can export a `getConfig()` function that returns a `RouteConfig` object.
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
}
