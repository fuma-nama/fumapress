import type { Item, Root } from "fumadocs-core/page-tree";

export function page(ref: string, name = ref): Item {
  return {
    $id: `page:${ref}`,
    type: "page",
    url: '/' + ref,
    name,
    $ref: ref,
  };
}

export const sampleRoot: Root = {
  $id: "root",
  name: "Docs",
  children: [
    page("docs/getting-started", "Getting Started"),
    page("docs/guides/setup", "Setup Guide"),
    page("docs/getting-started-cn", "Getting Started (CN)"),
    page("v2/docs/overview", "Overview v2"),
  ],
};
