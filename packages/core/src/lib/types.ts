import type { ConfigContext } from "@/config";
import type { AppContext } from "@/lib/shared";
import type { StructuredData } from "fumadocs-core/mdx-plugins";
import type { TOCItemType } from "fumadocs-core/toc";
import type { ReactNode } from "react";
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

export interface CreatePagesContext<C extends ConfigContext = ConfigContext> extends AppContext<C> {
  /** call this function if the page's route is already created by your plugin */
  markResolved: (page: C["loaderConfig"]["page"]) => void;
}

export interface ServerPlugin<C extends ConfigContext = ConfigContext> {
  /** receive & modify context */
  init?: (this: AppContext<C>) => void;

  createPages?: (this: CreatePagesContext<C>, fns: RouteFns) => Awaitable<void>;
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
