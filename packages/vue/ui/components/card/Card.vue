<script setup lang="ts">
import { computed } from "vue";
import Link from "../../core/link";
import { cn } from "../../utils/cn";
import type { CardProps } from "./index";

const props = withDefaults(defineProps<CardProps>(), { external: undefined });
const className = computed(() =>
  cn(
    "block rounded-xl border bg-fd-card p-4 text-fd-card-foreground transition-colors @max-lg:col-span-full",
    props.href && "hover:bg-fd-accent/80",
    props.class,
  ),
);
const Icon = () => props.icon;
const Title = () => props.title;
const Description = () => props.description;
</script>

<template>
  <component
    :is="href ? Link : 'div'"
    :href="href"
    :external="external"
    data-card="true"
    :class="className"
  >
    <div
      v-if="icon || $slots.icon"
      class="not-prose mb-2 w-fit shadow-md rounded-lg border bg-fd-muted p-1.5 text-fd-muted-foreground [&_svg]:size-4"
    >
      <slot name="icon"><Icon /></slot>
    </div>
    <h3 class="not-prose mb-1 text-sm font-medium">
      <slot name="title"><Title /></slot>
    </h3>
    <p v-if="description || $slots.description" class="my-0! text-sm text-fd-muted-foreground">
      <slot name="description"><Description /></slot>
    </p>
    <div class="text-sm text-fd-muted-foreground prose-no-margin empty:hidden">
      <slot />
    </div>
  </component>
</template>
