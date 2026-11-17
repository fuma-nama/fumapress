<script setup lang="ts">
import { computed } from "vue";
import { CircleCheck, CircleX, Info, Lightbulb, TriangleAlert } from "lucide-vue-next";
import { cn } from "../../utils/cn";
import type { CalloutContainerProps, CalloutType } from "./index";

const iconClass = "size-5 -me-0.5 fill-(--callout-color) text-fd-card";

const props = withDefaults(defineProps<CalloutContainerProps>(), { type: "info" });

function resolveAlias(type: CalloutType) {
  if (type === "warn") return "warning";
  if ((type as unknown) === "tip") return "info";
  return type;
}

const resolved = computed(() => resolveAlias(props.type));
const className = computed(() =>
  cn(
    "flex gap-2 my-4 rounded-xl border bg-fd-card p-3 ps-1 text-sm text-fd-card-foreground",
    props.class,
  ),
);
const style = computed(() => ({
  "--callout-color": `var(--color-fd-${resolved.value}, var(--color-fd-muted))`,
}));
const Icon = () => props.icon;
</script>

<template>
  <div :class="className" :style="style">
    <div role="none" class="w-0.5 bg-(--callout-color)/50 rounded-sm" />
    <slot name="icon">
      <Icon v-if="icon != null" />
      <Info v-else-if="resolved === 'info'" :class="iconClass" />
      <TriangleAlert v-else-if="resolved === 'warning'" :class="iconClass" />
      <CircleX v-else-if="resolved === 'error'" :class="iconClass" />
      <CircleCheck v-else-if="resolved === 'success'" :class="iconClass" />
      <Lightbulb
        v-else-if="resolved === 'idea'"
        class="size-5 -me-0.5 fill-(--callout-color) text-(--callout-color)"
      />
    </slot>
    <div class="flex flex-col gap-2 min-w-0 flex-1"><slot /></div>
  </div>
</template>
