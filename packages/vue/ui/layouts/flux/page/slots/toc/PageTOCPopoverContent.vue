<script setup lang="ts">
import { CollapsibleContent } from "../../../../../components/ui/collapsible";
</script>

<template>
  <CollapsibleContent data-toc-popover-content="">
    <div class="flex flex-col px-2 max-h-[50vh]"><slot /></div>
  </CollapsibleContent>
</template>
