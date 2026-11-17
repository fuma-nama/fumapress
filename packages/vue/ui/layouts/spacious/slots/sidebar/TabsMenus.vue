<script setup lang="ts">
import { computed } from "vue";
import { useTabsGroups } from "../../../../contexts/tree";
import { useSpaciousLayout } from "../../context";
import TabsMenu from "./TabsMenu.vue";

/** the sections, then the root folders of a type within them (`root: 'version'`), as one control */
const { props: layout } = useSpaciousLayout();
const groups = useTabsGroups(() => layout.value.tabs);
const start = computed(() =>
  Math.max(
    0,
    groups.value.findLastIndex((group) => typeof group.active?.root !== "string"),
  ),
);
</script>

<template>
  <div
    v-if="start < groups.length"
    class="flex flex-col rounded-xl border bg-fd-secondary/50 divide-y overflow-clip"
  >
    <template v-for="(group, i) in groups" :key="i">
      <TabsMenu v-if="i >= start" :options="group.options" />
    </template>
  </div>
</template>
