<script setup lang="ts">
import { useTabsGroups } from "../../../../contexts/tree";
import type { LayoutTab } from "../../../../layouts/shared";
import Dropdown from "./Dropdown.vue";

/**
 * Renders the given tabs as a dropdown per tabs group, one for each root folder on the
 * current page's path, letting users switch between root folders of the same type.
 */
defineOptions({ inheritAttrs: false });

const props = defineProps<{ options: LayoutTab[] }>();
const groups = useTabsGroups(() => props.options);
</script>

<template>
  <Dropdown v-for="(group, i) in groups" :key="i" :options="group.options" v-bind="$attrs">
    <template v-if="$slots.placeholder" #placeholder><slot name="placeholder" /></template>
  </Dropdown>
</template>
