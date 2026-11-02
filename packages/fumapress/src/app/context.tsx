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
import { createPress, type AppShape, type Context, type PageAlternate } from "@fumapress/core";
import type { HeadTag } from "fumadocs-core/framework/plugin";
import { AsyncLocalStorage } from "node:async_hooks";
import { createElement, isValidElement, type ReactNode } from "react";
import { preinitPlugins, recommendedPlugins, type PressPlugin } from "./plugin";

export type { AppShape, PageAlternate };

/** the repository of `site.git` */
export type GitInfo = Omit<NonNullable<Context["siteConfig"]["git"]>, "rootDir">;

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
  /** the head tags of every page, then `meta.root` of the config */
  renderRootMeta: () => ReactNode;
  /** the head tags of a content page, then `meta.page` of the config */
  renderPageMeta: (page: C["page"]) => ReactNode;
}

export type FumapressLoader<C extends AppShape = AppShape> = Pick<
  Context<C>,
  "getLoader" | "revalidateLoader" | "invalidateLoader"
>;

/** the site on Waku, `this` in plugin hooks */
export interface AppContext<S extends AppShape = AppShape> extends Context<S>, FumapressHooks<S> {
  plugins: readonly PressPlugin[];
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

export async function initApp<C extends AppShape>(builder: ConfigUtils): Promise<AppContext<C>> {
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
    renderRootMeta() {
      function next(i: number): ReactNode {
        const interceptor = rootMetaInterceptors[i];
        if (interceptor) return interceptor({ next: () => next(i + 1) });

        return (
          <>
            <HeadTags />
            {meta?.root?.call(ctx)}
          </>
        );
      }

      return next(0);
    },
    renderPageMeta(page) {
      function next(i: number): ReactNode {
        const interceptor = pageMetaInterceptors[i];
        if (interceptor) return interceptor({ page, next: () => next(i + 1) });

        return (
          <>
            <HeadTags page={page} />
            {meta?.page?.call(ctx, page)}
          </>
        );
      }

      return next(0);
    },
  };

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

  const resolved = await preinitPlugins(plugins);
  await createPress(
    {
      ...config,
      mode,
      site: { ...site, baseUrl: site?.baseUrl ?? defaultBaseUrl() },
      plugins: [internal, ...resolved],
    },
    { base: import.meta.env.BASE_URL, preset: () => recommendedPlugins(mode, resolved) },
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

/** the head tags of every page, of a content page with `page` */
async function HeadTags({ page }: { page?: AppShape["page"] }) {
  return renderHeadTags(await getPressContext().getHead({ page }));
}

/** `hreflang` alternate of the page at `pathname` in `locale` */
export function pageAlternate<C extends AppShape>(
  ctx: Context<C>,
  locale: string,
  pathname: string,
): PageAlternate {
  return {
    locale,
    hreflang: ctx.siteConfig.hreflang?.[locale] ?? locale,
    href: ctx.absoluteUrl(pathname),
  };
}

/**
 * canonical and `og:url` of the page of `createPage()` at `pathname` (only with `site.baseUrl`),
 * `hreflang` links of its `alternates`
 */
export function pageLinks<C extends AppShape>(
  ctx: Context<C>,
  pathname: string,
  alternates: PageAlternate[],
): HeadTag[] {
  const tags: HeadTag[] = [];
  if (ctx.siteConfig.baseUrl) {
    const href = ctx.absoluteUrl(pathname);
    tags.push(
      { tag: "link", attrs: { rel: "canonical", href } },
      { tag: "meta", attrs: { property: "og:url", content: href } },
    );
  }

  for (const { hreflang, href } of alternates)
    tags.push({ tag: "link", attrs: { rel: "alternate", hreflang, href } });
  const xDefault =
    alternates.find((item) => item.locale === ctx.i18nConfig?.defaultLanguage) ?? alternates[0];
  if (xDefault)
    tags.push({
      tag: "link",
      attrs: { rel: "alternate", hreflang: "x-default", href: xDefault.href },
    });
  return tags;
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
