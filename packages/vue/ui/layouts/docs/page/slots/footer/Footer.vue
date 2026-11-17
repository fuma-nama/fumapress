<script setup lang="ts">
import { computed } from "vue";
import { usePathname } from "../../../../../core/framework";
import { cn } from "../../../../../utils/cn";
import { isActive } from "../../../../../utils/urls";
import { useFooterItems } from "../../../../../utils/use-footer-items";
import FooterItem from "./FooterItem.vue";
import type { FooterProps } from "./index";

defineOptions({ inheritAttrs: false });

const props = defineProps<FooterProps>();
const footerList = useFooterItems();
const pathname = usePathname();
const siblings = computed<NonNullable<FooterProps["items"]>>(() => {
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
    siblings.value.previous && siblings.value.next ? "grid-cols-2" : "grid-cols-1",
    props.class,
  ),
);
</script>

<template>
  <div :class="className" v-bind="$attrs">
    <FooterItem v-if="siblings.previous" :item="siblings.previous" :index="0" />
    <FooterItem v-if="siblings.next" :item="siblings.next" :index="1" />
  </div>
  <slot />
</template>
