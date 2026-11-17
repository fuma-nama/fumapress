<script setup lang="ts">
import { computed, shallowRef, watch, type HTMLAttributes } from "vue";
import { cn } from "../../../utils/cn";

/**
 * The place of AI chat, docked by the layout on wide viewports, and floating on smaller ones.
 */
const props = defineProps<{ open: boolean; class?: HTMLAttributes["class"] }>();
// mount the chat once opened
const mounted = shallowRef(props.open);

watch(
  () => props.open,
  (open) => {
    if (open) mounted.value = true;
  },
);

const className = computed(() =>
  cn(
    "z-40 overflow-clip bg-fd-card text-fd-card-foreground layout:[--fd-ai-chat-width:min(--spacing(100),100vw---spacing(4))] transition-[width,margin,translate] duration-300 ease-in-out motion-reduce:transition-none max-xl:fixed max-xl:inset-y-2 max-xl:end-2 max-xl:w-(--fd-ai-chat-width) max-xl:rounded-2xl max-xl:border max-xl:shadow-xl",
    props.open
      ? "w-(--fd-ai-chat-width)"
      : // visible at once when opened, so it can take focus; hidden only after closing
        "invisible w-0 transition-[width,margin,translate,visibility] max-xl:translate-x-[calc(100%+--spacing(2))] rtl:max-xl:-translate-x-[calc(100%+--spacing(2))]",
    props.class,
  ),
);
// the inner element has a fixed width while resizing
</script>

<template>
  <aside :class="className">
    <div class="flex flex-col size-full xl:w-(--fd-ai-chat-width)">
      <slot v-if="mounted || open" />
    </div>
  </aside>
</template>
