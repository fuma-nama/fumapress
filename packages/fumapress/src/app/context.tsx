import type { ConfigUtils } from "@/config";
import { fumapressTranslations } from "@/i18n";
import type { DocsLayoutContextData } from "@/layouts/docs";
import type { GlassLayoutContextData } from "@/layouts/glass";
import type { HomeLayoutContextData } from "@/layouts/home";
import type { NotebookLayoutContextData } from "@/layouts/notebook";
import type { RootLayoutContextData } from "@/layouts/root";
import type { SpaciousLayoutContextData } from "@/layouts/spacious";
import { joinPaths } from "@/lib/pathname";
import type { Adapter, Awaitable } from "@/lib/types";
import createDeepmerge from "@fastify/deepmerge";
import {
  createPress,
  type AppShape,
  type Context,
  type PageAlternate,
  type PressRuntime,
} from "@fumapress/core";
import type { HeadTag } from "fumadocs-core/framework/plugin";
import { AsyncLocalStorage } from "node:async_hooks";
import { createElement, isValidElement, type ReactNode } from "react";
import { preinit, recommendedPlugins, type PressPlugin } from "./plugin";

export type { AppShape, PageAlternate };

/** the repository of `site.git` */
export interface GitInfo extends Omit<NonNullable<Context["siteConfig"]["git"]>, "rootDir"> {}

type RootMetaInterceptor = (opts: { next: () => ReactNode }) => ReactNode;
type PageMetaInterceptor<C extends AppShape> = (opts: {
  page: C["page"];
  next: () => ReactNode;
}) => ReactNode;

/** can extend from plugins during `init()` */
export interface FumapressHooks<C extends AppShape> extends Pick<
  Context<C>,
  | "getPageToc"
  | "getPageBody"
  | "getPageCreatedAt"
  | "getPageLastModified"
  | "getFileUrl"
  | "getPageAlternates"
  | "absoluteUrl"
> {
  interceptRootMeta: (interceptor: RootMetaInterceptor) => void;
  interceptPageMeta: (interceptor: PageMetaInterceptor<C>) => void;
  /** the head tags of every page, then `meta.root` of the config, await it to render them in order */
  renderRootMeta: () => ReactNode;
  /** the head tags of a content page, then `meta.page` of the config, then the head tags of plugins */
  renderPageMeta: (page: C["page"]) => ReactNode;
}

export interface FumapressLoader<C extends AppShape = AppShape> extends Pick<
  Context<C>,
  "getLoader" | "revalidateLoader" | "invalidateLoader"
> {}

/** the site on Waku, `this` in plugin hooks */
export interface AppContext<S extends AppShape = AppShape> extends Context<S>, FumapressHooks<S> {
  plugins: PressPlugin<S>[];
  adapters: Adapter<S>[];

  /** always `undefined`, easier way to infer types */
  $context: S;

  /**
   * custom data in app context, can be referenced from plugins/pages etc
   */
  data: AppContextData<S> & Record<string | symbol, unknown>;
  renderPage: (opts: { slugs: string[]; lang?: string; page: S["page"] }) => ReactNode;
  renderRoot: (opts: { lang?: string; children: ReactNode }) => ReactNode;
  renderNotFound: (opts: { lang?: string }) => ReactNode;
}

export const appContext = new AsyncLocalStorage({
  name: "fumapress:core",
});

export function getPressContext<C extends AppShape = AppShape>(): AppContext<C> {
  const store = appContext.getStore();

  if (!store)
    throw new Error(
      "[Fumapress] Missing server context for Fumapress, make sure to use the middlewares from createRouter()",
    );

  return store as AppContext<C>;
}

