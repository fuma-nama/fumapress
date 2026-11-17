import { onMounted, shallowRef, toValue, watch, type MaybeRefOrGetter, type Ref } from "vue";

/**
 * @returns `null` on the server, during hydration, or when disabled.
 */
export function useMediaQuery(
  query: MaybeRefOrGetter<string>,
  disabled: MaybeRefOrGetter<boolean> = false,
): Readonly<Ref<boolean | null>> {
  const matches = shallowRef<boolean | null>(null);

  onMounted(() => {
    watch(
      () => [toValue(query), toValue(disabled)] as const,
      ([query, disabled], _, onCleanup) => {
        if (disabled) {
          matches.value = null;
          return;
        }

        const list = window.matchMedia(query);
        const onChange = () => {
          matches.value = list.matches;
        };
        onChange();
        list.addEventListener("change", onChange);
        onCleanup(() => list.removeEventListener("change", onChange));
      },
      { immediate: true },
    );
  });

  return matches;
}
