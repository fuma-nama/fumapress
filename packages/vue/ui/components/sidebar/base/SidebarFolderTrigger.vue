<script setup lang="ts">
import { computed } from "vue";
import { ChevronDown } from "lucide-vue-next";
import { cn } from "../../../utils/cn";
import { CollapsibleTrigger } from "../../ui/collapsible";
import { useFolder } from "./context";

const { open, collapsible } = useFolder()!;
const iconClass = computed(() =>
  cn("ms-auto transition-transform", !open.value && "-rotate-90 rtl:rotate-90"),
);
</script>

<template>
  <CollapsibleTrigger v-if="collapsible">
    <slot />
    <ChevronDown data-icon :class="iconClass" />
  </CollapsibleTrigger>
  <div v-else><slot /></div>
</template>
