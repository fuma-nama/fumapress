<script setup lang="ts">
import { computed, inject, useId } from "vue";
import { Primitive } from "@fumapress/vue/reka/primitive";
import { DrawerRootKey, type DrawerTriggerProps } from "./context";

/** A button that opens the drawer, its slot receives `{ open }`. */
const props = withDefaults(defineProps<DrawerTriggerProps>(), {
  handle: undefined,
  as: "button",
  asChild: false,
});

const rootStore = inject(DrawerRootKey, null);
// a detached trigger reads the store of its handle, which is attached on the client: until then it is closed
const store = computed(() => props.handle?.store.value ?? rootStore);
if (!props.handle && !rootStore)
  throw new Error(
    "Base UI: <Drawer.Trigger> must be used within <Drawer.Root> or provided with a handle.",
  );

const id = useId();
const openedByThis = computed(
  () => !!store.value?.open.value && store.value.activeTriggerId.value === id,
);
const popupId = computed(() => {
  if (!openedByThis.value) return undefined;
  const popup = store.value?.popupElement.value;
  return popup?.id || store.value?.floatingId;
});

function onClick() {
  const current = store.value;
  if (!current) return;
  current.setOpen(!current.open.value, "trigger-press", id);
}
</script>

<template>
  <Primitive
    :id="id"
    :as="as"
    :as-child="asChild"
    type="button"
    data-base-ui-click-trigger=""
    aria-haspopup="dialog"
    :aria-expanded="openedByThis"
    :aria-controls="popupId"
    :data-popup-open="openedByThis ? '' : undefined"
    @click="onClick"
  >
    <slot :open="openedByThis" />
  </Primitive>
</template>
