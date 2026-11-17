<script setup lang="ts">
import { nextTick } from "vue";
import { useTheme } from "../../core/theme";
import { useHotKey } from "../../utils/hotkey";

/**
 * Toggle between light/dark mode with a hotkey, must be placed under the theme provider.
 */
const props = defineProps<{ hotKey: string | ((e: KeyboardEvent) => boolean) }>();
const { setTheme, resolvedTheme } = useTheme();

useHotKey(
  (e) => {
    const hotKey = props.hotKey;
    // a custom function is responsible for its own modifiers
    const matched =
      typeof hotKey === "string"
        ? !e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === hotKey.toLowerCase()
        : hotKey(e);
    if (!matched) return;

    e.preventDefault();
    const next = resolvedTheme.value === "dark" ? "light" : "dark";
    if (document?.startViewTransition) {
      document.startViewTransition(() => {
        setTheme(next);
        return nextTick();
      });
    } else {
      setTheme(next);
    }
  },
  { ignoreTyping: true },
);
</script>

<template>
  <slot />
</template>
