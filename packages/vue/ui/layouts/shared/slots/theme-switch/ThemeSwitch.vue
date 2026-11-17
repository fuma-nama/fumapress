<script setup lang="ts">
import { computed, nextTick, onMounted, shallowRef } from "vue";
import { cva } from "class-variance-authority";
import { Airplay, Moon, Sun } from "lucide-vue-next";
import { useTheme } from "../../../../core/theme";
import { useTranslations } from "../../../../core/translate";
import { cn } from "../../../../utils/cn";
import type { ThemeSwitchProps } from "./index";

defineOptions({ inheritAttrs: false });

const itemVariants = cva("size-6.5 p-1.5 text-fd-muted-foreground", {
  variants: {
    active: {
      true: "bg-fd-accent text-fd-accent-foreground",
      false: "text-fd-muted-foreground",
    },
  },
});

const themes = [["light", Sun] as const, ["dark", Moon] as const, ["system", Airplay] as const];

const props = withDefaults(defineProps<ThemeSwitchProps>(), { mode: "light-dark" });
const { setTheme, theme, resolvedTheme } = useTheme();
// `false` on the server and during hydration
const mounted = shallowRef(false);
const t = useTranslations({ note: "theme switcher" });
const themeAriaLabels = computed(() => ({
  light: t("Light", { note: "aria-label" }),
  dark: t("Dark", { note: "aria-label" }),
  system: t("System", { note: "aria-label" }),
}));
const toggleLabel = computed(() => t("Toggle Theme", { note: "aria-label" }));

onMounted(() => {
  mounted.value = true;
});

const handleThemeChange = (newTheme: string) => {
  if (document?.startViewTransition) {
    document.startViewTransition(() => {
      setTheme(newTheme);
      return nextTick();
    });
  } else {
    setTheme(newTheme);
  }
};

const container = computed(() =>
  cn(
    "inline-flex items-center rounded-full border p-1 overflow-hidden *:rounded-full",
    props.class,
  ),
);
const value = computed(() => {
  if (!mounted.value) return null;
  return props.mode === "light-dark" ? resolvedTheme.value : theme.value;
});
const itemClass = (key: string) => cn(itemVariants({ active: value.value === key }));
</script>

<template>
  <button
    v-if="mode === 'light-dark'"
    :class="container"
    :aria-label="toggleLabel"
    data-theme-toggle=""
    @click="handleThemeChange(value === 'light' ? 'dark' : 'light')"
  >
    <template v-for="[key, Icon] in themes" :key="key">
      <component :is="Icon" v-if="key !== 'system'" fill="currentColor" :class="itemClass(key)" />
    </template>
  </button>
  <div v-else :class="container" data-theme-toggle="" v-bind="$attrs">
    <button
      :aria-label="themeAriaLabels.light"
      :class="itemClass('light')"
      @click="handleThemeChange('light')"
    >
      <Sun class="size-full" fill="currentColor" />
    </button>
    <button
      :aria-label="themeAriaLabels.dark"
      :class="itemClass('dark')"
      @click="handleThemeChange('dark')"
    >
      <Moon class="size-full" fill="currentColor" />
    </button>
    <button
      :aria-label="themeAriaLabels.system"
      :class="itemClass('system')"
      @click="handleThemeChange('system')"
    >
      <Airplay class="size-full" fill="currentColor" />
    </button>
  </div>
</template>
