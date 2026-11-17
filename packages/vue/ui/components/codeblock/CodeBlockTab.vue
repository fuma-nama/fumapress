<script setup lang="ts">
import { TabsContent } from "../ui/tabs";

defineProps<{ value: string; id?: string }>();
</script>

<template>
  <TabsContent :id="id" :value="value">
    <slot />
  </TabsContent>
</template>
