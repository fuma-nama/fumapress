<script setup lang="ts">
import { ref } from "vue";
import { FolderIcon, FolderOpen } from "lucide-vue-next";
import { cn } from "../../utils/cn";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
import { itemVariants } from "./context";
import type { FolderProps } from "./index";

const props = withDefaults(defineProps<FolderProps>(), { defaultOpen: false });
const open = ref(props.defaultOpen);
const triggerClass = cn(itemVariants({ class: "w-full" }));
</script>

<template>
  <Collapsible v-model:open="open" :disabled="disabled">
    <CollapsibleTrigger :class="triggerClass">
      <FolderOpen v-if="open" />
      <FolderIcon v-else />{{ name }}
    </CollapsibleTrigger>
    <CollapsibleContent>
      <div class="ms-2 flex flex-col border-l ps-2"><slot /></div>
    </CollapsibleContent>
  </Collapsible>
</template>
