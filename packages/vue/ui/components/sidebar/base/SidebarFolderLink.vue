<script setup lang="ts">
import { computed, useTemplateRef, type ComponentPublicInstance } from "vue";
import { ChevronDown } from "lucide-vue-next";
import { Link } from "../../../core/link";
import { cn } from "../../../utils/cn";
import { useAutoScroll, useFolder, useSidebar } from "./context";

const props = withDefaults(
  defineProps<{ href?: string; external?: boolean; prefetch?: boolean; active?: boolean }>(),
  { external: undefined, prefetch: undefined, active: false },
);
const link = useTemplateRef<ComponentPublicInstance>("link");
const { open, setOpen, collapsible } = useFolder()!;
const { prefetch } = useSidebar();
const iconClass = computed(() =>
  cn("ms-auto transition-transform", !open.value && "-rotate-90 rtl:rotate-90"),
);

useAutoScroll(
  () => props.active,
  () => link.value?.$el as HTMLElement | undefined,
);

// on capture: the link navigates on click, before a listener added to it could prevent it
function onClick(e: MouseEvent) {
  if (!collapsible.value) return;

  if (e.target instanceof Element && e.target.matches("[data-icon], [data-icon] *")) {
    setOpen(!open.value);
    e.preventDefault();
  } else {
    setOpen(props.active ? !open.value : true);
  }
}
</script>

<template>
  <Link
    ref="link"
    :href="href"
    :external="external"
    :data-active="active"
    :aria-current="active ? 'page' : undefined"
    :prefetch="props.prefetch ?? prefetch"
    @click.capture="onClick"
  >
    <slot />
    <ChevronDown v-if="collapsible" data-icon :class="iconClass" />
  </Link>
</template>
