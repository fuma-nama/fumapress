<script setup lang="ts">
import { computed, h, inject, useAttrs, useSlots, useTemplateRef } from "vue";
import { cn } from "../../utils/cn";
import { TabsKey } from "./context";
import CopyButton from "./CopyButton.vue";
import type { CodeBlockProps } from "./index";

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<CodeBlockProps>(), {
  allowCopy: true,
  keepBackground: false,
  viewportProps: () => ({}),
});
const attrs = useAttrs();
const slots = useSlots();
const inTab = inject(TabsKey, null) !== null;
const areaRef = useTemplateRef<HTMLDivElement>("area");
const allowCopy = computed(() => {
  if (props.allowCopy === "true") return true;
  if (props.allowCopy === "false") return false;
  return props.allowCopy;
});

const className = computed(() =>
  cn(
    inTab ? "bg-fd-secondary -mx-px -mb-px last:rounded-b-xl" : "my-4 bg-fd-card rounded-xl",
    props.keepBackground && "bg-(--shiki-light-bg) dark:bg-(--shiki-dark-bg)",

    "shiki relative border not-prose overflow-hidden text-sm",
    props.class,
  ),
);
const viewportClass = computed(() =>
  cn(
    "text-[0.8125rem] py-3.5 overflow-auto max-h-[600px] fd-scroll-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-fd-ring",
    props.viewportProps.class,
  ),
);
const viewportRest = computed(() => {
  const { class: _class, style: _style, ...rest } = props.viewportProps;
  return rest;
});

/** read while rendering: attributes are not reactive */
function viewportStyle() {
  return [
    {
      // space for toolbar
      "--padding-right": !(props.title || slots.title) ? "calc(var(--spacing) * 8)" : undefined,
      counterSet: attrs["data-line-numbers"]
        ? `line ${Number(attrs["data-line-numbers-start"] ?? 1) - 1}`
        : undefined,
    },
    props.viewportProps.style,
  ];
}

// the `<figcaption>` is a dynamic component: the template compiler warns about one inside a `<div>`
const Icon = () => props.icon;
const Title = () => props.title;
const Copy = () => (allowCopy.value ? h(CopyButton, { containerRef: areaRef }) : null);
</script>

<template>
  <figure dir="ltr" v-bind="$attrs" tabindex="-1" :class="className">
    <div
      v-if="title || $slots.title"
      class="flex text-fd-muted-foreground items-center gap-2 h-9.5 border-b px-4"
    >
      <div v-if="typeof icon === 'string'" class="[&_svg]:size-3.5" v-html="icon" />
      <slot v-else name="icon"><Icon /></slot>
      <component :is="'figcaption'" class="flex-1 truncate">
        <slot name="title"><Title /></slot>
      </component>
      <slot name="Actions" class="-me-2" :children="Copy">
        <div class="empty:hidden -me-2"><Copy /></div>
      </slot>
    </div>
    <slot
      v-else
      name="Actions"
      class="absolute top-2 right-2 z-2 backdrop-blur-lg rounded-lg text-fd-muted-foreground"
      :children="Copy"
    >
      <div
        class="empty:hidden absolute top-2 right-2 z-2 backdrop-blur-lg rounded-lg text-fd-muted-foreground"
      >
        <Copy />
      </div>
    </slot>
    <div
      ref="area"
      v-bind="viewportRest"
      tabindex="0"
      :class="viewportClass"
      :style="viewportStyle()"
    >
      <slot />
    </div>
  </figure>
</template>
