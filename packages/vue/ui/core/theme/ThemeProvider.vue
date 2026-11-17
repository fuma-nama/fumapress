<script setup lang="ts">
/**
 * `next-themes` with the options of Fumadocs UI: the theme is a class of `<html>` (`light` or `dark`), stored at
 * `theme` in `localStorage` (`light`, `dark` or `system`), the system preference by default, without transitions on
 * change. The inline script of the document applies the same before the first paint.
 */
import { computed, onBeforeUnmount, onMounted, provide, shallowRef } from "vue";
import { ThemeKey } from "./context";

const STORAGE_KEY = "theme";
const DEFAULT_THEME = "system";
const MEDIA = "(prefers-color-scheme: dark)";
const colorSchemes = ["light", "dark"];

const theme = shallowRef<string>();
const systemTheme = shallowRef<string>();
let media: MediaQueryList | undefined;

function getSystemTheme(e: MediaQueryList | MediaQueryListEvent = window.matchMedia(MEDIA)) {
  return e.matches ? "dark" : "light";
}

function disableAnimation() {
  const css = document.createElement("style");
  css.appendChild(
    document.createTextNode(
      "*,*::before,*::after{-webkit-transition:none!important;-moz-transition:none!important;-o-transition:none!important;-ms-transition:none!important;transition:none!important}",
    ),
  );
  document.head.appendChild(css);

  return () => {
    // Force restyle
    void window.getComputedStyle(document.body);

    // Wait for next tick before removing
    setTimeout(() => {
      document.head.removeChild(css);
    }, 1);
  };
}

function applyTheme(value: string) {
  const resolved = value === "system" ? getSystemTheme() : value;
  const enable = disableAnimation();
  const d = document.documentElement;

  d.classList.remove(...colorSchemes);
  d.classList.add(resolved);
  d.style.colorScheme = colorSchemes.includes(resolved) ? resolved : "";
  enable();
}

function setTheme(value: string) {
  theme.value = value;
  applyTheme(value);

  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Unsupported
  }
}

function onMediaChange(e: MediaQueryListEvent) {
  systemTheme.value = getSystemTheme(e);
  if (theme.value === "system") applyTheme("system");
}

// the theme changed in another tab
function onStorage(e: StorageEvent) {
  if (e.key !== STORAGE_KEY) return;

  if (e.newValue) {
    theme.value = e.newValue;
    applyTheme(e.newValue);
  } else {
    setTheme(DEFAULT_THEME);
  }
}

onMounted(() => {
  let stored: string | undefined;
  try {
    stored = localStorage.getItem(STORAGE_KEY) || undefined;
  } catch {
    // Unsupported
  }

  theme.value = stored || DEFAULT_THEME;
  systemTheme.value = getSystemTheme();
  applyTheme(theme.value);

  media = window.matchMedia(MEDIA);
  media.addEventListener("change", onMediaChange);
  window.addEventListener("storage", onStorage);
});

onBeforeUnmount(() => {
  media?.removeEventListener("change", onMediaChange);
  window.removeEventListener("storage", onStorage);
});

provide(ThemeKey, {
  theme,
  resolvedTheme: computed(() => (theme.value === "system" ? systemTheme.value : theme.value)),
  setTheme,
});
</script>

<template>
  <slot />
</template>
