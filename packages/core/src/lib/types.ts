import type { ConfigContext } from "@/config";
import type { DocsLayoutContextData } from "@/layouts/docs";
import type { HomeLayoutContextData } from "@/layouts/home";
import type { NotebookLayoutContextData } from "@/layouts/notebook";
import type { RootLayoutContextData } from "@/layouts/root";
import type { AppContext } from "@/lib/shared";
import type { I18nConfig } from "fumadocs-core/i18n";
import type { StructuredData } from "fumadocs-core/mdx-plugins";
import type { ContentStorage, LoaderOptions, LoaderPluginOption, Page } from "fumadocs-core/source";
import type { TOCItemType } from "fumadocs-core/toc";
import type { MiddlewareHandler } from "hono";
import type { ReactNode } from "react";
import { unstable_createServerEntryAdapter } from "waku/adapter-builders";
import type {
  createPages,
  CreatePage,
  CreateLayout,
  CreateRoot,
  CreateApi,
  CreateSlice,
} from "waku/router/server";

export type Awaitable<T> = T | Promise<T>;

/** allow content sources to implement interfaces for pages, instead of requiring consumers to specify manually */
export interface Adapter<C extends ConfigContext = ConfigContext> {
  "core:get-text"?: (this: AppContext<C>, page: C["page"]) => Awaitable<string | undefined>;
  "core:get-structured-data"?: (
    this: AppContext<C>,
    page: C["page"],
  ) => Awaitable<StructuredData | undefined>;
  "core:render-body"?: (this: AppContext<C>, page: C["page"]) => Awaitable<ReactNode>;
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

export interface ServerPlugin<C extends ConfigContext = ConfigContext> {
  name?: string;

  /** force change the order of plugin */
  enforce?: "pre" | "post";

  /** receive & modify context */
  init?: (this: AppContext<C>) => Awaitable<void>;

  createPages?: (this: AppContext<C>, fns: RouteFns) => Awaitable<void>;

  /**
   * Resolve the given page before passing to the page renderer:
   *
   * - `object`: replace the page object.
   * - `false`: render not found (will also exclude from static pre-rendering).
   * - `undefined`: fallback to default.
   */
  resolvePage?: (this: AppContext<C>, page: C["page"]) => Awaitable<C["page"] | false | undefined>;

  /**
   * Override the page renderer, use default fallback if `undefined` is returned.
   */
  renderPage?: (
    this: AppContext<C>,
    env: { page: C["page"]; fallback: ReactNode; lang?: string; slugs: string[] },
  ) => Awaitable<ReactNode>;

  /** resolve content loader options */
  configureLoader?: (
    this: AppContext<C>,
    options: PressLoaderOptions,
  ) => Awaitable<PressLoaderOptions>;

  /** create Hono middlewares */
  createMiddlewares?: (this: AppContext<C>) => Awaitable<MiddlewareHandler[] | undefined>;

  unstable_onSSGRequest?: <T>(req: Request, next: () => T) => T;
  unstable_onServerEntry?: (
    entry: ReturnType<ReturnType<typeof unstable_createServerEntryAdapter>>,
  ) => ReturnType<ReturnType<typeof unstable_createServerEntryAdapter>>;
}

export interface BaseRouteFns {
  createPage: CreatePage;
  createLayout: CreateLayout;
  createRoot: CreateRoot;
  createApi: CreateApi;
  createSlice: CreateSlice;
}

export type CreatePagesResult = ReturnType<typeof createPages>;

export interface RouteFns extends BaseRouteFns {
  createApiIsomorphic: (config: {
    render: "static" | "dynamic";
    path: string;
    staticPaths?: string[] | string[][];
    handler: (
      req: Request,
      ctx: { params: Record<string, string | string[]> },
    ) => Promise<Response>;
  }) => void;

  /** access `createPages()` output */
  unstable_getCreated: () => CreatePagesResult;
}

export type ServerPluginOption<C extends ConfigContext = ConfigContext> =
  | ServerPlugin<C>
  | false
  | undefined
  | null
  | ServerPluginOption<C>[];

/** can be extended from other libraries */
export interface AppContextData {
  "core:page-meta"?: ((page: Page) => ReactNode)[];
  "core:notebook-layout"?: NotebookLayoutContextData;
  "core:docs-layout"?: DocsLayoutContextData;
  "core:home-layout"?: HomeLayoutContextData;
  "core:provider"?: RootLayoutContextData;
}

/**
 * For file-system router, route files can export a `getConfig()` function that returns a `RouteConfig` object.
 */
export interface RouteConfig {
  render?: "static" | "dynamic";

  /**
   * automatically insert `/[lang]` route segment if i18n is configured, only applicable for pages & layouts.
   *
   * @default true
   */
  autoI18n?: boolean;
}
