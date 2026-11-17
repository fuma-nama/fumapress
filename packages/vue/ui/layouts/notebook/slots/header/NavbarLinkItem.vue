<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { cn } from "../../../../utils/cn";
import { LinkItem, RenderNode, type LinkItemType } from "../../../shared";
import NavbarLinkItemMenu from "./NavbarLinkItemMenu.vue";

defineOptions({ inheritAttrs: false });

const props = defineProps<{ item: LinkItemType; class?: HTMLAttributes["class"] }>();
const linkClass = computed(() =>
  cn(
    "text-sm text-fd-muted-foreground transition-colors hover:text-fd-accent-foreground data-[active=true]:text-fd-primary",
    props.class,
  ),
);
</script>

<template>
  <RenderNode v-if="item.type === 'custom'" :node="item.children" />
  <NavbarLinkItemMenu
    v-else-if="item.type === 'menu'"
    :item="item"
    :class="props.class"
    v-bind="$attrs"
  />
  <LinkItem v-else :item="item" :class="linkClass" v-bind="$attrs">
    <RenderNode :node="item.text" />
  </LinkItem>
</template>
