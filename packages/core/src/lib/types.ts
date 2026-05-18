import type { ConfigContext } from "@/config";
import type { DocsLayoutContextData } from "@/layouts/docs";
import type { HomeLayoutContextData } from "@/layouts/home";
import type { NotebookLayoutContextData } from "@/layouts/notebook";
import type { AppContext } from "@/lib/shared";
import type { StructuredData } from "fumadocs-core/mdx-plugins";
import type { Page } from "fumadocs-core/source";
import type { TOCItemType } from "fumadocs-core/toc";
import type { RootProviderProps } from "fumadocs-ui/provider/base";
import type { ReactElement, ReactNode } from "react";
import type {
  CreatePage,
  CreateLayout,
  CreateRoot,
  CreateApi,
  CreateSlice,
} from "waku/router/server";

export type Awaitable<T> = T | Promise<T>;

/** allow content sources to implement interfaces for pages, instead of requiring consumers to specify manually */
export interface Adapter<C extends ConfigContext = ConfigContext> {
  "core:get-text"?: (
    this: AppContext<C>,
    page: C["loaderConfig"]["page"],
  ) => Awaitable<string | undefined>;
  "core:get-structured-data"?: (
    this: AppContext<C>,
    page: C["loaderConfig"]["page"],
  ) => Awaitable<StructuredData | undefined>;
  "core:render-body"?: (
    this: AppContext<C>,
    page: C["loaderConfig"]["page"],
  ) => Awaitable<ReactNode>;
  "core:render-toc"?: (
    this: AppContext<C>,
    page: C["loaderConfig"]["page"],
  ) => Awaitable<TOCItemType[] | undefined>;

  "core:get-creation-date"?: (
    this: AppContext<C>,
    page: C["loaderConfig"]["page"],
  ) => Awaitable<Date | undefined>;
  "core:get-modified-date"?: (
    this: AppContext<C>,
    page: C["loaderConfig"]["page"],
  ) => Awaitable<Date | undefined>;

  "blog:get-tags"?: (
    this: AppContext<C>,
    page: C["loaderConfig"]["page"],
  ) => Awaitable<string[] | undefined>;
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
  resolvePage?: (
    this: AppContext<C>,
    page: C["loaderConfig"]["page"],
  ) => Awaitable<C["loaderConfig"]["page"] | false | undefined>;
}

export interface BaseRouteFns {
  createPage: CreatePage;
  createLayout: CreateLayout;
  createRoot: CreateRoot;
  createApi: CreateApi;
  createSlice: CreateSlice;
}

export interface RouteFns extends BaseRouteFns {
  createApiIsomorphic: (config: {
    render: "static" | "dynamic";
    path: string;
    staticPaths?: string[][];
    handler: (
      req: Request,
      ctx: { params: Record<string, string | string[]> },
    ) => Promise<Response>;
  }) => void;
}

export type ServerPluginOption<C extends ConfigContext = ConfigContext> =
  | ServerPlugin<C>
  | ServerPluginOption<C>[];

/** can be extended from other libraries */
export interface AppContextData {
  "core:page-meta"?: ((page: Page) => ReactNode)[];
  "core:notebook-layout"?: NotebookLayoutContextData;
  "core:docs-layout"?: DocsLayoutContextData;
  "core:home-layout"?: HomeLayoutContextData;
  "core:provider"?: ((props: RootProviderProps) => Awaitable<RootProviderProps>)[];
}
