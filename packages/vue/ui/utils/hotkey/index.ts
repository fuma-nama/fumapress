import { onMounted, toValue, watch, type MaybeRefOrGetter } from "vue";

/**
 * Listen to `keydown` on window, skipping keys that are already handled or composing text.
 */
export function useHotKey(
  onKeyDown: (e: KeyboardEvent) => void,
  {
    enabled = true,
    ignoreTyping = false,
  }: {
    enabled?: MaybeRefOrGetter<boolean>;
    /** ignore it while typing in an editable element (e.g. `<input />`), or when a dialog is opened */
    ignoreTyping?: boolean;
  } = {},
) {
  const listener = (e: KeyboardEvent) => {
    if (e.defaultPrevented || e.isComposing || e.keyCode === 229) return;
    if (ignoreTyping && isTypingTarget(e.target)) return;
    onKeyDown(e);
  };

  onMounted(() => {
    watch(
      () => toValue(enabled),
      (enabled, _, onCleanup) => {
        if (!enabled) return;
        window.addEventListener("keydown", listener);
        onCleanup(() => window.removeEventListener("keydown", listener));
      },
      { immediate: true },
    );
  });
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return true;

  return target.closest('[role="dialog"]') !== null;
}
