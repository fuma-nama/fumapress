<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { buttonVariants } from "../../../../components/ui/button";
import { cn } from "../../../../utils/cn";
import { LinkItem, RenderNode } from "../../../shared";
import { useSpaciousLayout } from "../../context";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
const { menuItems } = useSpaciousLayout();
const className = computed(() =>
  cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), props.class),
);
</script>

<template>
  <template v-for="(item, i) in menuItems" :key="i">
    <LinkItem v-if="item.type === 'icon'" :item="item" :aria-label="item.label" :class="className">
      <RenderNode :node="item.icon" />
    </LinkItem>
  </template>
</template>
