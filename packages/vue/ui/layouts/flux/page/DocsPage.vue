<script setup lang="ts">
import { computed, h, provide } from "vue";
import { RenderNode } from "../../shared";
import { PageKey, type DocsPageSlots } from "./context";
import type { DocsPageProps } from "./index";
import { Breadcrumb } from "./slots/breadcrumb";
import { Container } from "./slots/container";
import { Footer } from "./slots/footer";
import { TOC, TOCProvider } from "./slots/toc";

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<DocsPageProps>(), { full: false, toc: () => [] });
const options = computed(() => {
  const {
    full,
    tableOfContent: { enabled: tocEnabled = !full, single, ...tocProps } = {},
    breadcrumb: {
      enabled: breadcrumbEnabled = true,
      component: breadcrumbComponent,
      ...breadcrumb
    } = {},
    footer: { enabled: footerEnabled = true, component: footerComponent, ...footer } = {},
  } = props;

  return {
    tocEnabled,
    single,
    tocProps,
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
  container: props.slots?.container ?? Container,
  toc: props.slots?.toc ?? {
    provider: TOCProvider,
    main: TOC,
  },
}));

provide(PageKey, {
  full: computed(() => props.full),
  slots,
});

// rendered with `h`: `style` of the options names a variant, and `v-bind` in a template would read it as CSS
const TocMain = () => {
  const { header, footer, component: node, ...rest } = options.value.tocProps;
  if (node != null) return h(RenderNode, { node });

  return h(slots.value.toc.main, rest, {
    ...(header && { header: () => h(RenderNode, { node: header }) }),
    ...(footer && { footer: () => h(RenderNode, { node: footer }) }),
  });
};
</script>

<template>
  <component :is="slots.toc.provider" :single="options.single" :toc="options.tocEnabled ? toc : []">
    <component :is="TocMain" v-if="options.tocEnabled" />
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
  </component>
</template>
