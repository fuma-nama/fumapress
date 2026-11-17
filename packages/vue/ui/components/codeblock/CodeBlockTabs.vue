<script setup lang="ts">
import {
  computed,
  inject,
  provide,
  useTemplateRef,
  type ComponentPublicInstance,
  type HTMLAttributes,
} from "vue";
import { cn } from "../../utils/cn";
import { Tabs } from "../ui/tabs";
import { TabsKey } from "./context";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
const container = useTemplateRef<ComponentPublicInstance>("container");
const nested = inject(TabsKey, null) !== null;
const className = computed(() =>
  cn("bg-fd-card rounded-xl border", !nested && "my-4", props.class),
);

provide(TabsKey, {
  containerRef: computed(() => (container.value?.$el as HTMLElement | undefined) ?? null),
  nested,
});
</script>

<template>
  <Tabs ref="container" :class="className">
    <slot />
  </Tabs>
</template>
