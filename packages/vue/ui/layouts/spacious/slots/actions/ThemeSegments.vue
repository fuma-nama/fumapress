<script setup lang="ts">
import { computed, nextTick } from "vue";
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-vue-next";
import { DropdownMenuRadioGroup, DropdownMenuRadioItem } from "reka-ui";
import { useTheme } from "../../../../core/theme";
import { useTranslations } from "../../../../core/translate";
import { cn } from "../../../../utils/cn";

const themes = [
  // the angle each icon turns in from when picked
  ["system", MonitorIcon, "0deg"],
  ["light", SunIcon, "-90deg"],
  ["dark", MoonIcon, "40deg"],
] as const;

const { theme, setTheme } = useTheme();
const t = useTranslations({ note: "theme switcher" });
const labels = computed(() => ({
  light: t("Light", { note: "aria-label" }),
  dark: t("Dark", { note: "aria-label" }),
  system: t("System", { note: "aria-label" }),
}));
const index = computed(() => themes.findIndex(([key]) => key === theme.value));

function onPick(e: MouseEvent, turn: string) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  (e.currentTarget as HTMLElement).firstElementChild?.animate(
    [
      { rotate: turn, scale: 0.6 },
      { rotate: "0deg", scale: 1 },
    ],
    { duration: 520, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" },
  );
}

function onValueChange(value: unknown) {
  const v = value as string;

  if (document.startViewTransition)
    document.startViewTransition(() => {
      setTheme(v);
      return nextTick();
    });
  else setTheme(v);
}

// Base UI keeps the menu open on picking a radio item, Reka UI closes it unless the selection is prevented
function keepOpen(e: Event) {
  e.preventDefault();
}

const itemClass = (key: string) =>
  cn(
    "relative flex items-center justify-center size-7 rounded-full outline-none transition-colors duration-150 hover:text-fd-foreground focus-visible:ring-2 focus-visible:ring-fd-ring data-highlighted:text-fd-foreground [&_svg]:size-3.5",
    key === theme.value
      ? "text-fd-foreground"
      : "text-fd-muted-foreground data-highlighted:bg-fd-accent",
  );
</script>

<template>
  <DropdownMenuRadioGroup
    :model-value="theme"
    :aria-label="t('Toggle Theme', { note: 'aria-label' })"
    class="relative flex rounded-full border bg-fd-secondary p-0.5"
    @update:model-value="onValueChange"
  >
    <span
      v-if="index !== -1"
      aria-hidden="true"
      class="absolute top-0.5 start-0.5 size-7 rounded-full bg-fd-background shadow-sm ring-1 ring-fd-border translate-x-[calc(var(--index)*100%)] rtl:-translate-x-[calc(var(--index)*100%)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
      :style="{ '--index': index }"
    />
    <DropdownMenuRadioItem
      v-for="[key, Icon, turn] in themes"
      :key="key"
      :value="key"
      :aria-label="labels[key]"
      :class="itemClass(key)"
      @click="onPick($event, turn)"
      @select="keepOpen"
    >
      <component :is="Icon" />
    </DropdownMenuRadioItem>
  </DropdownMenuRadioGroup>
</template>