export async function initApp<C extends AppShape>(
  builder: ConfigUtils,
  getFrameworkPages?: PressRuntime["getFrameworkPages"],
): Promise<AppContext<C>> {
  const {
    meta,
    adapters = [],
    plugins = [],
    site,
    mode = "default",
    renderNotFound = (await import("fumadocs-ui/layouts/home/not-found")).DefaultNotFound,
    renderPage = (await import("@/layouts/docs")).createDocsLayoutPage(),
    renderRoot = (await import("@/layouts/root")).createRootLayout(),
    ...config
  } = builder.get();
  const rootMetaInterceptors: RootMetaInterceptor[] = [];
  const pageMetaInterceptors: PageMetaInterceptor<AppShape>[] = [];
  let ctx!: AppContext;

  const members: Omit<AppContext, keyof Context> = {
    $context: undefined as never,
    adapters,
    data: {},
    renderPage,
    renderRoot,
    renderNotFound,
    interceptRootMeta(interceptor) {
      rootMetaInterceptors.push(interceptor);
    },
    interceptPageMeta(interceptor) {
      pageMetaInterceptors.push(interceptor);
    },
    async renderRootMeta() {
      const tags = renderHeadTags(await ctx.getHead({}));
      function next(i: number): ReactNode {
        const interceptor = rootMetaInterceptors[i];
        if (interceptor) return interceptor({ next: () => next(i + 1) });

        return (
          <>
            {tags}
            {meta?.root?.call(ctx)}
          </>
        );
      }

      return <>{next(0)}</>;
    },
    renderPageMeta(page) {
      function next(i: number): ReactNode {
        const interceptor = pageMetaInterceptors[i];
        if (interceptor) return interceptor({ page, next: () => next(i + 1) });

        return <PageMeta page={page} />;
      }

      return next(0);
    },
  };

  // one component, so pages rendered on request stream the tags in order too
  async function PageMeta({ page }: { page: AppShape["page"] }) {
    const [pageHead, head] = await Promise.all([ctx.getPageHead(page), ctx.getHead({ page })]);
    return (
      <>
        {renderHeadTags(pageHead)}
        {meta?.page?.call(ctx, page)}
        {renderHeadTags(head)}
      </>
    );
  }

  const internal: PressPlugin = {
    name: "fumapress",
    // the first plugin, its `init()` gives the context the members of Waku before other plugins see it
    enforce: "pre",
    translations: fumapressTranslations(),
    init() {
      ctx = Object.assign(this, members);
    },
    getPageText(page) {
      return fromAdapters(this, page, (adapter) => adapter["core:get-text"]);
    },
    getPageStructuredData(page) {
      return fromAdapters(this, page, (adapter) => adapter["core:get-structured-data"]);
    },
    getPageBody(page) {
      return fromAdapters(this, page, (adapter) => adapter["core:get-body"]);
    },
    getPageToc(page) {
      return fromAdapters(this, page, (adapter) => adapter["core:render-toc"]);
    },
    getPageCreatedAt(page) {
      return fromAdapters(this, page, (adapter) => adapter["core:get-creation-date"]);
    },
    getPageLastModified(page) {
      return fromAdapters(this, page, (adapter) => adapter["core:get-modified-date"]);
    },
  };

  const finalized = await preinit(plugins);
  await createPress(
    {
      ...config,
      mode,
      site: { ...site, baseUrl: site?.baseUrl ?? defaultBaseUrl() },
      plugins: [internal, ...finalized],
    },
    {
      base: import.meta.env.BASE_URL,
      preset: () => recommendedPlugins(finalized, mode),
      getFrameworkPages,
    },
  );

  return ctx as unknown as AppContext<C>;
}

/** the first value of the adapters, for the page hooks of their `core:` keys */
async function fromAdapters<T>(
  ctx: AppContext,
  page: AppShape["page"],
  get: (
    adapter: Adapter,
  ) => ((this: AppContext, page: AppShape["page"]) => Awaitable<T | undefined>) | undefined,
): Promise<T | undefined> {
  for (const adapter of ctx.adapters) {
    const value = await get(adapter)?.call(ctx, page);
    if (value !== undefined) return value;
  }
}

/** the URL of the site on the development server and on Vercel, without `site.baseUrl` */
function defaultBaseUrl(): string | undefined {
  const platform =
    import.meta.env.FUMAPRESS_PLATFORM === "cloudflare"
      ? " and Cloudflare Workers Builds does not expose the site URL"
      : "";
  console.warn(
    `[Fumapress] "site.baseUrl" is not set${platform}; sitemap and RSS will fall back to relative URLs.`,
  );
  if (import.meta.env.DEV) return joinPaths("http://localhost:3000", import.meta.env.BASE_URL);
  const vercelUrl = import.meta.env.VERCEL_URL;
  if (vercelUrl) return joinPaths(`https://${vercelUrl}`, import.meta.env.BASE_URL);
}

/** React props of the HTML attributes that React names differently */
const reactProps = new Map([
  ["charset", "charSet"],
  ["crossorigin", "crossOrigin"],
  ["fetchpriority", "fetchPriority"],
  ["hreflang", "hrefLang"],
  ["http-equiv", "httpEquiv"],
  ["itemprop", "itemProp"],
  ["nomodule", "noModule"],
  ["referrerpolicy", "referrerPolicy"],
]);

/** head tags as React elements */
export function renderHeadTags(tags: HeadTag[]): ReactNode[] {
  const out: ReactNode[] = [];
  for (const [key, { tag, attrs, children }] of tags.entries()) {
    const props: Record<string, unknown> = { key };
    for (const name in attrs) props[reactProps.get(name) ?? name] = attrs[name];
    if (tag === "title") {
      out.push(createElement(tag, props, children));
      continue;
    }

    // the text of scripts and styles is not escaped
    if (children !== undefined) props.dangerouslySetInnerHTML = { __html: children };
    out.push(createElement(tag, props));
  }
  return out;
}

export const deepmerge = createDeepmerge({
  all: true,
  onlyDefinedProperties: true,
  isMergeableObject(value) {
    if (isValidElement(value)) {
      return false;
    }

    return createDeepmerge.isMergeableObject(value);
  },
});

/** can be extended from other libraries */
export interface AppContextData<S extends AppShape> {
  "core:docs-layout"?: DocsLayoutContextData<S>;
  "core:notebook-layout"?: NotebookLayoutContextData<S>;
  "core:glass-layout"?: GlassLayoutContextData<S>;
  "core:spacious-layout"?: SpaciousLayoutContextData<S>;
  "core:home-layout"?: HomeLayoutContextData<S>;
  "core:provider"?: RootLayoutContextData<S>;
}
