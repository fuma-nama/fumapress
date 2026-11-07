"use client";
import { type ComponentType, createContext, lazy, type ReactNode, use, useMemo } from "react";
import type { TOCItemType } from "fumadocs-core/toc";
import type * as PageTree from "fumadocs-core/page-tree";
import * as DocsLayout from "fumadocs-ui/layouts/docs";
import * as DocsPage from "fumadocs-ui/layouts/docs/page";
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import type { DocsLayoutProps } from "fumadocs-ui/layouts/docs";
import type { DocsPageData } from "../plugin";
import type { DefaultPageProps, DefaultUIOptions } from "../press";

/** the props every Fumadocs docs layout takes: its base options and the AI chat */
export type SharedLayoutProps = BaseLayoutProps & Pick<DocsLayoutProps, "aiChat">;

const LayoutPropsContext = createContext<SharedLayoutProps>({});

/**
 * Layout props for the layouts below, from client state like the open state of a chat: the built-in UI applies them, and
 * a custom layout reads them with `useLayoutProps()`. A provider inside another adds to its props.
 */
export function LayoutPropsProvider({
  value,
  children,
}: {
  value: SharedLayoutProps;
  children: ReactNode;
}) {
  const parent = use(LayoutPropsContext);
  const merged = useMemo(() => ({ ...parent, ...value }), [parent, value]);
  return <LayoutPropsContext value={merged}>{children}</LayoutPropsContext>;
}

/** the props of every `LayoutPropsProvider` above, for any Fumadocs docs layout */
export function useLayoutProps(): SharedLayoutProps {
  return use(LayoutPropsContext);
}

export interface DefaultDocsProps extends Pick<DefaultPageProps, "tree" | "baseOptions"> {
  /** the Fumadocs layout */
  layout?: DefaultUIOptions["layout"];
  /** over the layout props of `baseOptions`, `tree` and `useLayoutProps()`, typed by `layout` in `renderDefault()` */
  layoutProps?: object;
  /** over the page props of `pageData`, typed by `layout` in `renderDefault()` */
  pageProps?: object;
  pageData: DocsPageData;
  /** the items of the `actions` slot */
  actions: ReactNode;
  /** the items of the `footer` slot */
  footer: ReactNode;
  /** the body */
  children: ReactNode;
}

/** the components of a Fumadocs docs layout that the built-in UI renders */
interface LayoutModules {
  layout: {
    DocsLayout: ComponentType<SharedLayoutProps & { tree: PageTree.Root; children: ReactNode }>;
  };
  page: {
    DocsPage: ComponentType<{ toc?: TOCItemType[]; full?: boolean; children: ReactNode }>;
    DocsTitle: ComponentType<{ children: ReactNode }>;
    DocsDescription: ComponentType<{ className?: string; children: ReactNode }>;
    DocsBody: ComponentType<{ children: ReactNode }>;
    PageLastUpdate: ComponentType<{ date: Date }>;
  };
}

type DefaultDocsLayoutProps = Omit<DefaultDocsProps, "layout">;

function createDocs({ layout: { DocsLayout }, page }: LayoutModules) {
  return function Docs({
    layoutProps,
    pageProps,
    tree,
    baseOptions,
    pageData,
    actions,
    footer,
    children,
  }: DefaultDocsLayoutProps) {
    return (
      <DocsLayout {...baseOptions} tree={tree} {...useLayoutProps()} {...layoutProps}>
        <page.DocsPage toc={pageData.toc} full={pageData.full} {...pageProps}>
          <page.DocsTitle>{pageData.title}</page.DocsTitle>
          <page.DocsDescription className="mb-0">{pageData.description}</page.DocsDescription>
          <div className="flex flex-row gap-2 items-center border-b pt-2 pb-6">{actions}</div>
          <page.DocsBody>{children}</page.DocsBody>
          {pageData.lastModified && <page.PageLastUpdate date={pageData.lastModified} />}
          {footer}
        </page.DocsPage>
      </DocsLayout>
    );
  };
}

/** loads a layout when a page uses it, the others stay out of the page's JavaScript */
function lazyDocs(
  layout: () => Promise<LayoutModules["layout"]>,
  page: () => Promise<LayoutModules["page"]>,
) {
  return lazy(async () => {
    const [layoutModule, pageModule] = await Promise.all([layout(), page()]);
    return { default: createDocs({ layout: layoutModule, page: pageModule }) };
  });
}

const layouts: Record<
  NonNullable<DefaultDocsProps["layout"]>,
  ComponentType<DefaultDocsLayoutProps>
> = {
  docs: createDocs({ layout: DocsLayout, page: DocsPage }),
  notebook: lazyDocs(
    () => import("fumadocs-ui/layouts/notebook"),
    () => import("fumadocs-ui/layouts/notebook/page"),
  ),
  glass: lazyDocs(
    () => import("fumadocs-ui/layouts/glass"),
    () => import("fumadocs-ui/layouts/glass/page"),
  ),
  spacious: lazyDocs(
    () => import("fumadocs-ui/layouts/spacious"),
    () => import("fumadocs-ui/layouts/spacious/page"),
  ),
  flux: lazyDocs(
    () => import("fumadocs-ui/layouts/flux"),
    () => import("fumadocs-ui/layouts/flux/page"),
  ),
};

/** the Fumadocs docs layout and page of a content page */
export function DefaultDocs({ layout = "docs", ...props }: DefaultDocsProps) {
  const Docs = layouts[layout];
  return <Docs {...props} />;
}
