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

/** the attributes of an `<article>` reach the container */
export interface DocsPageProps extends /* @vue-ignore */ HTMLAttributes {
  toc?: TOCItemType[];

  /**
   * Extend the page to fill all available space
   *
   * @defaultValue false
   */
  full?: boolean | undefined;
  slots?: Partial<DocsPageSlots>;

  footer?: FooterOptions;
  breadcrumb?: BreadcrumbOptions;
  tableOfContent?: TableOfContentOptions;
  tableOfContentPopover?: TableOfContentPopoverOptions;
}

interface BreadcrumbOptions extends BreadcrumbProps {
  enabled?: boolean;
  /**
   * @deprecated use `slots.breadcrumb` instead.
   */
  component?: string | Component;
}

interface FooterOptions extends FooterProps {
  enabled?: boolean;
  /**
   * @deprecated use `slots.footer` instead.
   */
  component?: string | Component;
}

type TableOfContentOptions = Pick<TOCProviderProps, "single"> &
  TOCProps & {
    enabled?: boolean;
    /**
     * Custom content in TOC container, before the main TOC
     */
    header?: string | Component;
    /**
     * Custom content in TOC container, after the main TOC
     */
    footer?: string | Component;
    /**
     * @deprecated use `slots.toc` instead.
     */
    component?: string | Component;
  };

type TableOfContentPopoverOptions = TOCPopoverProps & {
  enabled?: boolean;
  /**
   * Custom content in TOC container, before the main TOC
   */
  header?: string | Component;
  /**
   * Custom content in TOC container, after the main TOC
   */
  footer?: string | Component;
  /**
   * @deprecated use `slots.tocPopover` instead.
   */
  component?: string | Component;
};

export { type BreadcrumbProps, Breadcrumb as PageBreadcrumb } from "./slots/breadcrumb";
export { type FooterProps, Footer as PageFooter } from "./slots/footer";
export { MarkdownCopyButton, ViewOptionsPopover } from "../../shared/page-actions";
