<script setup lang="ts">
import { computed, h, provide, toRef, type Component, type FunctionalComponent } from "vue";
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
    toc,
    tableOfContent: {
      enabled: tocEnabled = !full,
      single,
      header: tocHeader,
      footer: tocFooter,
      component: tocComponent,
      ...tocProps
    } = {},
    tableOfContentPopover: {
      enabled: tocPopoverEnabled = Boolean(
        toc.length > 0 ||
        props.tableOfContentPopover?.header ||
        props.tableOfContentPopover?.footer,
      ),
      header: tocPopoverHeader,
      footer: tocPopoverFooter,
      component: tocPopoverComponent,
      ...tocPopoverProps
    } = {},
    breadcrumb: {
      enabled: breadcrumbEnabled = true,
      component: breadcrumbComponent,
      ...breadcrumb
    } = {},
    footer: { enabled: footerEnabled = true, component: footerComponent, ...footer } = {},
  } = props;

  return {
    toc: {
      enabled: tocEnabled,
      single,
      header: tocHeader,
      footer: tocFooter,
      component: tocComponent,
      props: tocProps,
    },
    tocPopover: {
      enabled: tocPopoverEnabled,
      header: tocPopoverHeader,
      footer: tocPopoverFooter,
      component: tocPopoverComponent,
      props: tocPopoverProps,
    },
    breadcrumb: { enabled: breadcrumbEnabled, component: breadcrumbComponent, props: breadcrumb },
    footer: { enabled: footerEnabled, component: footerComponent, props: footer },
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

// renders the TOC slots with `h`, which passes their `style` prop as it is: a template merges the props of a
// `v-if` branch with its `key`, and parses a `style` as CSS
const RenderSlot: FunctionalComponent<{ component: Component; props: object }> = (
  { component, props },
  { slots },
) => h(component, props, slots);
RenderSlot.props = ["component", "props"];

provide(PageKey, {
  full: toRef(props, "full"),
  slots,
});
</script>

<template>
  <component
    :is="slots.toc.provider"
    :single="options.toc.single"
    :toc="options.toc.enabled || options.tocPopover.enabled ? toc : []"
  >
    <template v-if="options.tocPopover.enabled">
      <RenderNode v-if="options.tocPopover.component" :node="options.tocPopover.component" />
      <RenderSlot v-else :component="slots.toc.popover" :props="options.tocPopover.props">
        <template v-if="options.tocPopover.header" #header>
          <RenderNode :node="options.tocPopover.header" />
        </template>
        <template v-if="options.tocPopover.footer" #footer>
          <RenderNode :node="options.tocPopover.footer" />
        </template>
      </RenderSlot>
    </template>
    <component :is="slots.container" v-bind="$attrs">
      <template v-if="options.breadcrumb.enabled">
        <RenderNode v-if="options.breadcrumb.component" :node="options.breadcrumb.component" />
        <component :is="slots.breadcrumb" v-else v-bind="options.breadcrumb.props" />
      </template>
      <slot />
      <template v-if="options.footer.enabled">
        <RenderNode v-if="options.footer.component" :node="options.footer.component" />
        <component :is="slots.footer" v-else v-bind="options.footer.props" />
      </template>
    </component>
    <template v-if="options.toc.enabled">
      <RenderNode v-if="options.toc.component" :node="options.toc.component" />
      <RenderSlot v-else :component="slots.toc.main" :props="options.toc.props">
        <template v-if="options.toc.header" #header>
          <RenderNode :node="options.toc.header" />
        </template>
        <template v-if="options.toc.footer" #footer>
          <RenderNode :node="options.toc.footer" />
        </template>
      </RenderSlot>
    </template>
  </component>
</template>
