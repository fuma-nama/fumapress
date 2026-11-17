import { inject, type Component, type InjectionKey, type Ref } from "vue";

export interface DocsPageSlots {
  toc: {
    /** receives `TOCProviderProps` */
    provider: Component;
    /** receives `TOCProps`, and the slots `header` and `footer` */
    main: Component;
    /** receives `TOCPopoverProps`, and the slots `header` and `footer` */
    popover: Component;
  };
  /** receives the attributes of an `<article>` */
  container: Component;
  /** receives `FooterProps` */
  footer: Component;
  /** receives `BreadcrumbProps` */
  breadcrumb: Component;
}

export const PageKey: InjectionKey<{
  full: Readonly<Ref<boolean>>;
  slots: Readonly<Ref<DocsPageSlots>>;
}> = Symbol("fd-notebook-page");

export function useDocsPage() {
  const context = inject(PageKey, null);
  if (!context)
    throw new Error(
      "Please use page components under <DocsPage /> (`@fumapress/vue/ui/layouts/notebook/page`).",
    );
  return context;
}
