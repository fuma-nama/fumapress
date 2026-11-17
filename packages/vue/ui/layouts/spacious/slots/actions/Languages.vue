<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { CheckIcon, ChevronsUpDownIcon, LanguagesIcon } from "lucide-vue-next";
import {
  DropdownMenuItemIndicator,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "reka-ui";
import { useI18n } from "../../../../contexts/i18n";
import { useTranslations } from "../../../../core/translate";
import { cn } from "../../../../utils/cn";
import { itemClass, popupClass } from "./utils";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
const { locale, locales, onChange } = useI18n();
const t = useTranslations({ note: "language switcher" });
const className = computed(() => cn("p-1", props.class));
const triggerClass = cn(itemClass, "data-[state=open]:bg-fd-accent");
// the class of Base UI's positioner is on the content: Reka UI gives its wrapper the z-index of the content
const contentClass = cn("z-50", popupClass, "min-w-44 p-1");
const name = computed(
  () => (locales.value ?? []).find((item) => item.locale === locale.value)?.name,
);

function onValueChange(value: unknown) {
  onChange?.(value as string);
}
</script>

<template>
  <div :class="className">
    <DropdownMenuSub>
      <DropdownMenuSubTrigger :class="triggerClass">
        <LanguagesIcon class="text-fd-muted-foreground" />
        <span class="flex-1 whitespace-nowrap">{{ t("Language") }}</span>
        <span class="truncate text-fd-muted-foreground">{{ name }}</span>
        <ChevronsUpDownIcon class="size-3.5! text-fd-muted-foreground" />
      </DropdownMenuSubTrigger>
      <DropdownMenuPortal>
        <DropdownMenuSubContent
          :side-offset="8"
          :align-offset="-4"
          position-strategy="fixed"
          :class="contentClass"
        >
          <DropdownMenuRadioGroup :model-value="locale" @update:model-value="onValueChange">
            <DropdownMenuRadioItem
              v-for="item in locales ?? []"
              :key="item.locale"
              :value="item.locale"
              :class="itemClass"
            >
              <span class="flex-1">{{ item.name }}</span>
              <DropdownMenuItemIndicator>
                <CheckIcon class="text-fd-primary" />
              </DropdownMenuItemIndicator>
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuSubContent>
      </DropdownMenuPortal>
    </DropdownMenuSub>
  </div>
</template>
