<script setup lang="ts">
import { computed } from "vue";
import { buttonVariants } from "../../../../components/ui/button";
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from "../../../../components/ui/popover";
import { useI18n } from "../../../../contexts/i18n";
import { useTranslations } from "../../../../core/translate";
import { cn } from "../../../../utils/cn";
import type { LanguageSelectProps } from "./index";

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<LanguageSelectProps>(), { variant: "ghost" });
const context = useI18n();
const t = useTranslations({ note: "language switcher" });
if (!context.locales.value) throw new Error("Missing `<I18nProvider />`");

const { locales, locale } = context;
const chooseLanguage = computed(() => t("Choose a language"));
const label = computed(() => t("Choose a language", { note: "aria-label" }));
const className = computed(() =>
  cn(
    buttonVariants({ variant: props.variant }),
    "gap-1.5 p-1.5 data-[state=open]:bg-fd-accent",
    props.class,
  ),
);
const itemClass = (active: boolean) =>
  cn(
    "px-2 py-1.5 text-start text-sm rounded-lg transition-colors",
    active
      ? "bg-fd-primary/10 text-fd-primary"
      : "text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-accent-foreground",
  );
</script>

<template>
  <Popover>
    <PopoverTrigger :aria-label="label" :class="className" v-bind="$attrs">
      <slot />
    </PopoverTrigger>
    <PopoverContent class="flex flex-col gap-0.5 p-1">
      <p class="p-2 text-xs font-medium text-fd-muted-foreground">{{ chooseLanguage }}</p>
      <PopoverClose
        v-for="item in locales"
        :key="item.locale"
        :class="itemClass(item.locale === locale)"
        @click="context.onChange?.(item.locale)"
      >
        {{ item.name }}
      </PopoverClose>
    </PopoverContent>
  </Popover>
</template>
