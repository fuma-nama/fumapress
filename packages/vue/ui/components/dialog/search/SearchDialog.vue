<script setup lang="ts">
import { computed, provide, shallowRef, toRef } from "vue";
import { DialogRoot } from "@fumapress/vue/reka/dialog";
import { safeHref } from "@fumapress/vue/client";
import { useRouter } from "../../../core/framework";
import { RootKey } from "./context";
import type { SearchDialogProps, SearchItemType } from "./index";

const props = withDefaults(defineProps<SearchDialogProps>(), { isLoading: false });
const emit = defineEmits<{
  "update:open": [open: boolean];
  "update:search": [v: string];
  select: [item: SearchItemType];
}>();

const router = useRouter();
const onOpenChange = (open: boolean) => emit("update:open", open);
const onSelect = (item: SearchItemType) => {
  if (item.type === "action") {
    item.onSelect();
  } else if (item.external) {
    const url = safeHref(item.url);
    if (url !== undefined) window.open(url, "_blank")?.focus();
  } else {
    void router.push(item.url);
  }

  onOpenChange(false);
  emit("select", item);
};
// the input and items read the active item, so only they re-render when it changes
const active = shallowRef<string | null>(null);
const listeners = new Set<() => void>();

provide(RootKey, {
  getActive: () => active.value,
  setActive(id) {
    active.value = id;
    for (const listener of listeners) listener();
  },
  subscribeActive(listener) {
    listeners.add(listener);
    return () => void listeners.delete(listener);
  },
  open: toRef(props, "open"),
  search: toRef(props, "search"),
  isLoading: toRef(props, "isLoading"),
  data: toRef(props, "data"),
  error: toRef(props, "error"),
  query: computed(() => (props.data ? props.data.query : props.search)),
  onOpenChange,
  onSearchChange: (v) => emit("update:search", v),
  onSelect,
});
</script>

<template>
  <DialogRoot :open="open" @update:open="onOpenChange">
    <slot />
  </DialogRoot>
</template>
