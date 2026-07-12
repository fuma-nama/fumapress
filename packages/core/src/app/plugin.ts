import type { Awaitable, RouteFns, PressLoaderOptions } from "@/lib/types";
import type { Hono, MiddlewareHandler } from "hono";
import type { ReactNode } from "react";
import type { unstable_createServerEntryAdapter } from "waku/adapter-builders";
import type { AppContext, AppShape } from "./context";

export interface PressPlugin<C extends AppShape = AppShape> {
  name?: string;

  /** force change the order of plugin */
  enforce?: "pre" | "post";

  /** initialize context */
  init?: (this: AppContext<C>) => Awaitable<void>;

  /** receive & modify context */
  configure?: (this: AppContext<C>) => Awaitable<void>;

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
  createMiddlewares?: (
    this: AppContext<C>,
    env: { app: Hono },
  ) => Awaitable<MiddlewareHandler[] | undefined>;

  unstable_onServerEntry?: (
    entry: ReturnType<ReturnType<typeof unstable_createServerEntryAdapter>>,
  ) => ReturnType<ReturnType<typeof unstable_createServerEntryAdapter>>;
}

export type PressPluginOption<C extends AppShape = AppShape> =
  | PressPlugin<C>
  | false
  | undefined
  | null
  | PressPluginOption<C>[];
