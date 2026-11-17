<script setup lang="ts">
import { computed, h, provide, type Component } from "vue";
import { RenderNode } from "../../shared";
import { PageKey, type DocsPageSlots } from "./context";
import type { DocsPageProps } from "./index";
import { Breadcrumb } from "./slots/breadcrumb";
import { Container } from "./slots/container";
import { Footer } from "./slots/footer";
import { TOC, TOCPopover, TOCProvider } from "./slots/toc";

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<DocsPageProps>(), { full: false, toc: () => [] });
const options = computed(() => {
  const {
    full,
    tableOfContent: { enabled: tocEnabled = !full, single, ...tocProps } = {},
    tableOfContentPopover: { enabled: tocPopoverEnabled, ...tocPopoverProps } = {},
    breadcrumb: {
      enabled: breadcrumbEnabled = true,
      component: breadcrumbComponent,
      ...breadcrumb
    } = {},
    footer: { enabled: footerEnabled = true, component: footerComponent, ...footer } = {},
    toc,
  } = props;

  return {
    tocEnabled,
    single,
    tocProps,
    tocPopoverEnabled:
      tocPopoverEnabled ??
      Boolean(toc.length > 0 || tocPopoverProps.header || tocPopoverProps.footer),
    tocPopoverProps,
    breadcrumbEnabled,
    breadcrumbComponent,
    breadcrumb,
    footerEnabled,
    footerComponent,
    footer,
  };
});
const slots = computed<DocsPageSlots>(() => ({
  breadcrumb: props.slots?.breadcrumb ?? Breadcrumb,
  footer: props.slots?.footer ?? Footer,
  toc: props.slots?.toc ?? {
    provider: TOCProvider,
    main: TOC,
    popover: TOCPopover,
  },
  container: props.slots?.container ?? Container,
}));

provide(PageKey, {
  full: computed(() => props.full),
  slots,
});

// rendered with `h`: `style` of the options names a variant, and `v-bind` in a template would read it as CSS
function renderToc(
  component: Component,
  {
    header,
    footer,
    component: node,
    ...rest
  }: { header?: string | Component; footer?: string | Component; component?: string | Component },
) {
  if (node != null) return h(RenderNode, { node });

  return h(component, rest, {
    ...(header && { header: () => h(RenderNode, { node: header }) }),
    ...(footer && { footer: () => h(RenderNode, { node: footer }) }),
  });
}

const TocPopover = () => renderToc(slots.value.toc.popover, options.value.tocPopoverProps);
const TocMain = () => renderToc(slots.value.toc.main, options.value.tocProps);
</script>

<template>
  <component
    :is="slots.toc.provider"
    :single="options.single"
    :toc="options.tocEnabled || options.tocPopoverEnabled ? toc : []"
  >
    <component :is="TocPopover" v-if="options.tocPopoverEnabled" />
    <component :is="slots.container" v-bind="$attrs">
      <template v-if="options.breadcrumbEnabled">
        <RenderNode
          v-if="options.breadcrumbComponent != null"
          :node="options.breadcrumbComponent"
        />
        <component :is="slots.breadcrumb" v-else v-bind="options.breadcrumb" />
      </template>
      <slot />
      <template v-if="options.footerEnabled">
        <RenderNode v-if="options.footerComponent != null" :node="options.footerComponent" />
        <component :is="slots.footer" v-else v-bind="options.footer" />
      </template>
    </component>
    <component :is="TocMain" v-if="options.tocEnabled" />
  </component>
</template>
