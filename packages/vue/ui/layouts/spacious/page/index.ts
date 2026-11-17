import type { Component, HTMLAttributes } from "vue";
import type { TOCItemType } from "../../../core/toc";
import type { DocsPageSlots } from "./context";
import type { BreadcrumbProps } from "./slots/breadcrumb";
import type { FooterProps } from "./slots/footer";
import type { TOCPopoverProps, TOCProps, TOCProviderProps } from "./slots/toc";

export { useDocsPage } from "./context";
export { default as DocsPage } from "./DocsPage.vue";
export { default as EditOnGitHub } from "./EditOnGitHub.vue";
export { default as DocsBody } from "./DocsBody.vue";
export { default as DocsDescription } from "./DocsDescription.vue";
export { default as DocsTitle } from "./DocsTitle.vue";
export { default as PageLastUpdate } from "./PageLastUpdate.vue";

interface TOCContent {
  /**
   * Custom content in TOC container, before the main TOC
   */
  header?: string | Component;
  /**
   * Custom content in TOC container, after the main TOC
   */
  footer?: string | Component;
}

/** the attributes of an `<article>`, the page is the default slot */
export interface DocsPageProps extends /* @vue-ignore */ HTMLAttributes {
  class?: HTMLAttributes["class"];
  toc?: TOCItemType[];
  /**
   * Extend the page to fill all available space
   *
   * @defaultValue false
   */
  full?: boolean;
  slots?: Partial<DocsPageSlots>;
  footer?: FooterProps & { enabled?: boolean };
  breadcrumb?: BreadcrumbProps & { enabled?: boolean };
  tableOfContent?: TOCProps & TOCContent & Pick<TOCProviderProps, "single"> & { enabled?: boolean };
  tableOfContentPopover?: TOCPopoverProps & TOCContent & { enabled?: boolean };
}

export { type BreadcrumbProps, Breadcrumb as PageBreadcrumb } from "./slots/breadcrumb";
export { type FooterProps, Footer as PageFooter } from "./slots/footer";
export { MarkdownCopyButton, ViewOptionsPopover } from "../../shared/page-actions";
