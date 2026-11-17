<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import * as Base from "../../../../../components/toc";
import * as TocBlock from "../../../../../components/toc/block";
import * as TocClerk from "../../../../../components/toc/clerk";
import * as TocDefault from "../../../../../components/toc/default";

const variants = { normal: TocDefault, clerk: TocClerk, block: TocBlock };

const props = withDefaults(
  defineProps<{
    style?: "block" | "normal" | "clerk";
    list?: TocBlock.TOCItemsProps | TocDefault.TOCItemsProps | TocClerk.TOCItemsProps;
    class?: HTMLAttributes["class"];
  }>(),
  { style: "block" },
);
const emit = defineEmits<{ select: [] }>();
const items = Base.useTOCItems();
const variant = computed(() => variants[props.style]);
</script>

<template>
  <Base.TOCScrollArea :class="props.class">
    <component :is="variant.TOCItems" v-bind="list">
      <component :is="variant.TOCEmpty" v-if="items.length === 0" />
      <component
        :is="variant.TOCItem"
        v-for="item in items"
        :key="item.url"
        :item="item"
        @click="emit('select')"
      />
    </component>
  </Base.TOCScrollArea>
</template>
