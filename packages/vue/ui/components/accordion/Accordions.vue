<script setup lang="ts">
import {
  computed,
  onMounted,
  ref,
  useTemplateRef,
  type ComponentPublicInstance,
  type HTMLAttributes,
} from "vue";
import { cn } from "../../utils/cn";
import { getHash } from "../../utils/urls";
import { Accordion as Root } from "../ui/accordion";

// the values of Base UI: a list of open items, with one item at most unless `multiple`
const props = withDefaults(
  defineProps<{
    class?: HTMLAttributes["class"];
    defaultValue?: string[];
    multiple?: boolean;
  }>(),
  { multiple: false },
);
const rootRef = useTemplateRef<ComponentPublicInstance>("root");
const value = ref<string[]>(props.defaultValue ?? []);

onMounted(() => {
  const id = getHash();
  const element = rootRef.value?.$el as HTMLElement | undefined;
  if (!element || id.length === 0) return;

  const selected = document.getElementById(id);
  if (!selected || !element.contains(selected)) return;
  const selectedValue = selected.getAttribute("data-accordion-value");

  if (selectedValue) value.value = [selectedValue, ...value.value];
});

function onValueChange(v: string | string[] | undefined) {
  if (Array.isArray(v)) value.value = v;
  else value.value = v ? [v] : [];
}

const className = computed(() =>
  cn("divide-y divide-fd-border overflow-hidden rounded-lg border bg-fd-card", props.class),
);
</script>

<template>
  <Root
    ref="root"
    :type="multiple ? 'multiple' : 'single'"
    :model-value="multiple ? value : value[0]"
    :class="className"
    @update:model-value="onValueChange"
  >
    <slot />
  </Root>
</template>
