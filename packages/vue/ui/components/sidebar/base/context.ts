import {
  inject,
  onMounted,
  toValue,
  watch,
  type InjectionKey,
  type MaybeRefOrGetter,
  type Ref,
} from "vue";
import scrollIntoView from "scroll-into-view-if-needed";

export type Mode = "drawer" | "full";

/** a value, or a function of the previous one */
type SetState<T> = (value: T | ((prev: T) => T)) => void;

export interface SidebarContext {
  open: Readonly<Ref<boolean>>;
  setOpen: SetState<boolean>;
  collapsed: Readonly<Ref<boolean>>;
  setCollapsed: SetState<boolean>;

  /**
   * When set to false, don't close the sidebar when navigate to another page
   */
  closeOnRedirect: Ref<boolean>;
  defaultOpenLevel: Readonly<Ref<number>>;
  prefetch: Readonly<Ref<boolean | undefined>>;
  mode: Readonly<Ref<Mode>>;
}

export interface FolderContext {
  open: Readonly<Ref<boolean>>;
  setOpen: (value: boolean) => void;
  /** the level of the folder, it doesn't change */
  depth: number;
  collapsible: Readonly<Ref<boolean>>;
}

export const SidebarKey: InjectionKey<SidebarContext> = Symbol("fd-sidebar");
export const FolderKey: InjectionKey<FolderContext> = Symbol("fd-sidebar-folder");

export function useSidebar(): SidebarContext {
  const ctx = inject(SidebarKey, null);
  if (!ctx)
    throw new Error(
      "Missing SidebarContext, make sure you have wrapped the component in <DocsLayout /> and the context is available.",
    );

  return ctx;
}

export function useFolder(): FolderContext | null {
  return inject(FolderKey, null);
}

export function useFolderDepth(): number {
  return inject(FolderKey, null)?.depth ?? 0;
}

/**
 * scroll to the element if `active` is true
 */
export function useAutoScroll(
  active: MaybeRefOrGetter<boolean>,
  ref: MaybeRefOrGetter<HTMLElement | null | undefined>,
) {
  const { mode } = useSidebar();

  onMounted(() => {
    watch(
      () => [toValue(active), mode.value] as const,
      ([active, mode]) => {
        const element = toValue(ref);

        if (active && element) {
          scrollIntoView(element, {
            boundary: document.getElementById(
              mode === "drawer" ? "nd-sidebar-mobile" : "nd-sidebar",
            ),
            scrollMode: "if-needed",
          });
        }
      },
      { immediate: true, flush: "post" },
    );
  });
}
