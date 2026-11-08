"use client";
import { type ComponentType, createContext, lazy, type ReactNode, use, useMemo } from "react";
import type { TOCItemType } from "fumadocs-core/toc";
import type * as PageTree from "fumadocs-core/page-tree";
import * as DocsLayout from "fumadocs-ui/layouts/docs";
import * as DocsPage from "fumadocs-ui/layouts/docs/page";
import type { SlotRegion } from "../plugin";
import {
  mergeOptions,
  type DefaultPageProps,
  type DefaultUIOptions,
  type SharedLayoutProps,
} from "../press";

const LayoutPropsContext = createContext<SharedLayoutProps>({});

/**
 * Layout props for the layouts below, from client state like the open state of a chat: the built-in UI merges them over
 * `props.layoutProps`, and a custom layout reads them with `useLayoutProps()`. A provider inside another merges over its props.
 */
export function LayoutPropsProvider({
  value,
  children,
}: {
  value: SharedLayoutProps;
  children: ReactNode;
}) {
  const parent = use(LayoutPropsContext);
  const merged = useMemo(() => mergeOptions<SharedLayoutProps>([value, parent]), [parent, value]);
  return <LayoutPropsContext value={merged}>{children}</LayoutPropsContext>;
}

/** the props of every `LayoutPropsProvider` above, for any Fumadocs docs layout */
export function useLayoutProps(): SharedLayoutProps {
  return use(LayoutPropsContext);
}

export interface DefaultDocsProps extends Pick<DefaultPageProps, "layoutProps" | "pageData"> {
  /** the Fumadocs layout */
  layout?: DefaultUIOptions["layout"];
  /** the options of `renderDefault()` over the props of the layout and page, typed by `layout` there */
  options: { layoutProps?: object; pageProps?: object };
  toc: TOCItemType[];
  /** the items of each region */
  regions: Partial<Record<SlotRegion, ReactNode>>;
  /** the body */
  children: ReactNode;
}

/** the components of a Fumadocs docs layout that the built-in UI renders */
interface LayoutModules {
  layout: {
    DocsLayout: ComponentType<SharedLayoutProps & { tree: PageTree.Root; children: ReactNode }>;
  };
  page: {
    DocsPage: ComponentType<{
      toc?: TOCItemType[];
      full?: boolean;
      tableOfContent?: { header?: ReactNode; footer?: ReactNode };
      children: ReactNode;
    }>;
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
    options,
    pageData,
    toc,
    regions,
    children,
  }: DefaultDocsLayoutProps) {
    const client = useLayoutProps();
    // the page tree is kept as it is, merging copies objects
    const { tree, ...server } = layoutProps;
    const { actions, footer } = regions;
    const sidebar = {
      sidebar: { banner: regions["sidebar-banner"], footer: regions["sidebar-footer"] },
    };
    const tableOfContent = {
      tableOfContent: { header: regions["toc-header"], footer: regions["toc-footer"] },
    };
    // the options of `renderDefault()` win over the layout props, `useLayoutProps()` over the server's, all over placed slots
    return (
      <DocsLayout
        tree={tree}
        {...mergeOptions<SharedLayoutProps>([options.layoutProps, client, server, sidebar])}
      >
        <page.DocsPage
          toc={toc}
          full={pageData.full}
          {...mergeOptions([options.pageProps, tableOfContent])}
        >
          <page.DocsTitle>{pageData.title}</page.DocsTitle>
          <page.DocsDescription className={actions ? "mb-0" : undefined}>
            {pageData.description}
          </page.DocsDescription>
          {actions && (
            <div className="flex flex-row gap-2 items-center border-b pt-2 pb-6">{actions}</div>
          )}
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
