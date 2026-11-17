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
const footer = computed<NonNullable<FooterProps["items"]>>(() => {
  if (props.items) return props.items;
  const idx = footerList.value.findIndex((item) => isActive(item.url, pathname.value));
  if (idx === -1) return {};

  return { previous: footerList.value[idx - 1], next: footerList.value[idx + 1] };
});
const className = computed(() => cn("@container grid grid-cols-2 gap-3 mt-8", props.class));
</script>

<template>
  <nav v-if="footer.previous || footer.next" :class="className" v-bind="$attrs">
    <FooterItem v-if="footer.previous" :item="footer.previous" :next="false" />
    <FooterItem v-if="footer.next" :item="footer.next" next />
  </nav>
</template>
