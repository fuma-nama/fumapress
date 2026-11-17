import { watch, type WatchSource } from "vue";
import { isEqualShallow } from "../is-equal";

/**
 * @param value - state to watch
 * @param onChange - when the state changed
 * @param isUpdated - a function that determines if the state is updated
 */
export function useOnChange<T>(
  value: WatchSource<T>,
  onChange: (current: T, previous: T) => void,
  isUpdated: (prev: T, current: T) => boolean = (a, b) => !isEqualShallow(a, b),
): void {
  watch(value, (current, previous) => {
    if (isUpdated(previous, current)) onChange(current, previous);
  });
}
