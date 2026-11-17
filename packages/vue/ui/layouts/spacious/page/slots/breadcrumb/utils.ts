import { computed, toValue, type ComputedRef, type MaybeRefOrGetter } from "vue";
import { useTreeContext, useTreePath } from "../../../../../contexts/tree";
import {
  getBreadcrumbItemsFromPath,
  type BreadcrumbItem,
  type BreadcrumbOptions,
} from "../../../../../core/breadcrumb";

export function useBreadcrumbItems(
  options: MaybeRefOrGetter<BreadcrumbOptions> = {},
): ComputedRef<BreadcrumbItem[]> {
  const path = useTreePath();
  const { root } = useTreeContext();

  return computed(() => {
    const { includeRoot, includeSeparator, includePage } = toValue(options);

    return getBreadcrumbItemsFromPath(root.value, path.value, {
      includePage,
      includeSeparator,
      includeRoot,
    });
  });
}
