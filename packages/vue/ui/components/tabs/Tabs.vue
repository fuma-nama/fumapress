<script setup lang="ts">
import { computed, provide, toRef } from "vue";
import { cn } from "../../utils/cn";
import { Tabs as UnstyledTabs } from "../ui/tabs";
import { escapeValue, TabsKey, type TabsContextType } from "./context";
import type { TabsProps } from "./index";
import TabsList from "./TabsList.vue";
import TabsTrigger from "./TabsTrigger.vue";

const props = withDefaults(defineProps<TabsProps>(), {
  defaultIndex: 0,
  persist: false,
  updateAnchor: false,
});
const defaultValue =
  props.defaultValue ?? (props.items ? escapeValue(props.items[props.defaultIndex]!) : undefined);
const collection: TabsContextType["collection"] = [];
const className = computed(() =>
  cn("flex flex-col overflow-hidden rounded-xl border bg-fd-secondary my-4", props.class),
);
const Label = () => props.label;

provide(TabsKey, { items: toRef(props, "items"), collection });
</script>

<template>
  <UnstyledTabs
    :class="className"
    :default-value="defaultValue"
    :group-id="groupId"
    :persist="persist"
    :update-anchor="updateAnchor"
  >
    <TabsList v-if="items">
      <span v-if="label || $slots.label" class="text-sm font-medium my-auto me-auto">
        <slot name="label"><Label /></slot>
      </span>
      <TabsTrigger v-for="item in items" :key="item" :value="escapeValue(item)">
        {{ item }}
      </TabsTrigger>
    </TabsList>
    <slot />
  </UnstyledTabs>
</template>
