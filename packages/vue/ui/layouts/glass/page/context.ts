import { inject, type InjectionKey, type Ref } from "vue";

export interface PageContext {
  full: Readonly<Ref<boolean>>;
}

export const PageKey: InjectionKey<PageContext> = Symbol("fd-glass-page");

export function useDocsPage(): PageContext {
  const context = inject(PageKey, null);
  if (!context)
    throw new Error(
      "Please use page components under <DocsPage /> (`@fumapress/vue/ui/layouts/glass/page`).",
    );
  return context;
}
