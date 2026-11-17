<script setup lang="ts">
import { computed } from "vue";
import { usePathname } from "../../../core/framework";
import { Link } from "../../../core/link";
import { isLinkItemActive, type LinkItemType } from "../index";

const props = defineProps<{ item: Extract<LinkItemType, { url: string }> }>();
const pathname = usePathname();
const active = computed(() => isLinkItemActive(props.item, pathname.value));
</script>

<template>
  <Link :href="item.url" :external="item.external" :data-active="active">
    <slot />
  </Link>
</template>
