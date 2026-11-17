<script setup lang="ts">
import { computed } from "vue";
import * as Base from "../../../../../components/toc";
import { variants } from "./context";
import type { TOCProps } from "./index";
import PageTOCPopover from "./PageTOCPopover.vue";
import PageTOCPopoverContent from "./PageTOCPopoverContent.vue";
import PageTOCPopoverTrigger from "./PageTOCPopoverTrigger.vue";

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<TOCProps>(), { style: "normal" });
const items = Base.useTOCItems();
const variant = computed(() => variants[props.style]);
</script>

<template>
  <PageTOCPopover v-if="items.length > 0 || $slots.header || $slots.footer" v-bind="container">
    <PageTOCPopoverContent v-bind="content">
      <slot name="header" />
      <Base.TOCScrollArea class="ms-px">
        <component :is="variant.TOCItems" v-bind="list">
          <component :is="variant.TOCEmpty" v-if="items.length === 0" />
          <component :is="variant.TOCItem" v-for="item in items" :key="item.url" :item="item" />
        </component>
      </Base.TOCScrollArea>
      <slot name="footer" />
    </PageTOCPopoverContent>
    <PageTOCPopoverTrigger v-bind="trigger" />
  </PageTOCPopover>
</template>
