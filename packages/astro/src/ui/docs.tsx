"use client";
import { use, type CSSProperties } from "react";
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

export interface DocsProps extends Omit<DocsPageProps, "tree"> {
  /** the URL of the {@link SerializedPageTree}, the same for every page of a language */
  tree: string;
}

/** the serialized page trees by URL on the server, registered with the pages */
export const serverTrees = new Map<string, SerializedPageTree>();
const clientTrees = new Map<string, Promise<SerializedPageTree>>();

/** fetch a page tree once in the browser, the island renders in `Suspense` until it loads */
function fetchTree(url: string): Promise<SerializedPageTree> {
  let tree = clientTrees.get(url);
  if (!tree) {
    tree = fetch(url).then((res) => res.json());
    clientTrees.set(url, tree);
  }
  return tree;
}

const Page = UserPage ?? DefaultPage;

/** the layout of docs pages, in the island of the provider; the body is the children */
export function Docs({ tree, ...props }: DocsProps) {
  const data = useFumadocsLoader({ tree: serverTrees.get(tree) ?? use(fetchTree(tree)) });

  return <Page {...props} tree={data.tree} />;
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
