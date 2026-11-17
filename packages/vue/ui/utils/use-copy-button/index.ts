import { onBeforeUnmount, ref, type Ref } from "vue";

export function useCopyButton(
  onCopy: () => void | Promise<void>,
): [checked: Ref<boolean>, onClick: () => void] {
  const checked = ref(false);
  let timeout: number | null = null;

  const onClick = () => {
    if (timeout) window.clearTimeout(timeout);
    const res = Promise.resolve(onCopy());

    void res.then(() => {
      checked.value = true;
      timeout = window.setTimeout(() => {
        checked.value = false;
      }, 1500);
    });
  };

  // Avoid updates after being unmounted
  onBeforeUnmount(() => {
    if (timeout) window.clearTimeout(timeout);
  });

  return [checked, onClick];
}
