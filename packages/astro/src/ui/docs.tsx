"use client";
import { useMemo, type CSSProperties } from "react";
import { type SerializedPageTree, useFumadocsLoader } from "fumadocs-core/source/client";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
  MarkdownCopyButton,
  PageLastUpdate,
  ViewOptionsPopover,
} from "fumadocs-ui/layouts/docs/page";
import UserPage from "virtual:fumapress/page";
import type { DocsPageProps } from "../config";
import type { ProviderData } from "./content";
import { Provider } from "./provider";

export interface DocsProps extends Omit<DocsPageProps, "tree"> {
  provider: ProviderData;
  /** JSON of the {@link SerializedPageTree}, the same for every page of a language */
  tree: string;
}

const Page = UserPage ?? DefaultPage;

/** the island of docs pages, the body is the children */
export function Docs({ provider, tree, ...props }: DocsProps) {
  const serialized = useMemo<SerializedPageTree>(() => JSON.parse(tree), [tree]);
  const data = useFumadocsLoader({ tree: serialized });

  return (
    <Provider provider={provider}>
      <Page {...props} tree={data.tree} />
    </Provider>
  );
}

// inline styles, Tailwind CSS doesn't scan this package
const pageActions: CSSProperties = {
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  gap: "0.5rem",
  paddingTop: "0.5rem",
  paddingBottom: "1.5rem",
  borderBottom: "1px solid var(--color-fd-border)",
};

function DefaultPage({ tree, page, layout, slots, children }: DocsPageProps) {
  return (
    <DocsLayout {...layout} tree={tree}>
      <DocsPage toc={page.toc} full={page.full}>
        <DocsTitle>{page.title}</DocsTitle>
        <DocsDescription style={{ marginBottom: 0 }}>{page.description}</DocsDescription>
        <div style={pageActions}>
          {page.markdownUrl && <MarkdownCopyButton markdownUrl={page.markdownUrl} />}
          <ViewOptionsPopover markdownUrl={page.markdownUrl} githubUrl={page.githubUrl} />
          {slots["page.actions"]}
        </div>
        <DocsBody>{children}</DocsBody>
        {page.lastModified && <PageLastUpdate date={page.lastModified} />}
        {slots["page.footer"]}
      </DocsPage>
    </DocsLayout>
  );
}
