<script setup lang="ts">
import { computed, shallowRef, watch, type HTMLAttributes } from "vue";
import { cn } from "../../../utils/cn";
import { useSidebar } from "./context";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
const { open, mode } = useSidebar();
const hidden = shallowRef(!open.value);
// where focus came from before entering the drawer
let returnFocus: HTMLElement | null = null;

watch(open, (open) => {
  if (open) hidden.value = false;
});

const className = computed(() => cn(!open.value && hidden.value && "invisible", props.class));

function onFocus(e: FocusEvent) {
  const aside = e.currentTarget as HTMLElement;

  if (!(e.relatedTarget instanceof Node && aside.contains(e.relatedTarget)))
    returnFocus = e.relatedTarget instanceof HTMLElement ? e.relatedTarget : null;
}

function onAnimationEnd(e: AnimationEvent) {
  if (open.value) return;
  // give focus back before the drawer becomes invisible
  if ((e.currentTarget as HTMLElement).contains(document.activeElement)) returnFocus?.focus();
  hidden.value = true;
}
</script>

<template>
  <aside
    v-if="mode === 'drawer'"
    id="nd-sidebar-mobile"
    :data-state="open ? 'open' : 'closed'"
    :class="className"
    @focusin="onFocus"
    @animationend="onAnimationEnd"
  >
    <slot />
  </aside>
</template>
