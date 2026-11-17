import { onMounted, shallowRef, toValue, watch, type MaybeRefOrGetter, type Ref } from "vue";

/**
 * @returns `undefined` on the server, during hydration, or when disabled.
 */
export function useIsScrollTop({
  enabled = true,
}: {
  enabled?: MaybeRefOrGetter<boolean>;
}): Readonly<Ref<boolean | undefined>> {
  const isTop = shallowRef<boolean>();

  onMounted(() => {
    watch(
      () => toValue(enabled),
      (enabled, _, onCleanup) => {
        if (!enabled) {
          isTop.value = undefined;
          return;
        }

        const onChange = () => {
          isTop.value = window.scrollY < 10;
        };
        onChange();
        window.addEventListener("scroll", onChange, { passive: true });
        onCleanup(() => window.removeEventListener("scroll", onChange));
      },
      { immediate: true },
    );
  });

  return isTop;
}
