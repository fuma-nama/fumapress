<script setup lang="ts">
import { computed, provide, shallowRef, toRef } from "vue";
import { useOnChange } from "../../../core/utils/use-on-change";
import { Collapsible } from "../../ui/collapsible";
import { FolderKey, useFolderDepth, useSidebar } from "./context";

const props = withDefaults(
  defineProps<{ active?: boolean; defaultOpen?: boolean; collapsible?: boolean }>(),
  { active: false, defaultOpen: undefined, collapsible: true },
);
const { defaultOpenLevel } = useSidebar();
const depth = useFolderDepth() + 1;
const defaultOpen = computed(
  () =>
    props.collapsible === false ||
    props.active ||
    (props.defaultOpen ?? defaultOpenLevel.value >= depth),
);
const open = shallowRef(defaultOpen.value);
const setOpen = (value: boolean) => {
  open.value = value;
};

useOnChange(defaultOpen, (v) => {
  if (v) setOpen(v);
});

provide(FolderKey, { open, setOpen, depth, collapsible: toRef(props, "collapsible") });
</script>

<template>
  <Collapsible :open="open" :disabled="!collapsible" @update:open="setOpen">
    <slot />
  </Collapsible>
</template>
