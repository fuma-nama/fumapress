import type { Component, HTMLAttributes } from "vue";
import type { TOCItemType } from "../../../core/toc";
import type { TOCProps } from "./slots/toc";

export { useDocsPage } from "./context";
export { default as DocsPage } from "./DocsPage.vue";
export { default as EditOnGitHub } from "./EditOnGitHub.vue";
export { default as DocsBody } from "./DocsBody.vue";
export { default as DocsDescription } from "./DocsDescription.vue";
export { default as DocsTitle } from "./DocsTitle.vue";
export { default as PageLastUpdate } from "./PageLastUpdate.vue";

export interface DocsPageProps extends /* @vue-ignore */ HTMLAttributes {
  toc?: TOCItemType[];

  /**
   * Extend the page to fill all available space
   *
   * @defaultValue false
   */
  full?: boolean | undefined;

  tableOfContent?: TOCProps & {
    /**
     * Custom content in TOC container, before the main TOC
     */
    header?: string | Component;

    /**
     * Custom content in TOC container, after the main TOC
     */
    footer?: string | Component;
  };
}

export { MarkdownCopyButton, ViewOptionsPopover } from "../../shared/page-actions";
