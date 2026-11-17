<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { NavigationMenuLink } from "@fumapress/vue/reka/navigation-menu";
import { Link, type LinkProps } from "../../../core/link";
import { cn } from "../../../utils/cn";

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<LinkProps & { class?: HTMLAttributes["class"] }>(), {
  external: undefined,
  prefetch: undefined,
});
const className = computed(() =>
  cn(
    "flex flex-col gap-2 rounded-lg border bg-fd-card p-3 transition-colors hover:bg-fd-accent/80 hover:text-fd-accent-foreground",
    props.class,
  ),
);
</script>

<template>
  <NavigationMenuLink as-child>
    <Link :href="href" :external="external" :prefetch="prefetch" v-bind="$attrs" :class="className">
      <slot />
    </Link>
  </NavigationMenuLink>
</template>
