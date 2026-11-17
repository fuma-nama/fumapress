<script setup lang="ts">
import { useTemplateRef, type ComponentPublicInstance } from "vue";
import { ExternalLink } from "../../../icons";
import { Link } from "../../../core/link";
import { useAutoScroll, useSidebar } from "./context";

/** a link of the sidebar: the `icon` slot is the external link icon by default */
const props = withDefaults(
  defineProps<{ href?: string; external?: boolean; prefetch?: boolean; active?: boolean }>(),
  { external: undefined, prefetch: undefined, active: false },
);
const link = useTemplateRef<ComponentPublicInstance>("link");
const { prefetch } = useSidebar();

useAutoScroll(
  () => props.active,
  () => link.value?.$el as HTMLElement | undefined,
);
</script>

<template>
  <Link
    ref="link"
    :href="href"
    :external="external"
    :data-active="active"
    :aria-current="active ? 'page' : undefined"
    :prefetch="props.prefetch ?? prefetch"
  >
    <slot name="icon"><ExternalLink v-if="external" /></slot>
    <slot />
  </Link>
</template>
