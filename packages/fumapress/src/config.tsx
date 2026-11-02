import { getPressContext, type AppContext } from "./app/context";
import type { _Internal } from "fumadocs-core/source";
import type { Adapter } from "@/lib/types";
import type { FC, ReactNode } from "react";
import type { PressPluginOption } from "./app/plugin";
import type { InferAppShape, PressConfig } from "@fumapress/core";

export type { BuildMode } from "fumadocs-core/framework/plugin";
export type { SiteConfig } from "@fumapress/core";

export interface FumapressConfig<
  I extends _Internal.AnyInput = _Internal.AnyInput,
  Lang extends string | undefined = string | undefined,
> extends Omit<PressConfig<I, Lang>, "plugins"> {
  meta?: {
    /** render meta tags for any pages */
    root?: (this: AppContext<InferAppShape<I, Lang>>) => ReactNode;

    /** render meta tags for page */
    page?: (
      this: AppContext<InferAppShape<I, Lang>>,
      page: InferAppShape<I, Lang>["page"],
    ) => ReactNode;
  };

  renderRoot?: (
    this: AppContext<InferAppShape<I, Lang>>,
    opts: { lang?: string; children: ReactNode },
  ) => ReactNode;

  renderPage?: (
    this: AppContext<InferAppShape<I, Lang>>,
    opts: { lang?: string; slugs: string[]; page: InferAppShape<I, Lang>["page"] },
  ) => ReactNode;

  renderNotFound?: (this: AppContext<InferAppShape<I, Lang>>, opts: { lang?: string }) => ReactNode;

  adapters?: Adapter<InferAppShape<I, Lang>>[];
  plugins?: PressPluginOption<InferAppShape<I, Lang>>[];
}

export interface ConfigUtils<
  I extends _Internal.AnyInput = _Internal.AnyInput,
  Lang extends string | undefined = string | undefined,
> {
  /** for type inference only, always `undefined` */
  $context: InferAppShape<I, Lang>;
  get: () => FumapressConfig<I, Lang>;

  utils: () => {
    getPressContext: () => AppContext<InferAppShape<I, Lang>>;
  };

  /** @deprecated use top-level `renderRoot`, `renderPage`, and `renderNotFound` instead */
  layouts: (options: {
    root?: FC<{ lang?: string; children: ReactNode }>;
    page?: FC<{
      lang?: string;
      slugs: string[];
      page: InferAppShape<I, Lang>["page"];
    }>;
    notFound?: FC<{ lang?: string }>;

    /**
     * Define default props for all Fumadocs layouts, will be deep-merged with current props.
     */
    defaultProps?: Extract<
      FumapressConfig<I, Lang>["defaultLayoutProps"],
      (...args: never[]) => unknown
    >;
  }) => ConfigUtils<I, Lang>;
  plugins: (...plugins: PressPluginOption<InferAppShape<I, Lang>>[]) => ConfigUtils<I, Lang>;
  adapters: (...adapters: Adapter<InferAppShape<I, Lang>>[]) => ConfigUtils<I, Lang>;
}

export function defineConfig<
  I extends _Internal.AnyInput,
  Lang extends string | undefined = undefined,
>(config: FumapressConfig<I, Lang>): ConfigUtils<I, Lang> {
  return {
    $context: undefined as never,
    get() {
      return config;
    },
    utils() {
      return {
        getPressContext() {
          return getPressContext<InferAppShape<I, Lang>>();
        },
      };
    },
    layouts({ defaultProps, notFound: NotFound, page: Page, root: Root }) {
      if (defaultProps) config.defaultLayoutProps = defaultProps;
      if (NotFound) config.renderNotFound = (props) => <NotFound {...props} />;
      if (Page) config.renderPage = (props) => <Page {...props} />;
      if (Root) config.renderRoot = (props) => <Root {...props} />;
      return this;
    },
    plugins(...plugins) {
      config.plugins ??= [];
      config.plugins.push(...plugins);
      return this;
    },
    adapters(...adapters) {
      config.adapters ??= [];
      config.adapters.push(...adapters);
      return this;
    },
  };
}
