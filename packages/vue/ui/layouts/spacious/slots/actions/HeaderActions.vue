<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { ChevronDownIcon, LanguagesIcon, MessageCircleIcon } from "../../../../icons";
import { buttonVariants } from "../../../../components/ui/button";
import { useTranslations } from "../../../../core/translate";
import { cn } from "../../../../utils/cn";
import { useSpaciousLayout } from "../../context";
import IconLinks from "./IconLinks.vue";
import OptionsMenu from "./OptionsMenu.vue";

/** AI chat, language switcher and icon links move into the options menu on smaller viewports */
defineOptions({ inheritAttrs: false });

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
const { slots, props: layout } = useSpaciousLayout();
const t = useTranslations({ note: "AI chat button" });
const aiChat = computed(() => layout.value.aiChat);
const className = computed(() =>
  cn("flex items-center gap-0.5 rounded-lg bg-fd-background", props.class),
);
const aiChatClass = cn(
  buttonVariants({ variant: "ghost" }),
  "h-7.5 gap-1.5 px-2 text-fd-muted-foreground max-lg:hidden",
);
</script>

<template>
  <div v-bind="$attrs" :class="className">
    <button
      v-if="aiChat && !aiChat.open"
      type="button"
      :class="aiChatClass"
      @click="aiChat.onOpenChange(true)"
    >
      <MessageCircleIcon class="size-4" />{{ t("Ask AI") }}
    </button>
    <component
      :is="slots.languageSelect.root"
      v-if="slots.languageSelect"
      class="h-7.5 gap-1.5 px-2 text-fd-muted-foreground max-lg:hidden"
    >
      <LanguagesIcon class="size-4" />
      <component :is="slots.languageSelect.text" />
      <ChevronDownIcon class="size-3.5 transition-transform in-data-[state=open]:rotate-180" />
    </component>
    <IconLinks class="text-fd-muted-foreground max-lg:hidden" />
    <OptionsMenu />
  </div>
</template>
