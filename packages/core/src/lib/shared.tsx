import type { BuildMode, Config, ConfigContext, I18nConfig } from "@/config";
import { getGitRootDir } from "./fs";
import path from "node:path";
import type { LoaderOutput, Page } from "fumadocs-core/source";
import type { Awaitable, Adapter, ServerPlugin } from "./types";
import type { DocsLayoutContextData } from "@/layouts/docs";
import { ComponentType, Fragment, type ReactNode } from "react";
import type { HomeLayoutContextData } from "@/layouts/home";
import { fumadocsMdx } from "@/adapters/mdx";
import type { RootProviderProps } from "fumadocs-ui/provider/waku";
import type { NotebookLayoutContextData } from "@/layouts/notebook";

export interface AppContext<C extends ConfigContext = ConfigContext> {
  mode: BuildMode;
  getLoader: () => Awaitable<LoaderOutput<C["loaderConfig"]>>;
  plugins: ServerPlugin<C>[];
  adapters: Adapter<C>[];

  /** always `undefined`, easier way to infer types */
  $context: C;

  /**
   * custom data in app context, can be referenced from plugins/pages etc
   */
  data: AppContextData & Record<string, unknown>;

  i18nConfig?: I18nConfig<C["lang"]>;
  metaConfig?: Config<C>["meta"];
  siteConfig: {
    name: string;
    baseUrl?: string;
    git?: {
      user: string;
      repo: string;
      branch: string;
      rootDir: string;
    };
  };
}

export interface AppContextData {
  "core:page-meta"?: ((page: Page) => ReactNode)[];
  "core:notebook-layout"?: NotebookLayoutContextData;
  "core:docs-layout"?: DocsLayoutContextData;
  "core:home-layout"?: HomeLayoutContextData;
  "core:provider"?: ((props: RootProviderProps) => Awaitable<RootProviderProps>)[];
}

export function parseConfig<C extends ConfigContext>(config: Config<C>): AppContext<C> {
  return {
    getLoader() {
      if (typeof config.loader === "function") return config.loader();

      return config.loader;
    },
    plugins: (config.plugins ?? []) as never,
    adapters: (config.adapters ?? [fumadocsMdx()]) as never,
    $context: undefined as never,
    data: {},
    i18nConfig: config.i18n,
    mode: config.mode ?? "default",
    metaConfig: config.meta as Config<C>["meta"],
    siteConfig: {
      name: config.site?.name ?? "Fumapress",
      baseUrl: config.site?.baseUrl,
      git: config.site?.git
        ? {
            ...config.site.git,
            rootDir: config.site.git.rootDir ?? getGitRootDir() ?? process.cwd(),
          }
        : undefined,
    },
  };
}

export function renderRootMeta<C extends ConfigContext>(context: AppContext<C>): ReactNode {
  return context.metaConfig?.root?.call(context);
}

export function renderPageMeta<C extends ConfigContext>(
  page: C["loaderConfig"]["page"],
  context: AppContext<C>,
): ReactNode {
  return (
    <>
      <title>{page.data.title}</title>
      <meta property="og:title" content={page.data.title} />
      {page.data.description && <meta property="og:description" content={page.data.description} />}
      {context.metaConfig?.page?.call(context, page)}
      {context.data["core:page-meta"]?.map((hook, i) => (
        <Fragment key={i}>{hook(page)}</Fragment>
      ))}
    </>
  );
}

export function getGitHubFileUrl<C extends ConfigContext>(
  ctx: AppContext<C>,
  absolutePath: string,
): string | undefined {
  const { git } = ctx.siteConfig;
  if (!git) return;

  const p = path.relative(git.rootDir, absolutePath).replaceAll(path.sep, "/");
  if (p.startsWith("../")) return;

  return `https://github.com/${git.user}/${git.repo}/blob/${git.branch}/${p}`;
}

export type TransformChildren<T> = Omit<T, "children"> & {
  children?: ((nodes: ReactNode) => ReactNode)[];
};

export function TransformChildrenSlot<T>({
  Comp,
  props,
  children,
}: {
  Comp: ComponentType<Omit<T, "children"> & { children: ReactNode }>;
  props: TransformChildren<T>;
  children: ReactNode;
}) {
  if (props.children) {
    for (const transformer of props.children) {
      children = transformer(children);
    }
  }

  return <Comp {...props}>{children}</Comp>;
}
