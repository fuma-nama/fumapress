<script setup lang="ts">
import { computed, type VNode } from "vue";
import {
  AccordionContent,
  AccordionHeader,
  AccordionItem,
  AccordionTrigger,
} from "../ui/accordion";
import CopyButton from "./CopyButton.vue";

const props = defineProps<{
  /** or the slot `title` */
  title?: string | VNode;
  id?: string;
  value?: string;
}>();
const resolved = computed(() => props.value ?? String(props.title));
const Title = () => props.title;
// `unmount-on-hide` off is `hiddenUntilFound` of Base UI: closed content stays in the DOM as `hidden="until-found"`
</script>

<template>
  <AccordionItem :value="resolved" :unmount-on-hide="false">
    <AccordionHeader :id="id" :data-accordion-value="resolved">
      <AccordionTrigger>
        <slot name="title"><Title /></slot>
      </AccordionTrigger>
      <CopyButton v-if="id" :id="id" />
    </AccordionHeader>
    <AccordionContent>
      <div
        class="px-4 pb-2 text-[0.9375rem] prose-no-margin [&[hidden]:not([hidden='until-found'])]:hidden"
      >
        <slot />
      </div>
    </AccordionContent>
  </AccordionItem>
</template>
