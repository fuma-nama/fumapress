import type { WakuAppShape, WakuPlugin } from "fumapress";
import { previewPath } from "./options";
import { PlaygroundPreview } from "./preview";

function PreviewPage() {
  return (
    <>
      <title>Playground Preview</title>
      <meta name="robots" content="noindex" />
      <PlaygroundPreview />
    </>
  );
}

/**
 * The page in the iframe of the playground. A plugin page sits outside the route group of `src/pages`, so the Home
 * Layout of `src/pages/_layout.tsx` doesn't wrap it. It reads no content and is prerendered.
 */
export function playgroundPlugin<C extends WakuAppShape>(): WakuPlugin<C> {
  return {
    name: "docs:playground",
    waku: {
      createPages({ createPage }) {
        // a page for the iframe only, not one to list
        createPage({ path: previewPath, render: "static", component: PreviewPage, sitemap: false });
      },
    },
  };
}
