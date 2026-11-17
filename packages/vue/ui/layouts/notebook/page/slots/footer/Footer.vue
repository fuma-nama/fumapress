<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { usePathname } from "../../../../../core/framework";
import { cn } from "../../../../../utils/cn";
import { isActive } from "../../../../../utils/urls";
import { useFooterItems } from "../../../../../utils/use-footer-items";
import type { FooterProps } from "./index";
import FooterItem from "./FooterItem.vue";

defineOptions({ inheritAttrs: false });

const props = defineProps<FooterProps & { class?: HTMLAttributes["class"] }>();
const footerList = useFooterItems();
const pathname = usePathname();
const neighbours = computed(() => {
  if (props.items) return props.items;

  const idx = footerList.value.findIndex((item) => isActive(item.url, pathname.value));

  if (idx === -1) return {};
  return {
    previous: footerList.value[idx - 1],
    next: footerList.value[idx + 1],
  };
});
const className = computed(() =>
  cn(
    "@container grid gap-4",
    neighbours.value.previous && neighbours.value.next ? "grid-cols-2" : "grid-cols-1",
    props.class,
  ),
);
</script>

<template>
  <div :class="className" v-bind="$attrs">
    <FooterItem v-if="neighbours.previous" :item="neighbours.previous" :index="0" />
    <FooterItem v-if="neighbours.next" :item="neighbours.next" :index="1" />
  </div>
  <slot />
</template>
