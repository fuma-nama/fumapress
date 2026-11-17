<script setup lang="ts">
import { computed, h, provide, type Component } from "vue";
import { usePathname } from "../../../core/framework";
import { cn } from "../../../utils/cn";
import { RenderNode } from "../../shared";
import { useSpaciousLayout } from "../context";
import { PageKey, type DocsPageSlots } from "./context";
import ExpandSidebar from "./ExpandSidebar.vue";
import type { DocsPageProps } from "./index";
import { Breadcrumb, useBreadcrumbItems } from "./slots/breadcrumb";
import { Footer } from "./slots/footer";
import { TOC, TOCDropdown, TOCPopover, TOCProvider } from "./slots/toc";

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<DocsPageProps>(), { full: false, toc: () => [] });
const options = computed(() => {
  const {
    full,
    toc,
    tableOfContent: { enabled: tocEnabled = !full, single, ...tocProps } = {},
    tableOfContentPopover: { enabled: tocPopoverEnabled, ...tocPopoverProps } = {},
    breadcrumb: { enabled: breadcrumbEnabled = true, ...breadcrumb } = {},
    footer: { enabled: footerEnabled = true, ...footer } = {},
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
    breadcrumb,
    footerEnabled,
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
    dropdown: TOCDropdown,
  },
}));
const { props: layout, slots: layoutSlots } = useSpaciousLayout();
const breadcrumbItems = useBreadcrumbItems(() => options.value.breadcrumb);
const hasFolders = computed(
  () => breadcrumbItems.value.length > 0 && options.value.breadcrumbEnabled,
);
const pathname = usePathname();

provide(PageKey, {
  full: computed(() => props.full),
  slots,
});

// rendered with `h`: `style` of the options names a variant, and `v-bind` in a template would read it as CSS
function renderToc(
  component: Component,
  { header, footer, ...rest }: { header?: string | Component; footer?: string | Component },
) {
  return h(component, rest, {
    ...(header && { header: () => h(RenderNode, { node: header }) }),
    ...(footer && { footer: () => h(RenderNode, { node: footer }) }),
  });
}

const TocPopover = () => renderToc(slots.value.toc.popover, options.value.tocPopoverProps);
const TocDropdown = () => renderToc(slots.value.toc.dropdown, options.value.tocPopoverProps);
const TocMain = () => renderToc(slots.value.toc.main, options.value.tocProps);

const headerClass = computed(() =>
  cn(
    "absolute inset-x-0 top-0 z-10 flex items-center gap-1.5 h-(--fd-header-height) ps-6 pe-4 bg-linear-to-b from-fd-background to-transparent pointer-events-none *:pointer-events-auto max-md:hidden",
    // shorter fade for an empty header start
    hasFolders.value || options.value.tocPopoverEnabled ? "from-50%" : "to-40%",
  ),
);
const dropdownClass = computed(() => {
  const aiChat = layout.value.aiChat;

  return cn(
    "flex items-center gap-1.5 min-w-0 transition-[opacity,visibility] duration-300 motion-reduce:transition-none",
    // in place of the hidden TOC
    options.value.tocEnabled &&
      !(aiChat?.open && aiChat.panel) &&
      "invisible opacity-0 @max-5xl:visible @max-5xl:opacity-100 @max-5xl:transition-none",
  );
});
const articleClass = computed(() =>
  cn(
    "flex flex-col gap-4 w-full min-w-0 max-w-(--fd-page-width) pt-6 pb-8",
    props.full && "layout:[--fd-page-width:1200px]",
    props.class,
  ),
);
const mobileBreadcrumbClass = computed(() => cn("md:hidden", options.value.breadcrumb.class));
</script>

<template>
  <component
    :is="slots.toc.provider"
    :single="options.single"
    :toc="options.tocEnabled || options.tocPopoverEnabled ? toc : []"
  >
    <div
      class="sticky top-[calc(var(--fd-banner-height,0px)+var(--fd-header-height))] z-30 [grid-area:toc-popover] self-start md:hidden"
    >
      <component :is="TocPopover" v-if="options.tocPopoverEnabled" />
      <div
        class="absolute inset-x-2 top-full h-[calc(var(--fd-layout-height)-var(--fd-header-height)-100%)] rounded-t-2xl border-x border-t outline-8 outline-fd-card [clip-path:inset(0_-8px_-8px)] bg-origin-border bg-linear-to-b from-fd-background to-transparent to-[16px] pointer-events-none"
      />
    </div>
    <!-- a new page starts from the top of panel -->
    <main
      id="nd-page-panel"
      :key="pathname"
      class="@container relative flex flex-col min-w-0 min-h-0 [grid-area:main] mx-2 bg-fd-background md:ms-0 md:my-2 md:overflow-clip md:rounded-2xl md:border md:shadow-sm print:overflow-visible"
    >
      <header :class="headerClass">
        <ExpandSidebar />
        <component
          :is="slots.breadcrumb"
          v-if="options.breadcrumbEnabled"
          v-bind="options.breadcrumb"
        />
        <div v-if="options.tocPopoverEnabled" :class="dropdownClass">
          <span v-if="hasFolders" class="text-sm text-fd-muted-foreground/50">/</span>
          <component :is="TocDropdown" />
        </div>
        <component :is="layoutSlots.actions" class="ms-auto" />
      </header>
      <div
        class="flex flex-1 items-start px-4 md:min-h-0 md:pt-(--fd-header-height) md:px-[max(--spacing(6),calc((100%-var(--fd-page-width)-var(--fd-toc-width))/2))] md:overflow-y-auto md:overscroll-y-contain md:scrollbar-thin md:scrollbar-gutter-stable md:[--fd-docs-height:calc(var(--fd-layout-height)-var(--spacing)*4-2px-var(--fd-header-height))]"
      >
        <article :data-full="full" v-bind="$attrs" :class="articleClass" id="nd-page">
          <component
            :is="slots.breadcrumb"
            v-if="options.breadcrumbEnabled"
            v-bind="{ ...options.breadcrumb, class: mobileBreadcrumbClass }"
          />
          <slot />
          <component :is="slots.footer" v-if="options.footerEnabled" v-bind="options.footer" />
        </article>
        <component :is="TocMain" v-if="options.tocEnabled" />
      </div>
    </main>
  </component>
</template>
