<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  provide,
  shallowRef,
  useTemplateRef,
  watch,
  type ComponentPublicInstance,
} from "vue";
import { TabsRoot as Root } from "reka-ui";
import { getHash } from "../../../utils/urls";
import { listeners, TabsKey, type TabsContextType } from "./context";
import type { TabsProps } from "./index";

const props = withDefaults(defineProps<TabsProps>(), { persist: false, updateAnchor: false });
const emit = defineEmits<{ "update:value": [value: string] }>();

const tabsRef = useTemplateRef<ComponentPublicInstance>("tabs");
const valueToIdMap: TabsContextType["valueToIdMap"] = new Map();
const panels: TabsContextType["panels"] = new Map();
const triggers: TabsContextType["triggers"] = new Set();

// not supposed to change controlled/uncontrolled
const state = shallowRef(props.defaultValue);
const value = computed(() => (props.value === undefined ? state.value : props.value));
const setValue = (v: string) => {
  if (props.value === undefined) state.value = v;
  else emit("update:value", v);
};

const onChange = (v: string) => {
  if (triggers.has(v)) setValue(v);
};

const openFromHash = () => {
  const hash = getHash();
  if (!hash) return;

  // hash points to a tab's own anchor id
  for (const [value, id] of valueToIdMap.entries()) {
    if (id === hash) {
      setValue(value);
      (tabsRef.value?.$el as HTMLElement | undefined)?.scrollIntoView();
      return;
    }
  }

  // hash points to an element inside a mounted (e.g. `forceMount`) panel,
  // open the tab it belongs to, then scroll to it once the panel is visible.
  const target = document.getElementById(hash);
  if (!target) return;

  for (const [value, panel] of panels.entries()) {
    if (!panel()?.contains(target)) continue;

    setValue(value);
    requestAnimationFrame(() => target.scrollIntoView());
    return;
  }
};

onMounted(() => {
  watch(
    () => [props.groupId, props.persist] as const,
    ([groupId, persist], _, onCleanup) => {
      if (!groupId) return;
      let previous = sessionStorage.getItem(groupId);
      if (persist) previous ??= localStorage.getItem(groupId);
      if (previous) onChange(previous);

      const groupListeners = listeners.get(groupId) ?? new Set();
      groupListeners.add(onChange);
      listeners.set(groupId, groupListeners);
      onCleanup(() => {
        groupListeners.delete(onChange);
      });
    },
    { immediate: true },
  );

  openFromHash();
  window.addEventListener("hashchange", openFromHash);
});

onBeforeUnmount(() => window.removeEventListener("hashchange", openFromHash));

function onValueChange(v: string | number) {
  v = String(v);
  if (props.updateAnchor) {
    const id = valueToIdMap.get(v);

    if (id) {
      // the state is kept: Vue Router has the scroll position in it
      window.history.replaceState(window.history.state, "", `#${id}`);
    }
  }

  if (props.groupId) {
    const groupListeners = listeners.get(props.groupId);
    if (groupListeners) {
      for (const listener of groupListeners) listener(v);
    }

    sessionStorage.setItem(props.groupId, v);
    if (props.persist) localStorage.setItem(props.groupId, v);
  } else {
    setValue(v);
  }
}

provide(TabsKey, { valueToIdMap, panels, triggers });
// `activation-mode="manual"`: tabs of Base UI activate on click, not on focus
</script>

<template>
  <Root
    ref="tabs"
    activation-mode="manual"
    :model-value="value"
    @update:model-value="onValueChange"
  >
    <slot />
  </Root>
</template>
