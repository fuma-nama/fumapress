<script setup lang="ts">
import { CollapsibleContent } from "../../../../../components/ui/collapsible";
</script>

<template>
  <CollapsibleContent data-toc-popover-content="">
    <div class="flex flex-col px-4 max-h-[50vh] md:px-6"><slot /></div>
  </CollapsibleContent>
</template>
