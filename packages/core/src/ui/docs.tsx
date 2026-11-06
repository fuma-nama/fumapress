"use client";
import type { ComponentType, ReactNode } from "react";
import { DocsLayout, type DocsLayoutProps } from "fumadocs-ui/layouts/docs";
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
  MarkdownCopyButton,
  PageLastUpdate,
  ViewOptionsPopover,
} from "fumadocs-ui/layouts/docs/page";
import type { DocsPageData } from "../plugin";
import type { DefaultPageProps } from "../press";

export interface DefaultDocsProps extends Pick<DefaultPageProps, "tree" | "baseOptions"> {
  /** the Docs Layout, a client component of the `ai-chat` capability docks the chat */
  layout?: ComponentType<DocsLayoutProps>;
  pageData: DocsPageData;
  /** the items of the `actions` slot */
  actions: ReactNode;
  /** the items of the `footer` slot */
  footer: ReactNode;
  /** the body */
  children: ReactNode;
}

/** the Docs Layout and page of a content page */
export function DefaultDocs({
  layout: Layout = DocsLayout,
  tree,
  baseOptions,
  pageData,
  actions,
  footer,
  children,
}: DefaultDocsProps) {
  return (
    <Layout {...baseOptions} tree={tree}>
      <DocsPage toc={pageData.toc} full={pageData.full}>
        <DocsTitle>{pageData.title}</DocsTitle>
        <DocsDescription className="mb-0">{pageData.description}</DocsDescription>
        <div className="flex flex-row gap-2 items-center border-b pt-2 pb-6">
          {pageData.markdownUrl && <MarkdownCopyButton markdownUrl={pageData.markdownUrl} />}
          <ViewOptionsPopover markdownUrl={pageData.markdownUrl} githubUrl={pageData.githubUrl} />
          {actions}
        </div>
        <DocsBody>{children}</DocsBody>
        {pageData.lastModified && <PageLastUpdate date={pageData.lastModified} />}
        {footer}
      </DocsPage>
    </Layout>
  );
}
