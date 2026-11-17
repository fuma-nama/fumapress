import { computed, type ComputedRef } from "vue";
import { mergeOptions, useLayoutProps } from "@fumapress/vue/client";

/**
 * The props of a docs layout: the ones a theme passes over `ui.layoutProps` of the config and the layout props of
 * plugins, merged like core's `renderDefault()` options.
 */
export function mergeLayoutProps(own: () => object | undefined): ComputedRef<object> {
  const ofSite = useLayoutProps();
  return computed(() => {
    // the options of the search dialog are for the root provider
    const { search: _, ...merged }: { search?: unknown } = mergeOptions<object>([own(), ofSite]);
    return merged;
  });
}
