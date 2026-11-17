import { inject, type Component, type InjectionKey, type Ref } from "vue";

export interface DocsPageSlots {
  toc: {
    /** receives `TOCProviderProps` */
    provider: Component;
    /** receives `TOCProps`, and the slots `header` and `footer` */
    main: Component;
    /** receives `TOCPopoverProps`, and the slots `header` and `footer` */
    popover: Component;
    /** receives `TOCDropdownProps`, and the slots `header` and `footer` */
    dropdown: Component;
  };
  /** receives `FooterProps` */
  footer: Component;
  /** receives `BreadcrumbProps` */
  breadcrumb: Component;
}

export interface PageContext {
  full: Readonly<Ref<boolean>>;
  slots: Readonly<Ref<DocsPageSlots>>;
}

export const PageKey: InjectionKey<PageContext> = Symbol("fd-spacious-page");

export function useDocsPage(): PageContext {
  const context = inject(PageKey, null);
  if (!context)
    throw new Error(
      "Please use page components under <DocsPage /> (`@fumapress/vue/ui/layouts/spacious/page`).",
    );
  return context;
}
